# VSM Barbershop & Salon — Split-Screen Luxury Landing Page & Platform

A minimalist, visually striking luxury platform engineered for **VSM Barbershop & Salon**, incorporating split-screen Male/Female salons, trilingual localization, real-time time-slot reservation (with prices removed), an administrative operations dashboard, and a Telegram booking bot.

---

## 🌐 1. Multilingual Support (Uzbek, English, Russian)

- **Available Languages**:
  - 🇺🇿 **O'zbekcha (UZ)**: Native Uzbek localization tailored to modern Tashkent luxury aesthetics.
  - 🇬🇧 **English (EN)**: Editorial international salon and barbershop terminology.
  - 🇷🇺 **Русский (RU)**: Full Russian translation for high-end clientele.
- **Instant Reactive Switching**: A persistent language switch (`UZ | EN | RU`) updates all titles, headings, service descriptions, lookbook tags, reviews, and modals dynamically without reloading the page. Language preference is saved in `localStorage`.

---

## ⏰ 2. Time-Slot Booking System (No Prices Displayed)

- As requested, **all prices have been removed** across hero badges, service lists, lookbooks, and modals.
- Replaced with **service duration** (e.g., `45 daq / 45 mins / 45 мин`) and **real-time slot indicators**.
- **Interactive Booking Flow**:
  1. Select Sanctuary (`♂ VSM Homme` / `♀ VSM Femme`).
  2. Select Signature Service (with duration & technique overview).
  3. Select Barber or Stylist (*Marcus Vance, Julian Drake, Leo Saint, Elena Rostova, Camille Laurent, Sienna Blake*).
  4. Select Date (Today, Tomorrow, or pick from calendar).
  5. Select Available Time Slot (`10:00 AM`, `11:30 AM`, `1:00 PM`, `2:30 PM`, `4:00 PM`, `5:30 PM`, `7:00 PM`). Already booked slots are marked as busy and disabled in real time.
  6. Enter Client Name & Phone Number.
  7. Instantly issues a confirmed Booking Ticket (e.g. `VSM-2045`), synchronized with the Admin Panel and Telegram Bot database.

---

## ⚡ 3. Split-Screen System & Distinctive Blue/Pink Identity

- **Male Salon (VSM Homme)**: Electric Cobalt & Ice Blue accents (`#0066FF`, `#38BDF8`), sapphire backlighting, hot-towel straight-razor shave rituals, and whiskey lounge atmosphere.
- **Female Salon (VSM Femme)**: Vivid Fuchsia & Rose Quartz accents (`#FF2E93`, `#FB7185`), magenta backlighting, daylight-accurate optics, dimensional balayage, and prosecco bar atmosphere.
- **Fluid Lerping Split & Draggable Divider**:
  - Hovering left expands Homme to **64%**; hovering right expands Femme to **64%**.
  - The luminous center handle (`◀ ❚ ▶`) is draggable to any custom ratio (22% to 78%).
  - Navigation switcher pills (`Homme`, `Split 50/50`, `Femme`) toggle 100% immersive views.

---

## 🛡️ 4. Admin Management Panel (`admin.html`)

Access the management dashboard at:
👉 [**`admin.html`**](file:///C:/Users/User/.gemini/antigravity/scratch/vsm-barbershop/admin.html)

- **Live Analytics**:
  - Total Bookings, Homme Bookings, Femme Bookings, Today's Active Slots, Telegram Bot Bookings.
- **Appointments Table**:
  - View ID, Client Name, Phone, Sanctuary (Homme ♂ / Femme ♀), Service, Specialist, Date, Time Slot, Source (Website / Telegram Bot), and Status (`Confirmed`, `Pending`, `Completed`, `Cancelled`).
  - Search by client name, phone number, or booking ID.
  - Filter by Salon, Status, or Booking Source.
  - Quick action buttons to **Confirm**, **Complete**, or **Cancel** appointments.
- **Manual Booking Creator**:
  - Admin modal to enter phone or walk-in reservations manually.
- **Staff Roster Management**:
  - Toggle on-duty and day-off statuses for barbers and colorists.
- **Export Data**:
  - One-click JSON export for reporting and backups.
- **Trilingual Admin Interface**:
  - Also toggles seamlessly between Uzbek, English, and Russian.

---

## 🤖 5. Telegram Booking Bot (`bot.py`)

A standalone Python Telegram bot ready to connect directly to Telegram:
👉 [**`bot.py`**](file:///C:/Users/User/.gemini/antigravity/scratch/vsm-barbershop/bot.py)
👉 [**`TELEGRAM_BOT_GUIDE.md`**](file:///C:/Users/User/.gemini/antigravity/scratch/vsm-barbershop/TELEGRAM_BOT_GUIDE.md)

### Quick Run:
```powershell
cd C:\Users\User\.gemini\antigravity\scratch\vsm-barbershop
$env:VSM_BOT_TOKEN="YOUR_BOT_TOKEN_FROM_BOTFATHER"
python bot.py
```

- **Features**:
  - Interactive multi-language support (Uzbek, Russian, English).
  - Step-by-step menu for choosing salon, barber, service, date, and time slot.
  - Issues electronic booking tickets directly in Telegram.
  - Stores all bookings in `appointments.json`, synchronized with the web Admin Panel.
  - WebApp support to launch the full booking app inside Telegram.

---

## 📂 Project Structure

```
vsm-barbershop/
├── index.html              # Main trilingual landing page & slot booking UI
├── styles.css              # Custom luxury CSS with glowing Blue & Pink accents
├── app.js                  # Frontend engine, slot availability & booking logic
├── translations.js         # UZ, EN, RU localization dictionary
├── admin.html              # Operational Admin Panel for managing bookings
├── admin.js                # Admin dashboard filtering, metrics & status manager
├── appointments.json       # Shared JSON database of booked appointments
├── bot.py                  # Standalone Python Telegram Booking Bot
├── TELEGRAM_BOT_GUIDE.md   # Telegram bot setup instructions (UZ / RU / EN)
└── README.md               # Architecture documentation
```
