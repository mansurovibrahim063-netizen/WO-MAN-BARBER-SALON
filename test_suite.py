#!/usr/bin/env python3
"""
WO&MAN Beauty Studio - static checks + Telegram bot logic.

Run:  python test_suite.py
The bot tests use a temporary data folder, so real bookings are never touched.
"""

import json
import os
import re
import sys
import tempfile

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

DIR = os.path.dirname(os.path.abspath(__file__))
TMP = tempfile.mkdtemp(prefix="woman-test-")
os.environ["WOMAN_DATA_DIR"] = TMP
os.environ.pop("WOMAN_BOT_TOKEN", None)
sys.path.insert(0, DIR)


def assert_true(cond, msg):
    if not cond:
        print(f"[FAIL] {msg}")
        sys.exit(1)
    print(f"[PASS] {msg}")


def read(name):
    with open(os.path.join(DIR, name), "r", encoding="utf-8") as f:
        return f.read()


def test_file_integrity():
    print("\n--- Test 1: Files & seed data ---")
    for f in ["index.html", "admin.html", "app.js", "admin.js", "styles.css", "translations.js",
              "site-config.js", "server.py", "bot.py", "storage.py", "specialists.json",
              "assets/logo.png", "assets/favicon.png", "TELEGRAM_BOT_GUIDE.md"]:
        path = os.path.join(DIR, f)
        assert_true(os.path.exists(path) and os.path.getsize(path) > 0, f"exists: {f}")

    specs = json.loads(read("specialists.json"))
    assert_true(isinstance(specs, list) and len(specs) >= 1, f"specialists.json has {len(specs)} entries")
    for s in specs:
        assert_true(all(k in s for k in ("id", "name", "salon")), f"specialist valid: {s.get('name')}")
        assert_true(not s.get("chatId"), f"seed has no real Telegram chat id: {s.get('name')}")


def test_html_components():
    print("\n--- Test 2: HTML hooks & branding ---")
    html = read("index.html")
    assert_true('data-lang="uz"' in html and 'data-lang="ru"' in html, "index.html: uz/ru")
    assert_true('data-lang="en"' not in html and 'data-lang="en"' not in read("admin.html"), "no English switch")
    assert_true("admin.html" in html, "index.html links the admin panel (footer)")
    assert_true("bookingModal" in html and "clientNameInput" in html and "clientPhoneInput" in html, "index.html: booking form")
    assert_true("assets/logo.png" in html, "index.html uses the WO&MAN logo")
    assert_true("site-config.js" in html, "index.html loads site-config.js")
    assert_true("VSMBarbershopBot" not in html, "index.html: no old VSM bot links")
    app = read("app.js")
    for price in ("60000", "100000", "400000"):
        assert_true(f"price: {price}" in app, f"price list in app.js has {price}")
    assert_true("daqiqa" not in html and "daq<" not in html, "index.html shows prices, not durations")

    admin = read("admin.html")
    for hook in ["viewAppointments", "viewSpecialists", "viewTelegram", "barberModal", "tgBotTokenInput",
                 "barberLinkingList", "loginOverlay", "loginPassword", "btnLogout", "tgAdminLinkBox"]:
        assert_true(hook in admin, f"admin.html has #{hook}")
    assert_true("noindex" in admin, "admin.html is hidden from search engines")

    ids = set(re.findall(r'id="([^"]+)"', admin))
    used = set(re.findall(r"getElementById\('([^']+)'\)", read("admin.js")))
    missing = sorted(used - ids)
    assert_true(not missing, f"every element admin.js looks up exists in admin.html {missing or ''}")


def test_translations():
    print("\n--- Test 3: Translations ---")
    content = read("translations.js")
    assert_true("WOMAN_TRANSLATIONS" in content, "translations.js defines WOMAN_TRANSLATIONS")
    assert_true("uz:" in content and "ru:" in content and "\n  en: {" not in content, "uz/ru present, English removed")
    keys = {}
    for lang in ("uz", "ru"):
        block = re.search(rf"\n  {lang}: \{{(.*?)\n  \}}", content, re.S).group(1)
        keys[lang] = set(re.findall(r"^\s{4}(\w+):", block, re.M))
    assert_true(keys["uz"] == keys["ru"], "Uzbek and Russian have the same keys")


