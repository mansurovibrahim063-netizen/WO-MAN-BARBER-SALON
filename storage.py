"""
WO&MAN Beauty Studio - shared JSON storage.

Live data (bookings, staff, bot settings) lives in DATA_DIR (default: ./data),
which is git-ignored so real client names and phone numbers never get committed.
On first start the staff list is seeded from ./specialists.json.

Every read-modify-write goes through `lock` so the web server threads and the
Telegram bot thread never overwrite each other's changes.
"""

import json
import os
import shutil
import tempfile
import threading

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("WOMAN_DATA_DIR") or os.path.join(BASE_DIR, "data")

APPOINTMENTS = "appointments.json"
SPECIALISTS = "specialists.json"
CONFIG = "bot_config.json"

lock = threading.RLock()


def _path(name):
    return os.path.join(DATA_DIR, name)


def ensure_data_dir():
    """Create DATA_DIR and seed it on first run."""
    with lock:
        os.makedirs(DATA_DIR, exist_ok=True)
        seed_specs = os.path.join(BASE_DIR, SPECIALISTS)
        if not os.path.exists(_path(SPECIALISTS)):
            if os.path.exists(seed_specs):
                shutil.copyfile(seed_specs, _path(SPECIALISTS))
            else:
                write_json(SPECIALISTS, [])
        if not os.path.exists(_path(APPOINTMENTS)):
            write_json(APPOINTMENTS, [])
        if not os.path.exists(_path(CONFIG)):
            write_json(CONFIG, {})


def read_json(name, default):
    with lock:
        try:
            with open(_path(name), "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return default


def write_json(name, data):
    """Atomic write: a crash mid-write never leaves a half-written file."""
    with lock:
        os.makedirs(DATA_DIR, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=".tmp-", dir=DATA_DIR)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp, _path(name))
        except BaseException:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise


def load_appointments():
    data = read_json(APPOINTMENTS, [])
    return data if isinstance(data, list) else []


def save_appointments(items):
    write_json(APPOINTMENTS, items)


def load_specialists():
    data = read_json(SPECIALISTS, [])
    return data if isinstance(data, list) else []


def save_specialists(items):
    write_json(SPECIALISTS, items)


def load_config():
    data = read_json(CONFIG, {})
    return data if isinstance(data, dict) else {}


def save_config(cfg):
    write_json(CONFIG, cfg)


def update_config(**changes):
    with lock:
        cfg = load_config()
        cfg.update(changes)
        save_config(cfg)
        return cfg
