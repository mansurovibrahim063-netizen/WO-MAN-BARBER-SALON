#!/usr/bin/env python3
"""
WO&MAN Beauty Studio - web server.

One process that:
  * serves the website (index.html) and the admin panel (admin.html),
  * stores bookings and staff in ./data (see storage.py),
  * sends every new booking to the master and the admin on Telegram (bot.py),
  * protects the admin panel and its data with a password.

Run:   python server.py          then open http://localhost:8000
Set the admin password:   python server.py --parol <new-password>
Pure Python 3 standard library, no installs needed.

Environment variables (all optional):
  PORT                    port to listen on (default 8000)
  WOMAN_ADMIN_PASSWORD    admin password; if unset, one is generated on first
                          start, printed once, and stored (hashed) in data/
  WOMAN_BOT_TOKEN         Telegram bot token (can also be set in the admin panel)
  WOMAN_DATA_DIR          where bookings/staff are stored (default ./data)
  WOMAN_TRUST_PROXY=1     use X-Forwarded-For for rate limits (behind a proxy)
  WOMAN_DISABLE_BOT=1     don't start the Telegram polling thread
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import bot
import storage

PORT = int(os.environ.get("PORT", "8000"))
HOST = os.environ.get("HOST", "0.0.0.0")

SLOTS = ["10:00 AM", "11:30 AM", "1:00 PM", "2:30 PM", "4:00 PM", "5:30 PM", "7:00 PM"]
STATUSES = {"Pending", "Confirmed", "Completed", "Cancelled"}
SALONS = {"homme", "femme"}
MAX_BODY = 16 * 1024
BOOKING_DAYS_AHEAD = 90
SESSION_TTL = 12 * 3600

STATIC_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/admin": "admin.html",
    "/admin.html": "admin.html",
    "/styles.css": "styles.css",
    "/app.js": "app.js",
    "/admin.js": "admin.js",
    "/translations.js": "translations.js",
    "/site-config.js": "site-config.js",
}
ASSETS_DIR = os.path.join(storage.BASE_DIR, "assets")
CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    ".svg": "image/svg+xml", ".ico": "image/x-icon",
}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
PHONE_RE = re.compile(r"^\+?[\d\s\-()]{7,24}$")
CHAT_ID_RE = re.compile(r"^-?\d{1,20}$")


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


# --------------------------------------------------------------------------
# Admin password & sessions
# --------------------------------------------------------------------------
def _hash(password, salt_hex):
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 200_000).hex()


def setup_admin_password():
    """Returns a newly generated password (to print once), or None."""
    if os.environ.get("WOMAN_ADMIN_PASSWORD"):
        return None
    cfg = storage.load_config()
    if cfg.get("admin_pw_hash") and cfg.get("admin_pw_salt"):
        return None
    password = secrets.token_urlsafe(9)
    salt = secrets.token_hex(16)
    storage.update_config(admin_pw_salt=salt, admin_pw_hash=_hash(password, salt))
    return password


MIN_PASSWORD_LENGTH = 6


def set_admin_password(password):
    """Store a new admin password (hashed) in data/bot_config.json."""
    salt = secrets.token_hex(16)
    storage.update_config(admin_pw_salt=salt, admin_pw_hash=_hash(password, salt))


def set_password_command(args):
    """python server.py --parol [new-password]  (asks for it when not given)."""
    import getpass
    storage.ensure_data_dir()
    if args:
        password = args[0]
    else:
        password = getpass.getpass("Yangi admin parol / Новый пароль: ")
        if getpass.getpass("Yana bir marta / Ещё раз: ") != password:
            print("Parollar bir xil emas. / Пароли не совпадают.")
            return 1
    password = password.strip()
    if len(password) < MIN_PASSWORD_LENGTH:
        print(f"Parol kamida {MIN_PASSWORD_LENGTH} ta belgidan iborat bo'lishi kerak.")
        return 1
    set_admin_password(password)
    print("✅ Yangi admin parol saqlandi. Endi serverni ishga tushiring: python server.py")
    if os.environ.get("WOMAN_ADMIN_PASSWORD"):
        print("⚠️ WOMAN_ADMIN_PASSWORD o'rnatilgan: u bu paroldan ustun turadi. Uni olib tashlang.")
    return 0


def check_password(password):
    env_pw = os.environ.get("WOMAN_ADMIN_PASSWORD")
    if env_pw:
        return hmac.compare_digest(password.encode("utf-8"), env_pw.encode("utf-8"))
    cfg = storage.load_config()
    salt, stored = cfg.get("admin_pw_salt"), cfg.get("admin_pw_hash")
    if not salt or not stored:
        return False
    return hmac.compare_digest(_hash(password, salt), stored)


_sessions = {}
_sessions_lock = threading.Lock()


def new_session():
    token = secrets.token_urlsafe(32)
    with _sessions_lock:
        now = time.time()
        for t in [t for t, exp in _sessions.items() if exp < now]:
            del _sessions[t]
        _sessions[token] = now + SESSION_TTL
    return token


def valid_session(token):
    with _sessions_lock:
        exp = _sessions.get(token)
        return bool(exp and exp > time.time())


def end_session(token):
    with _sessions_lock:
        _sessions.pop(token, None)


class RateLimiter:
    def __init__(self, limit, window_s):
        self.limit, self.window = limit, window_s
        self.hits = {}
        self.lock = threading.Lock()

    def allow(self, key):
        now = time.time()
        with self.lock:
            recent = [t for t in self.hits.get(key, []) if now - t < self.window]
            if len(recent) >= self.limit:
                self.hits[key] = recent
                return False
            recent.append(now)
            self.hits[key] = recent
            return True


login_limiter = RateLimiter(10, 15 * 60)
booking_limiter = RateLimiter(20, 10 * 60)  # per IP; mobile carriers often share one IP


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------
def text(value, field, min_len=0, max_len=200):
    s = " ".join(str(value if value is not None else "").split())
    if len(s) < min_len:
        raise ApiError(400, f"'{field}' to'ldirilmagan")
    if len(s) > max_len:
        raise ApiError(400, f"'{field}' juda uzun (maks. {max_len})")
    return s


def now_local():
    return datetime.now(bot.TZ)


def slot_minutes(slot):
    t = datetime.strptime(slot, "%I:%M %p")
    return t.hour * 60 + t.minute


def validate_booking(data, admin=False):
    salon = data.get("salon")
    if salon not in SALONS:
        raise ApiError(400, "Zal noto'g'ri tanlangan")

    spec = next((s for s in storage.load_specialists() if s.get("id") == data.get("specialistId")), None)
    if not spec:
        raise ApiError(400, "Usta topilmadi")
    if not admin and (spec.get("salon") != salon or spec.get("onDuty") is False):
        raise ApiError(400, "Bu usta hozir yozilish uchun mavjud emas")

    date_s = str(data.get("date", ""))
    if not DATE_RE.match(date_s):
        raise ApiError(400, "Sana noto'g'ri")
    try:
        date = datetime.strptime(date_s, "%Y-%m-%d").date()
    except ValueError:
        raise ApiError(400, "Sana noto'g'ri")

    slot = data.get("timeSlot")
    if slot not in SLOTS:
        raise ApiError(400, "Vaqt noto'g'ri")

    if not admin:
        now = now_local()
        if date < now.date() or date > now.date() + timedelta(days=BOOKING_DAYS_AHEAD):
            raise ApiError(400, "Bu sanaga yozilib bo'lmaydi")
        if date == now.date() and slot_minutes(slot) <= now.hour * 60 + now.minute:
            raise ApiError(400, "Bu vaqt allaqachon o'tib ketgan")

    phone = text(data.get("clientPhone"), "Telefon", 1, 24)
    digits = sum(ch.isdigit() for ch in phone)
    if not PHONE_RE.match(phone) or not 7 <= digits <= 15:
        raise ApiError(400, "Telefon raqami noto'g'ri")

    return {
        "clientName": text(data.get("clientName"), "Ism", 2, 80),
        "clientPhone": phone,
        "salon": salon,
        "serviceId": text(data.get("serviceId"), "Xizmat", 0, 20),
        "serviceTitle": text(data.get("serviceTitle") or "Xizmat", "Xizmat", 1, 120),
        "specialistId": spec["id"],
        "specialistName": spec.get("name", ""),
        "date": date_s,
        "timeSlot": slot,
        "notes": text(data.get("notes"), "Izoh", 0, 300),
    }


def create_booking(fields, source, status):
    with storage.lock:
        appts = storage.load_appointments()
        taken = any(a.get("specialistId") == fields["specialistId"] and a.get("date") == fields["date"]
                    and a.get("timeSlot") == fields["timeSlot"] and a.get("status") != "Cancelled" for a in appts)
        if taken:
            raise ApiError(409, "Bu vaqt band bo'lib qoldi. Iltimos, boshqa vaqtni tanlang.")
        ids = {a.get("id") for a in appts}
        appt_id = f"WM-{secrets.randbelow(90000) + 10000}"
        while appt_id in ids:
            appt_id = f"WM-{secrets.randbelow(90000) + 10000}"
        appt = {"id": appt_id, **fields, "source": source, "status": status,
                "createdAt": datetime.now(timezone.utc).isoformat()}
        appts.insert(0, appt)
        storage.save_appointments(appts)
    threading.Thread(target=bot.notify_new_booking, args=(appt,), daemon=True).start()
    return appt


def validate_specialist(data, existing=None):
    salon = data.get("salon", existing.get("salon") if existing else None)
    if salon not in SALONS:
        raise ApiError(400, "Zal noto'g'ri")
    img = text(data.get("img", existing.get("img", "") if existing else ""), "Rasm", 0, 500)
    if img and not (img.startswith("https://") or img.startswith("http://") or img.startswith("assets/")):
        raise ApiError(400, "Rasm havolasi http(s):// bilan boshlanishi kerak")
    chat_id = text(data.get("chatId", existing.get("chatId", "") if existing else ""), "Chat ID", 0, 21)
    if chat_id and not CHAT_ID_RE.match(chat_id):
        raise ApiError(400, "Chat ID faqat raqamlardan iborat bo'lishi kerak")
    on_duty = data.get("onDuty", existing.get("onDuty", True) if existing else True)
    return {
        "name": text(data.get("name"), "Ism", 1, 60),
        "role": text(data.get("role"), "Mutaxassislik", 1, 80),
        "salon": salon,
        "phone": text(data.get("phone"), "Telefon", 0, 30),
        "telegram": text(data.get("telegram"), "Telegram", 0, 40),
        "chatId": chat_id,
        "img": img,
        "experience": text(data.get("experience"), "Tajriba", 0, 30),
        "onDuty": on_duty is True or on_duty == "true",
    }


PUBLIC_SPEC_FIELDS = ("id", "name", "role", "salon", "img", "rating", "experience", "onDuty")


def admin_spec_view(s):
    view = {k: v for k, v in s.items() if k != "linkCode"}
    view["link"] = bot.barber_link(s)
    return view


def telegram_status():
    token = bot.get_token()
    if token and not bot.bot_username():
        bot.get_me()
    cfg = storage.load_config()
    return {
        "tokenSet": bool(token),
        "tokenFromEnv": bool(os.environ.get("WOMAN_BOT_TOKEN")),
        "tokenMasked": (token[:6] + "…" + token[-4:]) if len(token) > 12 else "",
        "botUsername": bot.bot_username() or "",
        "adminChatId": str(cfg.get("admin_chat_id", "")),
        "adminLink": bot.admin_link(),
    }


# --------------------------------------------------------------------------
# HTTP handler
# --------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "WOMAN/1.0"
    sys_version = ""

    # ---- plumbing ---------------------------------------------------------
    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            super().log_message(fmt, *args)

    def client_ip(self):
        if os.environ.get("WOMAN_TRUST_PROXY") == "1":
            fwd = self.headers.get("X-Forwarded-For", "")
            if fwd:
                return fwd.split(",")[0].strip()
        return self.client_address[0]

    def common_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("X-Frame-Options", "SAMEORIGIN")

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.common_headers()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            raise ApiError(400, "Bad request")
        if length > MAX_BODY:
            raise ApiError(413, "So'rov juda katta")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except ValueError:
            raise ApiError(400, "JSON noto'g'ri")
        if not isinstance(data, dict):
            raise ApiError(400, "JSON noto'g'ri")
        return data

    def bearer(self):
        auth = self.headers.get("Authorization", "")
        return auth[7:].strip() if auth.startswith("Bearer ") else ""

    def require_admin(self):
        if not valid_session(self.bearer()):
            raise ApiError(401, "Avval admin sifatida kiring")

    def serve_static(self, path):
        if path.startswith("/assets/"):
            name = path[len("/assets/"):]
            if not re.fullmatch(r"[A-Za-z0-9._-]+", name) or name.startswith("."):
                return self.send_json(404, {"error": "Not found"})
            full = os.path.join(ASSETS_DIR, name)
        elif path in STATIC_FILES:
            full = os.path.join(storage.BASE_DIR, STATIC_FILES[path])
        else:
            return self.send_json(404, {"error": "Not found"})
        ext = os.path.splitext(full)[1].lower()
        if ext not in CONTENT_TYPES or not os.path.isfile(full):
            return self.send_json(404, {"error": "Not found"})
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES[ext])
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.common_headers()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def handle_any(self, method):
        url = urlparse(self.path)
        path = url.path
        try:
            if not path.startswith("/api/"):
                if method in ("GET", "HEAD"):
                    return self.serve_static(path)
                raise ApiError(405, "Method not allowed")
            status, payload = self.route(method, path, parse_qs(url.query))
            self.send_json(status, payload)
        except ApiError as e:
            self.send_json(e.status, {"error": e.message})
        except Exception as e:  # never leak a traceback to the browser
            bot.log(f"Server error on {method} {path}: {e!r}")
            self.send_json(500, {"error": "Server xatosi"})

    def do_GET(self): self.handle_any("GET")
    def do_HEAD(self): self.handle_any("HEAD")
    def do_POST(self): self.handle_any("POST")
    def do_PUT(self): self.handle_any("PUT")
    def do_PATCH(self): self.handle_any("PATCH")
    def do_DELETE(self): self.handle_any("DELETE")

    # ---- API routes ------------------------------------------------------
    def route(self, method, path, query):
        # Public
        if path == "/api/public/specialists" and method == "GET":
            return 200, [{k: s.get(k) for k in PUBLIC_SPEC_FIELDS} for s in storage.load_specialists()]

        if path == "/api/public/busy" and method == "GET":
            date_s = (query.get("date") or [""])[0]
            if not DATE_RE.match(date_s):
                raise ApiError(400, "Sana noto'g'ri")
            busy = {}
            for a in storage.load_appointments():
                if a.get("date") == date_s and a.get("status") != "Cancelled":
                    busy.setdefault(a.get("specialistId", ""), []).append(a.get("timeSlot"))
            return 200, {"date": date_s, "busy": busy}

        if path == "/api/bookings" and method == "POST":
            if not booking_limiter.allow(self.client_ip()):
                raise ApiError(429, "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.")
            appt = create_booking(validate_booking(self.read_json()), "Website", "Pending")
            return 201, {"id": appt["id"], "status": appt["status"], "specialistName": appt["specialistName"],
                         "date": appt["date"], "timeSlot": appt["timeSlot"]}

        # Admin auth
        if path == "/api/admin/login" and method == "POST":
            ip = self.client_ip()
            data = self.read_json()
            if not login_limiter.allow(ip):
                raise ApiError(429, "Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring.")
            if not check_password(str(data.get("password", ""))):
                raise ApiError(401, "Parol noto'g'ri")
            return 200, {"token": new_session()}

        if path == "/api/admin/logout" and method == "POST":
            end_session(self.bearer())
            return 200, {"ok": True}

        if not path.startswith("/api/admin/"):
            raise ApiError(404, "Not found")
        self.require_admin()

        if path == "/api/admin/appointments":
            if method == "GET":
                return 200, storage.load_appointments()
            if method == "POST":
                appt = create_booking(validate_booking(self.read_json(), admin=True), "Admin", "Confirmed")
                return 201, appt

        m = re.fullmatch(r"/api/admin/appointments/([A-Za-z0-9-]{1,20})", path)
        if m and method == "PATCH":
            status = self.read_json().get("status")
            if status not in STATUSES:
                raise ApiError(400, "Holat noto'g'ri")
            with storage.lock:
                appts = storage.load_appointments()
                appt = next((a for a in appts if a.get("id") == m.group(1)), None)
                if not appt:
                    raise ApiError(404, "Buyurtma topilmadi")
                appt["status"] = status
                appt["updatedAt"] = datetime.now(timezone.utc).isoformat()
                storage.save_appointments(appts)
            return 200, appt

        if path == "/api/admin/specialists":
            if method == "GET":
                return 200, [admin_spec_view(s) for s in storage.load_specialists()]
            if method == "POST":
                fields = validate_specialist(self.read_json())
                with storage.lock:
                    specs = storage.load_specialists()
                    spec = {"id": f"sp-{secrets.token_hex(3)}", **fields, "rating": "5.0",
                            "linkCode": secrets.token_hex(6)}
                    specs.append(spec)
                    storage.save_specialists(specs)
                return 201, admin_spec_view(spec)

        m = re.fullmatch(r"/api/admin/specialists/([A-Za-z0-9-]{1,30})", path)
        if m and method in ("PUT", "DELETE"):
            with storage.lock:
                specs = storage.load_specialists()
                spec = next((s for s in specs if s.get("id") == m.group(1)), None)
                if not spec:
                    raise ApiError(404, "Usta topilmadi")
                if method == "DELETE":
                    specs.remove(spec)
                    storage.save_specialists(specs)
                    return 200, {"ok": True}
                spec.update(validate_specialist(self.read_json(), existing=spec))
                storage.save_specialists(specs)
            return 200, admin_spec_view(spec)

        if path == "/api/admin/telegram":
            if method == "GET":
                return 200, telegram_status()
            if method == "POST":
                data = self.read_json()
                new_token = str(data.get("botToken", "")).strip()
                if new_token:
                    if os.environ.get("WOMAN_BOT_TOKEN"):
                        raise ApiError(400, "Token server sozlamasida (WOMAN_BOT_TOKEN) berilgan")
                    if not re.fullmatch(r"\d{5,15}:[A-Za-z0-9_-]{30,50}", new_token):
                        raise ApiError(400, "Token formati noto'g'ri")
                    if not bot.get_me(new_token):
                        raise ApiError(400, "Telegram bu tokenni qabul qilmadi. BotFather'dan qayta nusxalang.")
                    storage.update_config(bot_token=new_token)
                    bot.get_me()
                if "adminChatId" in data:
                    chat_id = str(data.get("adminChatId") or "").strip()
                    if chat_id and not CHAT_ID_RE.match(chat_id):
                        raise ApiError(400, "Admin Chat ID faqat raqamlardan iborat bo'lishi kerak")
                    storage.update_config(admin_chat_id=chat_id)
                return 200, telegram_status()

        if path == "/api/admin/telegram/test" and method == "POST":
            spec_id = self.read_json().get("specialistId")
            spec = next((s for s in storage.load_specialists() if s.get("id") == spec_id), None)
            if not spec:
                raise ApiError(404, "Usta topilmadi")
            if not bot.get_token():
                raise ApiError(400, "Avval bot tokenini saqlang")
            if not spec.get("chatId"):
                raise ApiError(400, f"{spec['name']} hali Telegram'ga ulanmagan. Unga shaxsiy havolani yuboring.")
            resp = bot.send_message(spec["chatId"], f"🧪 <b>{bot.BRAND_HTML}</b>: test xabari. Ulanish ishlayapti ✅")
            if not resp or not resp.get("ok"):
                raise ApiError(502, "Telegram xatosi: " + str((resp or {}).get("description", "javob yo'q")))
            return 200, {"ok": True}

        raise ApiError(404, "Not found")


def main():
    storage.ensure_data_dir()
    bot.ensure_link_codes()
    new_password = setup_admin_password()

    if os.environ.get("WOMAN_DISABLE_BOT") != "1":
        threading.Thread(target=bot.poll_forever, daemon=True).start()

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("=" * 60)
    print("  WO&MAN Beauty Studio server ishga tushdi")
    print(f"  Sayt:         http://localhost:{PORT}")
    print(f"  Admin panel:  http://localhost:{PORT}/admin.html")
    print(f"  Ma'lumotlar:  {storage.DATA_DIR}")
    if new_password:
        print("-" * 60)
        print(f"  ADMIN PAROLI: {new_password}")
        print("  (Faqat hozir ko'rsatiladi — yozib qo'ying!)")
    print("=" * 60, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer to'xtatildi.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] in ("--parol", "--password"):
        sys.exit(set_password_command(sys.argv[2:]))
    main()