def test_bot_logic():
    print("\n--- Test 4: Telegram bot logic (temporary data) ---")
    import storage
    import bot

    storage.ensure_data_dir()
    bot.ensure_link_codes()
    specs = storage.load_specialists()
    assert_true(len(specs) > 0 and all(s.get("linkCode") for s in specs), "every master gets a private link code")

    sent = []
    bot.api_call = lambda method, payload=None, token=None, timeout=30: sent.append((method, payload)) or {"ok": True, "result": {}}
    bot.get_token = lambda: "123456:TEST"

    m1 = specs[0]
    # A stranger cannot claim a master by guessing
    bot.handle_update({"message": {"chat": {"id": 555}, "text": f"/start b_{m1['id']}_wrongcode", "from": {}}})
    assert_true(bot.find_barber_by_chat_id(555) is None, "wrong link code does not link a chat")

    # The real private link works
    bot.handle_update({"message": {"chat": {"id": 777}, "text": f"/start b_{m1['id']}_{m1['linkCode']}", "from": {"username": "m1"}}})
    assert_true(bot.find_barber_by_chat_id(777)["id"] == m1["id"], "private link links the master's chat")

    # Admin chat link
    code = storage.load_config()["admin_link_code"]
    bot.handle_update({"message": {"chat": {"id": 999}, "text": f"/start admin_{code}", "from": {}}})
    assert_true(storage.load_config().get("admin_chat_id") == "999", "admin link sets the admin chat")

    appt = {"id": "WM-11111", "clientName": "Ali <b>&", "clientPhone": "+998 90 123 45 67", "salon": m1["salon"],
            "serviceTitle": "Soch", "specialistId": m1["id"], "specialistName": m1["name"],
            "date": "2030-01-02", "timeSlot": "10:00 AM", "status": "Pending"}
    storage.save_appointments([appt])
    sent.clear()
    bot.notify_new_booking(appt)
    chats = sorted(str(p["chat_id"]) for m, p in sent if m == "sendMessage")
    assert_true(chats == ["777", "999"], "new booking goes to the master and the admin")
    master_msg = next(p for m, p in sent if m == "sendMessage" and str(p["chat_id"]) == "777")
    assert_true("Ali &lt;b&gt;&amp;" in master_msg["text"], "client text is HTML-escaped for Telegram")
    assert_true(master_msg["reply_markup"]["inline_keyboard"][0][0]["callback_data"] == "accept_WM-11111", "accept button present")

    # Another chat cannot accept someone else's booking
    bot.handle_update({"callback_query": {"id": "c1", "message": {"chat": {"id": 555}, "message_id": 1}, "data": "accept_WM-11111"}})
    assert_true(storage.load_appointments()[0]["status"] == "Pending", "stranger cannot accept the booking")

    bot.handle_update({"callback_query": {"id": "c2", "message": {"chat": {"id": 777}, "message_id": 1}, "data": "accept_WM-11111"}})
    saved = storage.load_appointments()[0]
    assert_true(saved["status"] == "Confirmed" and saved["acceptedBy"] == m1["name"], "master accepts -> Confirmed")

    bot.handle_update({"callback_query": {"id": "c3", "message": {"chat": {"id": 777}, "message_id": 1}, "data": "accept_WM-00000"}})
    assert_true(True, "unknown booking id is handled without crashing")


def test_old_sample_staff_is_replaced():
    print("\n--- Test 5: old sample staff in an existing data folder is replaced ---")
    import subprocess
    tmp = tempfile.mkdtemp(prefix="woman-migrate-")
    old_samples = [
        {"id": "sp-m1", "name": "Marcus Vance", "role": "Master Fade Specialist", "salon": "homme", "onDuty": True, "linkCode": "abc"},
        {"id": "sp-f1", "name": "Elena Rostova", "role": "Creative Color Director", "salon": "femme", "onDuty": True},
        {"id": "sp-own1", "name": "Dilnoza", "role": "Stilist", "salon": "femme", "onDuty": True},
    ]
    with open(os.path.join(tmp, "specialists.json"), "w", encoding="utf-8") as f:
        json.dump(old_samples, f)
    code = "import storage; storage.ensure_data_dir(); import json; print(json.dumps([s['name'] for s in storage.load_specialists()]))"
    out = subprocess.run([sys.executable, "-c", code], cwd=DIR, capture_output=True, text=True,
                         env=dict(os.environ, WOMAN_DATA_DIR=tmp)).stdout.strip()
    names = json.loads(out or "[]")
    assert_true("Marcus Vance" not in names and "Elena Rostova" not in names, f"sample staff removed {names}")
    assert_true(all(n in names for n in ("Akrom", "Axror", "Jamoliddin")), "real barbers added to the existing data folder")
    assert_true("Dilnoza" in names, "masters added in the admin panel are kept")


if __name__ == "__main__":
    test_file_integrity()
    test_html_components()
    test_translations()
    test_bot_logic()
    test_old_sample_staff_is_replaced()
    print("\n=======================================================")
    print("ALL TESTS PASSED")
    print("=======================================================")
