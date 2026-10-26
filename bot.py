#!/usr/bin/env python3
"""
VSM Barbershop & Salon - Dedicated Barber Workspace Telegram Bot
EXCLUSIVELY FOR BARBERS & STYLISTS TO ACCEPT / DECLINE CLIENT BOOKINGS

Features:
- Barber Authentication & Account Binding (/start barber_id)
- Instant Booking Dispatch with [ ✅ Qabul qilish / Accept ] & [ ❌ Rad etish / Decline ] buttons
- Live Appointment Schedule (/today, /upcoming)
- On-Duty / Off-Duty status switcher
- Shared sync with appointments.json & specialists.json
- Zero external dependencies required (Pure Python 3 standard library: urllib, json, time, os)
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
from datetime import datetime, timedelta

# Configuration
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "bot_config.json")
SPECIALISTS_FILE = os.path.join(os.path.dirname(__file__), "specialists.json")
APPOINTMENTS_FILE = os.path.join(os.path.dirname(__file__), "appointments.json")

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "bot_token": os.environ.get("VSM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE"),
        "admin_chat_id": os.environ.get("VSM_ADMIN_CHAT_ID", ""),
        "auto_notify": True
    }

def save_config(cfg):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)

config = load_config()
BOT_TOKEN = config.get("bot_token", "YOUR_BOT_TOKEN_HERE")
BASE_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

def api_call(method, payload=None):
    """Make HTTP request to Telegram Bot API without third-party dependencies."""
    url = f"{BASE_URL}/{method}"
    try:
        if payload:
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        else:
            req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Telegram API Error ({method}): {e}")
        return None

def send_message(chat_id, text, reply_markup=None, parse_mode="HTML"):
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return api_call("sendMessage", payload)

def edit_message(chat_id, message_id, text, reply_markup=None, parse_mode="HTML"):
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": parse_mode
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return api_call("editMessageText", payload)

def answer_callback(callback_query_id, text, show_alert=False):
    payload = {
        "callback_query_id": callback_query_id,
        "text": text,
        "show_alert": show_alert
    }
    return api_call("answerCallbackQuery", payload)

# Data helpers
def load_specialists():
    if os.path.exists(SPECIALISTS_FILE):
        try:
            with open(SPECIALISTS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_specialists(specialists):
    with open(SPECIALISTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(specialists, f, ensure_ascii=False, indent=2)

def load_appointments():
    if os.path.exists(APPOINTMENTS_FILE):
        try:
            with open(APPOINTMENTS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_appointments(appointments):
    with open(APPOINTMENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(appointments, f, ensure_ascii=False, indent=2)

def find_barber_by_chat_id(chat_id):
    specialists = load_specialists()
    for s in specialists:
        if str(s.get("chatId", "")) == str(chat_id):
            return s
    return None

def find_barber_by_id(b_id):
    specialists = load_specialists()
    for s in specialists:
        if s.get("id") == b_id:
            return s
    return None

def link_barber_chat_id(b_id, chat_id, username=""):
    specialists = load_specialists()
    for s in specialists:
        if s.get("id") == b_id:
            s["chatId"] = str(chat_id)
            if username:
                s["telegram"] = f"@{username}"
            save_specialists(specialists)
            return s
    return None

# Notifications to Barbers
def notify_barber_new_booking(appointment):
    """Dispatches a booking alert directly to the assigned barber's Telegram."""
    b_name = appointment.get("specialistName", "")
    b_id = appointment.get("specialistId", "")

    specialists = load_specialists()
    target_barber = None
    for s in specialists:
        if s.get("name") == b_name or s.get("id") == b_id:
            target_barber = s
            break

    if not target_barber or not target_barber.get("chatId"):
        print(f"[!] Notification skipped: Barber '{b_name}' has no registered Telegram chatId.")
        return False

    chat_id = target_barber["chatId"]
    appt_id = appointment.get("id", "VSM-0000")
    client_name = appointment.get("clientName", "")
    client_phone = appointment.get("clientPhone", "")
    service_title = appointment.get("serviceTitle", "")
    appt_date = appointment.get("date", "")
    appt_slot = appointment.get("timeSlot", "")
    notes_val = appointment.get("notes") or "Yo'q"
    phone_clean = client_phone.replace(" ", "")

    text = (
        f"🚨 <b>YANGI BUYURTMA! / НОВАЯ ЗАПИСЬ!</b>\n\n"
        f"🆔 <b>Buyurtma ID:</b> <code>{appt_id}</code>\n"
        f"👤 <b>Mijoz:</b> {client_name} ({client_phone})\n"
        f"✂️ <b>Xizmat:</b> {service_title}\n"
        f"📅 <b>Sana:</b> {appt_date}\n"
        f"⏰ <b>Vaqt Sloti:</b> <b>{appt_slot}</b>\n"
        f"📝 <b>Izoh:</b> {notes_val}\n\n"
        f"<i>Iltimos, ushbu mijozni qabul qilasizmi yoki rad etasizmi?</i>"
    )

    keyboard = {
        "inline_keyboard": [
            [
                {"text": "✅ Qabul qilish (Accept)", "callback_data": f"accept_{appt_id}"},
                {"text": "❌ Rad etish (Decline)", "callback_data": f"decline_{appt_id}"}
            ],
            [
                {"text": "📞 Mijozga qo'ng'iroq", "url": f"tel:{phone_clean}"}
            ]
        ]
    }

    resp = send_message(chat_id, text, keyboard)
    return bool(resp and resp.get("ok"))

