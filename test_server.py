#!/usr/bin/env python3
"""Quick HTTP response test for local web server"""
import sys
import http.server
import socketserver
import threading
import urllib.request
import time
import os

DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIR)

PORT = 8765

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

httpd = socketserver.TCPServer(("", PORT), QuietHandler)
server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()

time.sleep(0.5)

endpoints = [
    "/index.html",
    "/admin.html",
    "/styles.css",
    "/app.js",
    "/admin.js",
    "/translations.js",
    "/specialists.json",
    "/appointments.json"
]

all_ok = True
for ep in endpoints:
    url = f"http://localhost:{PORT}{ep}"
    try:
        req = urllib.request.urlopen(url, timeout=5)
        code = req.getcode()
        size = len(req.read())
        print(f"[HTTP {code}] {ep} ({size} bytes) - OK")
    except Exception as e:
        print(f"[ERROR] {ep}: {e}")
        all_ok = False

httpd.shutdown()

if all_ok:
    print("\n[ALL HTTP ASSETS SERVED WITH STATUS 200 OK]")
else:
    sys.exit(1)
