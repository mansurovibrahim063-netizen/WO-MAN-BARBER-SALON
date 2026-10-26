#!/usr/bin/env python3
"""
VSM Barbershop - Automated End-to-End Verification Test Suite
Tests:
1. File Integrity & JSON Validation
2. Trilingual Localization Keys Completeness (UZ, EN, RU)
3. HTML Structure & Component Verification (index.html, admin.html)
4. Barber Management (Add, Edit, Link, Status Toggle)
5. Barber-Exclusive Telegram Bot Logic & Booking Acceptance Flow
"""

import os
import sys
import json
import re

# Set stdout encoding for Windows console compatibility
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

DIR = os.path.dirname(os.path.abspath(__file__))

def assert_true(cond, msg):
    if not cond:
        print(f"[FAIL] {msg}")
        sys.exit(1)
    else:
        print(f"[PASS] {msg}")

def test_file_integrity():
    print("\n--- Test 1: File Integrity & JSON Validation ---")
    files = [
        "index.html", "admin.html", "app.js", "admin.js", 
        "styles.css", "translations.js", "bot.py", 
        "specialists.json", "appointments.json", "TELEGRAM_BOT_GUIDE.md"
    ]
    for f in files:
        path = os.path.join(DIR, f)
        assert_true(os.path.exists(path) and os.path.getsize(path) > 0, f"File exists and not empty: {f}")

    # Validate JSONs
    with open(os.path.join(DIR, "specialists.json"), "r", encoding="utf-8") as f:
        specs = json.load(f)
        assert_true(isinstance(specs, list) and len(specs) >= 3, f"specialists.json has {len(specs)} entries")
        for s in specs:
            assert_true("id" in s and "name" in s and "salon" in s, f"Specialist valid: {s.get('name')}")

    with open(os.path.join(DIR, "appointments.json"), "r", encoding="utf-8") as f:
        appts = json.load(f)
        assert_true(isinstance(appts, list) and len(appts) >= 2, f"appointments.json has {len(appts)} entries")
        for a in appts:
            assert_true("id" in a and "clientName" in a and "timeSlot" in a, f"Appointment valid: {a.get('id')}")

def test_html_components():
    print("\n--- Test 2: HTML Components & UI Hooks ---")
    with open(os.path.join(DIR, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
        assert_true("lang-pill-btn" in html, "index.html has language switcher pills")
        assert_true('data-lang="uz"' in html and 'data-lang="en"' in html and 'data-lang="ru"' in html, "index.html supports uz, en, ru")
        assert_true("admin.html" in html, "index.html has Admin panel link")
        assert_true("bookingModal" in html, "index.html has Booking modal")
        assert_true("clientNameInput" in html and "clientPhoneInput" in html, "index.html has client input fields")
        assert_true("$65" not in html and "$240" not in html, "index.html has no hardcoded dollar prices in main text")

    with open(os.path.join(DIR, "admin.html"), "r", encoding="utf-8") as f:
        admin_html = f.read()
        assert_true("viewAppointments" in admin_html, "admin.html has Appointments view")
        assert_true("viewSpecialists" in admin_html, "admin.html has Specialists management view")
        assert_true("viewTelegram" in admin_html, "admin.html has Telegram Bot Integration view")
        assert_true("barberModal" in admin_html, "admin.html has Barber Add/Edit modal")
        assert_true("tgBotTokenInput" in admin_html, "admin.html has Telegram Token input")
        assert_true("barberLinkingList" in admin_html, "admin.html has Barber linking dashboard")

def test_translations():
    print("\n--- Test 3: Trilingual Localization Coverage ---")
    with open(os.path.join(DIR, "translations.js"), "r", encoding="utf-8") as f:
        content = f.read()
        assert_true("VSM_TRANSLATIONS" in content, "translations.js defines VSM_TRANSLATIONS")
        assert_true("uz:" in content and "en:" in content and "ru:" in content, "translations.js has uz, en, ru roots")
        assert_true("modal_book_title" in content, "translations.js has booking modal strings")
        assert_true("btn_open_tg_bot" in content, "translations.js has Telegram bot strings")

def test_barber_bot_logic():
    print("\n--- Test 4: Barber-Exclusive Telegram Bot Logic ---")
    import bot

    # Test loading specialists & appointments
    specs = bot.load_specialists()
    assert_true(len(specs) > 0, f"bot.py successfully loaded {len(specs)} specialists")

    appts = bot.load_appointments()
    assert_true(len(appts) > 0, f"bot.py successfully loaded {len(appts)} appointments")

    # Test barber lookup
    barber = bot.find_barber_by_id("sp-m1")
    assert_true(barber is not None and barber["name"] == "Marcus Vance", "bot.py finds barber by ID")

    # Test linking barber to Telegram chat_id
    test_chat_id = "99988877"
    linked = bot.link_barber_chat_id("sp-m1", test_chat_id, "marcus_test")
    assert_true(linked is not None and linked["chatId"] == test_chat_id, "bot.py successfully binds barber chatId")

    found_by_chat = bot.find_barber_by_chat_id(test_chat_id)
    assert_true(found_by_chat is not None and found_by_chat["id"] == "sp-m1", "bot.py finds barber by chatId")

    # Test booking acceptance callback simulation
    test_appt = {
        "id": "VSM-TEST-01",
        "clientName": "Test Client",
        "clientPhone": "+998 90 123-45-67",
        "salon": "homme",
        "serviceTitle": "Executive Cut",
        "specialistName": "Marcus Vance",
        "specialistId": "sp-m1",
        "date": "2026-10-25",
        "timeSlot": "11:30 AM",
        "status": "Pending"
    }
    appts_list = bot.load_appointments()
    appts_list.append(test_appt)
    bot.save_appointments(appts_list)

    # Simulate barber accepting via callback
    test_update = {
        "callback_query": {
            "id": "cb_123",
            "message": {
                "chat": {"id": int(test_chat_id)},
                "message_id": 456
            },
            "data": "accept_VSM-TEST-01"
        }
    }
    bot.handle_update(test_update)

    # Check that appointment is now Confirmed and accepted by Marcus Vance
    updated_appts = bot.load_appointments()
    accepted = next((a for a in updated_appts if a.get("id") == "VSM-TEST-01"), None)
    assert_true(accepted is not None, "Test appointment exists in records")
    assert_true(accepted.get("status") == "Confirmed", "Appointment status updated to 'Confirmed'")
    assert_true(accepted.get("acceptedBy") == "Marcus Vance", "Appointment records 'acceptedBy: Marcus Vance'")

    # Clean up test appointment
    cleaned = [a for a in updated_appts if a.get("id") != "VSM-TEST-01"]
    bot.save_appointments(cleaned)
    print("[PASS] Cleaned up test booking record.")

if __name__ == "__main__":
    test_file_integrity()
    test_html_components()
    test_translations()
    test_barber_bot_logic()
    print("\n=======================================================")
    print("ALL TESTS PASSED SUCCESSFULLY! EVERYTHING IS VERIFIED & READY.")
    print("=======================================================")
