#!/usr/bin/env python3
"""
WO&MAN Beauty Studio - Telegram bot for staff (masters) and the salon admin.

What it does:
- Sends every new booking to the chosen master (with Accept / Decline buttons)
  and to the admin chat.
- Masters link their Telegram with a private link from the admin panel
  (/start b_<id>_<code>). Nobody can pick a master's name and read their clients.
- The admin links the admin chat the same way (/start admin_<code>).
- Masters can see today's / tomorrow's queue and switch on/off duty.

Normally this runs inside server.py (one process). Pure Python 3 standard library.
"""

import html
import json
import os
import secrets
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

import storage

BRAND_HTML = "WO&amp;MAN"
TZ = timezone(timedelta(hours=int(os.environ.get("WOMAN_TZ_OFFSET_HOURS", "5"))))  # Tashkent

_bot_username = None


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def esc(value):
    return html.escape(str(value if value is not None else ""), quote=False)


# --------------------------------------------------------------------------
# Telegram API
# --------------------------------------------------------------------------
def get_token():
    return (os.environ.get("WOMAN_BOT_TOKEN") or storage.load_config().get("bot_token") or "").strip()


def api_call(method, payload=None, token=None, timeout=30):
    token = token or get_token()
    if not token:
        return None
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = json.dumps(payload or {}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            log(f"Telegram API error ({method}): HTTP {e.code}")
            return None
    except Exception as e:
        log(f"Telegram API error ({method}): {e}")
        return None


def get_me(token=None):
    """Returns the bot's @username, or None if the token is missing/invalid."""
    global _bot_username
    resp = api_call("getMe", token=token, timeout=15)
    if resp and resp.get("ok"):
        if token is None or token == get_token():
            _bot_username = resp["result"]["username"]
        return resp["result"]["username"]
    return None


def bot_username():
    return _bot_username


def send_message(chat_id, text, reply_markup=None):
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return api_call("sendMessage", payload)


def edit_message(chat_id, message_id, text):
    return api_call("editMessageText", {"chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML"})


def answer_callback(callback_query_id, text, show_alert=False):
    return api_call("answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text, "show_alert": show_alert})


# --------------------------------------------------------------------------
# Private link codes (so only the real master / admin can link a chat)
# --------------------------------------------------------------------------
def ensure_link_codes():
    with storage.lock:
        specs = storage.load_specialists()
        changed = False
        for s in specs:
            if not s.get("linkCode"):
                s["linkCode"] = secrets.token_hex(6)
                changed = True
        if changed:
            storage.save_specialists(specs)
        cfg = storage.load_config()
        if not cfg.get("admin_link_code"):
            storage.update_config(admin_link_code=secrets.token_hex(8))


def barber_link(spec):
    if not _bot_username or not spec.get("linkCode"):
        return ""
    return f"https://t.me/{_bot_username}?start=b_{spec['id']}_{spec['linkCode']}"


def admin_link():
    code = storage.load_config().get("admin_link_code")
    if not _bot_username or not code:
        return ""
    return f"https://t.me/{_bot_username}?start=admin_{code}"


def find_barber_by_chat_id(chat_id):
    for s in storage.load_specialists():
        if str(s.get("chatId", "")) == str(chat_id):
            return s
    return None


def is_admin_chat(chat_id):
    admin_id = str(storage.load_config().get("admin_chat_id", "")).strip()
    return bool(admin_id) and admin_id == str(chat_id)


# --------------------------------------------------------------------------
# Booking notifications
# --------------------------------------------------------------------------
def booking_text(appt, title):
    return (
        f"{title}\n\n"
        f"🆔 <b>ID:</b> <code>{esc(appt.get('id'))}</code>\n"
        f"👤 <b>Mijoz:</b> {esc(appt.get('clientName'))} ({esc(appt.get('clientPhone'))})\n"
        f"✂️ <b>Xizmat:</b> {esc(appt.get('serviceTitle'))}\n"
        f"💇 <b>Usta:</b> {esc(appt.get('specialistName'))}\n"
        f"📅 <b>Sana:</b> {esc(appt.get('date'))}\n"
        f"⏰ <b>Vaqt:</b> <b>{esc(appt.get('timeSlot'))}</b>\n"
        f"📝 <b>Izoh:</b> {esc(appt.get('notes') or '—')}"
    )


def notify_new_booking(appt):
    """Send a new booking to its master and to the admin chat. Never raises."""
    try:
        if not get_token():
            return
        phone = "".join(ch for ch in str(appt.get("clientPhone", "")) if ch.isdigit() or ch == "+")
        barber = next((s for s in storage.load_specialists() if s.get("id") == appt.get("specialistId")), None)

        if barber and barber.get("chatId"):
            keyboard = {"inline_keyboard": [[
                {"text": "✅ Qabul qilish", "callback_data": f"accept_{appt['id']}"},
                {"text": "❌ Rad etish", "callback_data": f"decline_{appt['id']}"},
            ]]}
            text = booking_text(appt, "🚨 <b>YANGI BUYURTMA! / НОВАЯ ЗАПИСЬ!</b>")
            if phone:
                text += f"\n📞 <b>Qo'ng'iroq:</b> {esc(phone)}"
            send_message(barber["chatId"], text + "\n\n<i>Qabul qilasizmi?</i>", keyboard)

        admin_id = str(storage.load_config().get("admin_chat_id", "")).strip()
        if admin_id and not (barber and str(barber.get("chatId")) == admin_id):
            note = "" if (barber and barber.get("chatId")) else "\n\n⚠️ <i>Bu usta Telegram'ga ulanmagan — mijozga o'zingiz qo'ng'iroq qiling.</i>"
            send_message(admin_id, booking_text(appt, f"🔔 <b>{BRAND_HTML}: yangi buyurtma</b>") + note)
    except Exception as e:  # notifications must never break a booking
        log(f"notify_new_booking failed: {e}")


# --------------------------------------------------------------------------
# Update handling
# --------------------------------------------------------------------------
def show_barber_menu(chat_id, text):
    send_message(chat_id, text, {
        "keyboard": [[{"text": "📋 Bugungi navbatim"}, {"text": "📅 Ertangi navbatim"}],
                     [{"text": "🟢 Navbatchilik holati"}]],
        "resize_keyboard": True,
    })


def show_barber_schedule(chat_id, barber, date_str):
    appts = [a for a in storage.load_appointments()
             if a.get("specialistId") == barber["id"] and a.get("date") == date_str and a.get("status") != "Cancelled"]
    if not appts:
        send_message(chat_id, f"📅 <b>{esc(date_str)}</b>: hozircha yozilgan mijozlar yo'q.")
        return
    report = f"📋 <b>{esc(barber['name'])} — {esc(date_str)}</b>\n\n"
    for idx, a in enumerate(appts, 1):
        icon = "✅" if a.get("status") == "Confirmed" else "⏳"
        report += (f"<b>{idx}. {esc(a.get('timeSlot'))}</b> — {icon} {esc(a.get('clientName'))}\n"
                   f"   ✂️ {esc(a.get('serviceTitle'))}\n   📞 {esc(a.get('clientPhone'))}\n\n")
    send_message(chat_id, report)


def link_barber(spec_id, code, chat_id, username):
    with storage.lock:
        specs = storage.load_specialists()
        for s in specs:
            if s.get("id") == spec_id and s.get("linkCode") and secrets.compare_digest(s["linkCode"], code):
                s["chatId"] = str(chat_id)
                if username:
                    s["telegram"] = f"@{username}"
                storage.save_specialists(specs)
                return s
    return None


def handle_start(chat_id, text, username):
    parts = text.split(maxsplit=1)
    param = parts[1].strip() if len(parts) > 1 else ""

    if param.startswith("admin_"):
        code = storage.load_config().get("admin_link_code", "")
        if code and secrets.compare_digest(code, param[len("admin_"):]):
            storage.update_config(admin_chat_id=str(chat_id))
            send_message(chat_id, f"✅ <b>{BRAND_HTML} admin chati ulandi.</b>\nEndi barcha yangi buyurtmalar shu yerga keladi.")
        else:
            send_message(chat_id, "❌ Havola noto'g'ri yoki eskirgan. Admin paneldan yangi havolani oling.")
        return

    if param.startswith("b_") and "_" in param[2:]:
        spec_id, code = param[2:].rsplit("_", 1)
        barber = link_barber(spec_id, code, chat_id, username)
        if barber:
            show_barber_menu(chat_id, (
                f"💈 <b>Xush kelibsiz, {esc(barber['name'])}!</b>\n\n"
                f"Siz <b>{BRAND_HTML}</b> tizimiga ulandingiz. Saytdan sizga yozilgan mijozlar shu yerga keladi — "
                f"bir tegishda qabul qilasiz yoki rad etasiz."))
        else:
            send_message(chat_id, "❌ Havola noto'g'ri yoki eskirgan. Admin'dan yangi havola so'rang.")
        return

    barber = find_barber_by_chat_id(chat_id)
    if barber:
        show_barber_menu(chat_id, f"💈 <b>Salom, {esc(barber['name'])}!</b>")
    elif is_admin_chat(chat_id):
        send_message(chat_id, f"✅ Bu {BRAND_HTML} admin chati. Yangi buyurtmalar shu yerga keladi.")
    else:
        send_message(chat_id, (
            f"💈 <b>{BRAND_HTML} — ustalar boti</b>\n\n"
            "Bu bot faqat salon ustalari uchun. Ulanish uchun admin bergan shaxsiy havoladan foydalaning.\n\n"
            "Mijozmisiz? Saytimiz orqali yoziling."))


def handle_callback(cq):
    chat_id = cq["message"]["chat"]["id"]
    msg_id = cq["message"]["message_id"]
    data = cq.get("data", "")
    action, _, appt_id = data.partition("_")
    if action not in ("accept", "decline") or not appt_id:
        answer_callback(cq["id"], "Noma'lum amal")
        return

    barber = find_barber_by_chat_id(chat_id)
    with storage.lock:
        appts = storage.load_appointments()
        appt = next((a for a in appts if a.get("id") == appt_id), None)
        if not appt:
            answer_callback(cq["id"], "Buyurtma topilmadi", show_alert=True)
            return
        allowed = is_admin_chat(chat_id) or (barber and barber.get("id") == appt.get("specialistId"))
        if not allowed:
            answer_callback(cq["id"], "Bu buyurtma sizga tegishli emas", show_alert=True)
            return
        who = barber["name"] if barber else "Admin"
        if action == "accept":
            appt["status"] = "Confirmed"
            appt["acceptedBy"] = who
        else:
            appt["status"] = "Cancelled"
            appt["declinedBy"] = who
        appt["updatedAt"] = datetime.now(timezone.utc).isoformat()
        storage.save_appointments(appts)

    if action == "accept":
        answer_callback(cq["id"], "✅ Qabul qilindi!")
        edit_message(chat_id, msg_id, booking_text(appt, f"✅ <b>QABUL QILINDI</b> ({esc(who)})"))
    else:
        answer_callback(cq["id"], "❌ Rad etildi")
        edit_message(chat_id, msg_id, booking_text(appt, f"❌ <b>RAD ETILDI</b> ({esc(who)})") + "\n\n<i>Vaqt sloti bo'shatildi.</i>")


def handle_update(update):
    if "callback_query" in update:
        handle_callback(update["callback_query"])
        return
    msg = update.get("message")
    if not msg:
        return
    chat_id = msg["chat"]["id"]
    text = (msg.get("text") or "").strip()
    username = msg.get("from", {}).get("username", "")

    if text.startswith("/start"):
        handle_start(chat_id, text, username)
        return

    barber = find_barber_by_chat_id(chat_id)
    if not barber:
        if not is_admin_chat(chat_id):
            send_message(chat_id, "Bu bot faqat salon ustalari uchun. Admin bergan havola orqali ulaning.")
        return

    today = datetime.now(TZ).date()
    if text in ("📋 Bugungi navbatim", "/today"):
        show_barber_schedule(chat_id, barber, today.isoformat())
    elif text in ("📅 Ertangi navbatim", "/tomorrow"):
        show_barber_schedule(chat_id, barber, (today + timedelta(days=1)).isoformat())
    elif text in ("🟢 Navbatchilik holati", "/status"):
        with storage.lock:
            specs = storage.load_specialists()
            on = barber.get("onDuty", True)
            for s in specs:
                if s["id"] == barber["id"]:
                    s["onDuty"] = not s.get("onDuty", True)
                    on = s["onDuty"]
            storage.save_specialists(specs)
        send_message(chat_id, "Holatingiz: <b>" + ("🟢 Ishdasiz" if on else "🔴 Dam olishdasiz") + "</b>")
    else:
        show_barber_menu(chat_id, "Kerakli bo'limni tanlang:")


# --------------------------------------------------------------------------
# Polling loop (runs in a background thread of server.py)
# --------------------------------------------------------------------------
def poll_forever(stop_event=None):
    offset = 0
    active_token = None
    while not (stop_event and stop_event.is_set()):
        token = get_token()
        if not token:
            time.sleep(5)
            continue
        if token != active_token:
            active_token, offset = token, 0
            name = get_me(token)
            if name:
                log(f"Telegram bot ulandi: @{name}")
            else:
                log("Telegram bot tokeni noto'g'ri — admin paneldan tekshiring.")
                time.sleep(30)
                active_token = None
                continue
        resp = api_call("getUpdates", {"offset": offset, "timeout": 20,
                                       "allowed_updates": ["message", "callback_query"]}, token=token)
        if not resp or not resp.get("ok"):
            if resp and resp.get("error_code") == 409:
                log("Boshqa joyda ham shu bot ishlayapti (409). Faqat server.py ni ishga tushiring.")
            time.sleep(5)
            continue
        for item in resp.get("result", []):
            offset = item["update_id"] + 1
            try:
                handle_update(item)
            except Exception as e:
                log(f"Update error: {e}")


if __name__ == "__main__":
    storage.ensure_data_dir()
    ensure_link_codes()
    if not get_token():
        print("Bot tokeni yo'q. WOMAN_BOT_TOKEN ni o'rnating yoki admin paneldan kiriting.")
        print("Odatda botni alohida emas, `python server.py` orqali ishga tushiring.")
    else:
        poll_forever()
