#!/usr/bin/env python3
"""
WO&MAN Beauty Studio - HTTP/API tests for server.py.

Starts server.py on a spare port with a temporary data folder and checks the
website files, the booking API, the admin password and the private files.
Run:  python test_server.py
"""

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

DIR = os.path.dirname(os.path.abspath(__file__))
PASSWORD = "test-parol-123"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


PORT = free_port()
BASE = f"http://127.0.0.1:{PORT}"


def request(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if resp.headers.get_content_type() == "application/json" else raw)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


failures = 0


def check(cond, msg):
    global failures
    print(("[PASS] " if cond else "[FAIL] ") + msg)
    if not cond:
        failures += 1


def main():
    tmp = tempfile.mkdtemp(prefix="woman-srv-")
    env = dict(os.environ, PORT=str(PORT), HOST="127.0.0.1", WOMAN_DATA_DIR=tmp,
               WOMAN_ADMIN_PASSWORD=PASSWORD, WOMAN_DISABLE_BOT="1")
    env.pop("WOMAN_BOT_TOKEN", None)
    proc = subprocess.Popen([sys.executable, os.path.join(DIR, "server.py")], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(BASE + "/", timeout=1)
                break
            except Exception:
                time.sleep(0.1)

        print("\n--- Website files ---")
        for path in ["/", "/index.html", "/admin.html", "/styles.css", "/app.js", "/admin.js",
                     "/translations.js", "/site-config.js", "/assets/logo.png"]:
            status, _ = request("GET", path)
            check(status == 200, f"GET {path} -> {status}")

        print("\n--- Private files are not served ---")
        for path in ["/specialists.json", "/data/appointments.json", "/data/bot_config.json", "/server.py",
                     "/bot.py", "/.git/config", "/assets/..%2Fserver.py", "/README.md"]:
            status, _ = request("GET", path)
            check(status == 404, f"GET {path} -> {status}")

        print("\n--- Public booking API ---")
        status, specs = request("GET", "/api/public/specialists")
        check(status == 200 and len(specs) > 0, "public staff list loads")
        check(all("phone" not in s and "chatId" not in s and "linkCode" not in s for s in specs),
              "public staff list hides phones, chat ids and link codes")
        spec = next(s for s in specs if s["onDuty"])
        day = (date.today() + timedelta(days=2)).isoformat()
        booking = {"salon": spec["salon"], "specialistId": spec["id"], "date": day, "timeSlot": "1:00 PM",
                   "clientName": "Test Mijoz", "clientPhone": "+998 90 123 45 67", "serviceTitle": "Soch"}

        status, res = request("POST", "/api/bookings", booking)
        check(status == 201 and res.get("id", "").startswith("WM-"), f"booking created -> {status} {res}")
        status, res = request("POST", "/api/bookings", booking)
        check(status == 409, "same master + date + time cannot be booked twice")
        status, res = request("GET", f"/api/public/busy?date={day}")
        check(res["busy"].get(spec["id"]) == ["1:00 PM"], "busy slots show the booked time (no client data)")

        bad_cases = {
            "bad phone": {**booking, "timeSlot": "4:00 PM", "clientPhone": "abc"},
            "empty name": {**booking, "timeSlot": "4:00 PM", "clientName": ""},
            "past date": {**booking, "timeSlot": "4:00 PM", "date": "2020-01-01"},
            "unknown slot": {**booking, "timeSlot": "3:33 AM"},
            "unknown master": {**booking, "timeSlot": "4:00 PM", "specialistId": "nobody"},
        }
        for name, body in bad_cases.items():
            status, _ = request("POST", "/api/bookings", body)
            check(status == 400, f"rejects {name} -> {status}")

        print("\n--- Admin API ---")
        status, _ = request("GET", "/api/admin/appointments")
        check(status == 401, "admin data needs a login")
        status, _ = request("POST", "/api/admin/login", {"password": "wrong"})
        check(status == 401, "wrong password rejected")
        status, res = request("POST", "/api/admin/login", {"password": PASSWORD})
        token = res.get("token")
        check(status == 200 and token, "correct password gives a session")

        status, appts = request("GET", "/api/admin/appointments", token=token)
        check(status == 200 and len(appts) == 1 and appts[0]["clientName"] == "Test Mijoz", "admin sees the website booking")
        status, res = request("PATCH", f"/api/admin/appointments/{appts[0]['id']}", {"status": "Confirmed"}, token)
        check(status == 200 and res["status"] == "Confirmed", "admin confirms a booking")
        status, _ = request("PATCH", f"/api/admin/appointments/{appts[0]['id']}", {"status": "Hacked"}, token)
        check(status == 400, "invalid status rejected")

        status, new_spec = request("POST", "/api/admin/specialists",
                                   {"name": "Yangi Usta", "role": "Barber", "salon": "homme", "onDuty": True}, token)
        check(status == 201 and new_spec["id"].startswith("sp-"), "admin adds a master")
        status, res = request("PUT", f"/api/admin/specialists/{new_spec['id']}",
                              {"name": "Yangi Usta", "role": "Barber", "salon": "homme", "onDuty": False}, token)
        check(status == 200 and res["onDuty"] is False, "admin edits a master")
        status, _ = request("POST", "/api/admin/specialists",
                            {"name": "X", "role": "Y", "salon": "homme", "img": "javascript:alert(1)"}, token)
        check(status == 400, "unsafe image link rejected")
        status, _ = request("DELETE", f"/api/admin/specialists/{new_spec['id']}", token=token)
        check(status == 200, "admin deletes a master")

        status, tg = request("GET", "/api/admin/telegram", token=token)
        check(status == 200 and tg["tokenSet"] is False and "bot_token" not in tg, "telegram status never returns the token")

        status, _ = request("POST", "/api/admin/logout", {}, token)
        status, _ = request("GET", "/api/admin/appointments", token=token)
        check(status == 401, "session ends after logout")
    finally:
        proc.terminate()
        proc.wait(timeout=5)

    print()
    if failures:
        print(f"{failures} CHECK(S) FAILED")
        sys.exit(1)
    print("ALL SERVER CHECKS PASSED")


if __name__ == "__main__":
    main()