# Handlers
def handle_update(update):
    if "message" in update:
        msg = update["message"]
        chat_id = msg["chat"]["id"]
        text = msg.get("text", "").strip()
        username = msg.get("from", {}).get("username", "")

        # 1. /start command
        if text.startswith("/start"):
            parts = text.split()
            # Deep link: /start barber_sp-m1 or /start sp-m1
            if len(parts) > 1:
                param = parts[1].replace("barber_", "")
                barber = link_barber_chat_id(param, chat_id, username)
                if barber:
                    welcome = (
                        f"💈 <b>Xush kelibsiz, {barber['name']}!</b>\n\n"
                        f"Siz muvaffaqiyatli <b>VSM Barbershop</b> tizimiga ulandingiz.\n"
                        f"Mansabingiz: <b>{barber['role']}</b>\n"
                        f"Zal: <b>{barber['salon'].upper()}</b>\n\n"
                        f"⚡ Endi saytdan tushgan barcha yangi buyurtmalar to'g'ridan-to'g'ri shu yerga yuboriladi. "
                        f"Siz ularni bir tegishda qabul qilishingiz yoki rad etishingiz mumkin!"
                    )
                    show_barber_menu(chat_id, welcome)
                    return

            # Check if this chat_id already linked to a barber
            barber = find_barber_by_chat_id(chat_id)
            if barber:
                welcome = (
                    f"💈 <b>Salom, {barber['name']}!</b>\n"
                    f"Siz VSM tizimida faol holatdasiz."
                )
                show_barber_menu(chat_id, welcome)
            else:
                # Offer list of barbers to bind
                specialists = load_specialists()
                buttons = []
                for s in specialists:
                    buttons.append([{"text": f"✂️ Men - {s['name']} ({s['role']})", "callback_data": f"bind_{s['id']}"}])

                msg_text = (
                    "💈 <b>VSM Barbershop - Sartaroshlar Boshqaruv Boti</b>\n\n"
                    "Ushbu bot <b>faqat sartaroshlar va stillistlar</b> uchun mo'ljallangan.\n"
                    "Iltimos, profilingizni tasdiqlash uchun o'z ismingizni tanlang:"
                )
                send_message(chat_id, msg_text, {"inline_keyboard": buttons})
            return

        barber = find_barber_by_chat_id(chat_id)
        if not barber:
            send_message(chat_id, "Iltimos, avval /start buyrug'ini yuborib, o'z profilingizni bog'lang.")
            return

        if text in ["📋 Bugungi navbatim", "/today"]:
            show_barber_schedule(chat_id, barber, datetime.now().strftime("%Y-%m-%d"))
            return

        if text in ["📅 Ertangi navbatim", "/tomorrow"]:
            tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
            show_barber_schedule(chat_id, barber, tomorrow)
            return

        if text in ["🟢 Navbatchilik holati", "/status"]:
            barber["onDuty"] = not barber.get("onDuty", True)
            specialists = load_specialists()
            for s in specialists:
                if s["id"] == barber["id"]:
                    s["onDuty"] = barber["onDuty"]
            save_specialists(specialists)
            status_text = "🟢 Ishdasiz (On Duty)" if barber["onDuty"] else "🔴 Dam olishdasiz (Off Duty)"
            send_message(chat_id, f"Navbatchilik holatingiz yangilandi: <b>{status_text}</b>")
            return

        if text.startswith("/simulate"):
            # Simulation command to test booking alert
            appt = {
                "id": f"VSM-{int(time.time()) % 10000}",
                "clientName": "Test Mijoz",
                "clientPhone": "+998 90 999-88-77",
                "salon": barber["salon"],
                "serviceTitle": "Executive Precision Cut & Fade",
                "specialistName": barber["name"],
                "specialistId": barber["id"],
                "date": datetime.now().strftime("%Y-%m-%d"),
                "timeSlot": "4:00 PM",
                "notes": "Test simulated booking from system"
            }
            notify_barber_new_booking(appt)
            send_message(chat_id, "✅ Test xabarnomasi yuborildi!")
            return

        show_barber_menu(chat_id, "Kerakli bo'limni tanlang:")

    elif "callback_query" in update:
        cq = update["callback_query"]
        chat_id = cq["message"]["chat"]["id"]
        msg_id = cq["message"]["message_id"]
        data = cq.get("data", "")
        cq_id = cq["id"]

        # Bind barber profile
        if data.startswith("bind_"):
            b_id = data.split("_")[1]
            username = cq.get("from", {}).get("username", "")
            barber = link_barber_chat_id(b_id, chat_id, username)
            answer_callback(cq_id, f"Profil bog'landi: {barber['name']}")
            welcome = (
                f"✅ <b>Profil muvaffaqiyatli bog'landi!</b>\n\n"
                f"Sartarosh: <b>{barber['name']}</b>\n"
                f"Mutaxassislik: <b>{barber['role']}</b>\n\n"
                f"Endi yangi buyurtmalar kelishi bilan shu yerda tasdiqlashingiz mumkin."
            )
            show_barber_menu(chat_id, welcome)
            return

        # Accept Booking
        if data.startswith("accept_"):
            appt_id = data.split("_")[1]
            appointments = load_appointments()
            appt = next((a for a in appointments if a.get("id") == appt_id), None)
            
            barber = find_barber_by_chat_id(chat_id)
            barber_name = barber["name"] if barber else "Barber"

            if appt:
                appt["status"] = "Confirmed"
                appt["acceptedBy"] = barber_name
                appt["acceptedAt"] = datetime.now().isoformat()
                save_appointments(appointments)

            answer_callback(cq_id, "✅ Buyurtma qabul qilindi!", show_alert=True)

            updated_text = (
                f"✅ <b>BUYURTMA QABUL QILINDI!</b>\n\n"
                f"🆔 <b>Buyurtma ID:</b> <code>{appt_id}</code>\n"
                f"👤 <b>Mijoz:</b> {appt.get('clientName', 'Client')} ({appt.get('clientPhone', '')})\n"
                f"✂️ <b>Xizmat:</b> {appt.get('serviceTitle', '')}\n"
                f"📅 <b>Sana:</b> {appt.get('date', '')}\n"
                f"⏰ <b>Vaqt:</b> {appt.get('timeSlot', '')}\n"
                f"👍 <b>Holat:</b> Qabul qilindi ({barber_name} tomonidan)\n\n"
                f"<i>Mijoz sizning navbatingizga qo'shildi.</i>"
            )

            edit_message(chat_id, msg_id, updated_text, None)
            return

        # Decline Booking
        if data.startswith("decline_"):
            appt_id = data.split("_")[1]
            appointments = load_appointments()
            appt = next((a for a in appointments if a.get("id") == appt_id), None)
            
            barber = find_barber_by_chat_id(chat_id)
            barber_name = barber["name"] if barber else "Barber"

            if appt:
                appt["status"] = "Cancelled"
                appt["declinedBy"] = barber_name
                save_appointments(appointments)

            answer_callback(cq_id, "❌ Buyurtma rad etildi", show_alert=True)

            updated_text = (
                f"❌ <b>BUYURTMA RAD ETILDI</b>\n\n"
                f"🆔 <b>Buyurtma ID:</b> <code>{appt_id}</code>\n"
                f"👤 <b>Mijoz:</b> {appt.get('clientName', 'Client')}\n"
                f"⏰ <b>Vaqt:</b> {appt.get('date', '')} {appt.get('timeSlot', '')}\n"
                f"⚠️ <b>Holat:</b> Bekor qilindi ({barber_name} tomonidan)\n\n"
                f"<i>Ushbu vaqt sloti qayta bo'shatildi.</i>"
            )

            edit_message(chat_id, msg_id, updated_text, None)
            return

