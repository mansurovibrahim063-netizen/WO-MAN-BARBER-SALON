# 💈 VSM Barbershop — Sartaroshlar Boti & Admin Integratsiyasi

Ushbu Telegram boti **faqat sartaroshlar va stillistlar uchun mo'ljallangan**.
Saytdan mijozlar vaqt slotini band qilganda, buyurtma to'g'ridan-to'g'ri o'sha sartaroshning Telegramiga kelib tushadi. Sartarosh bir bosish bilan buyurtmani **qabul qiladi (Accept)** yoki **rad etadi (Decline)**.

---

## 🇺🇿 O'zbekcha: Tezkor Sozlash & Ishlatish

### 1. Telegram Bot Tokenini olish
1. Telegramda [@BotFather](https://t.me/BotFather) ga kiring.
2. `/newbot` buyrug'i orqali yangi bot oching (masalan: `VSM Barbershop Staff`).
3. Berilgan HTTP API tokenni nusxalang (masalan: `7123456789:AAFlkBj...`).

### 2. Admin Panel orqali Integratsiya qilish
1. [**`admin.html`**](file:///C:/Users/User/.gemini/antigravity/scratch/vsm-barbershop/admin.html) ni oching.
2. **"🤖 Telegram Bot Integratsiyasi"** bo'limiga o'ting.
3. Bot Tokenini joylashtiring va **"⚡ Ulanishni Tekshirish"** tugmasini bosing.
4. **"Saqlash"** tugmasini bosing.

### 3. Sartaroshlarni Botga Bog'lash (1 marta qilinadi)
1. Admin panelning shu bo'limida har bir sartaroshning shaxsiy havolasi bo'ladi:
   - Marcus Vance: `https://t.me/VSMBarbershopBot?start=barber_sp-m1`
   - Julian Drake: `https://t.me/VSMBarbershopBot?start=barber_sp-m2`
   - va h.k.
2. **"📋 Havolani Nusxalash"** tugmasini bosib, sartaroshning Telegramiga yuboring.
3. Sartarosh o'sha havolani ochib, botda **`/start`** tugmasini bossa bo'ldi — uning hisobi tizimga ulanadi!

### 4. Bot qanday ishlaydi?
1. Saytda mijoz Marcus Vanceni tanlab, soat 11:30 ga vaqt band qiladi.
2. Marcusning Telegramiga xabar keladi:
   ```
   🚨 YANGI BUYURTMA!
   🆔 Buyurtma ID: VSM-2047
   👤 Mijoz: Jamshid Rahimov (+998 90 321-45-89)
   ✂️ Xizmat: Executive Precision Cut & Fade
   📅 Sana: 2026-10-25
   ⏰ Vaqt Sloti: 11:30 AM
   ```
3. Marcus **`[ ✅ Qabul qilish (Accept) ]`** tugmasini bosadi.
4. Buyurtma holati avtomatik tarzda **Confirmed** ga o'zgaradi va navbatga kiritiladi.

---

## 🇷🇺 Русский: Настройка и Работа Бота для Барберов

- Бот предназначен **исключительно для персонала и барберов**.
- Клиент бронирует время на сайте &rarr; уведомление мгновенно поступает барберу в Telegram.
- Барбер нажимает **«Принять»** или **«Отклонить»**.

### Запуск скрипта бота:
```powershell
cd C:\Users\User\.gemini\antigravity\scratch\vsm-barbershop
$env:VSM_BOT_TOKEN="ВАШ_ТОКЕН_ИЗ_BOTFATHER"
python bot.py
```

---

## 🇬🇧 English: Quick Start for Barbers Workspace

```powershell
cd C:\Users\User\.gemini\antigravity\scratch\vsm-barbershop
$env:VSM_BOT_TOKEN="YOUR_BOT_TOKEN"
python bot.py
```

- Each barber links their account via deep link: `https://t.me/VSMBarbershopBot?start=barber_sp-m1`.
- When bookings are made on the website, barbers receive instant alert notifications with action buttons.