def show_barber_menu(chat_id, message_text):
    reply_markup = {
        "keyboard": [
            [{"text": "📋 Bugungi navbatim"}, {"text": "📅 Ertangi navbatim"}],
            [{"text": "🟢 Navbatchilik holati"}]
        ],
        "resize_keyboard": True
    }
    send_message(chat_id, message_text, reply_markup)

def show_barber_schedule(chat_id, barber, date_str):
    appointments = load_appointments()
    appts = [
        a for a in appointments 
        if (a.get("specialistName") == barber["name"] or a.get("specialistId") == barber["id"])
        and a.get("date") == date_str
        and a.get("status") != "Cancelled"
    ]

    if not appts:
        send_message(chat_id, f"📅 <b>{date_str}</b> sanasida hozircha yozilgan mijozlar yo'q.")
        return

    report = f"📋 <b>{barber['name']} — {date_str} navbati:</b>\n\n"
    for idx, a in enumerate(appts, 1):
        status_icon = "✅" if a.get("status") == "Confirmed" else "⏳"
        report += (
            f"<b>{idx}. {a.get('timeSlot')}</b> — {status_icon} {a.get('clientName')}\n"
            f"   ✂️ {a.get('serviceTitle')}\n"
            f"   📞 {a.get('clientPhone')}\n"
            f"   🆔 <code>{a.get('id')}</code>\n\n"
        )

    send_message(chat_id, report)

def run_bot():
    print("=" * 65)
    print("VSM Barbershop - Barber Acceptance Bot Engine")
    print(f"Data Sources: {SPECIALISTS_FILE} | {APPOINTMENTS_FILE}")
    print("=" * 65)

    cfg = load_config()
    token = cfg.get("bot_token", "")

    if not token or token == "YOUR_BOT_TOKEN_HERE":
        print("\n[!] NOTICE: BOT_TOKEN is not configured yet.")
        print("You can set your token via:")
        print("1. Admin Panel -> 'Telegram Bot Integratsiyasi' tab")
        print("2. Or environment variable: set VSM_BOT_TOKEN=YOUR_TOKEN\n")
        print("Running in verification mode. Script loaded and verified successfully.")
        return

    print("Checking connection with Telegram Bot API...")
    me = api_call("getMe")
    if me and me.get("ok"):
        bot_user = me["result"]["username"]
        print(f"🟢 Connected successfully as @{bot_user}")
        print("Polling for barber interactions and booking acceptances...")
    else:
        print("[!] Could not connect to Telegram API with current token.")
        return

    last_update_id = 0
    while True:
        try:
            updates = api_call("getUpdates", {"offset": last_update_id + 1, "timeout": 20})
            if updates and updates.get("ok"):
                for item in updates.get("result", []):
                    last_update_id = item["update_id"]
                    handle_update(item)
            time.sleep(1)
        except KeyboardInterrupt:
            print("\nBot stopped by user.")
            break
        except Exception as e:
            print(f"Polling error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    run_bot()
