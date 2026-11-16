# WO&MAN — Telegram botni ulash

Bot **ustalar va admin** uchun. Mijoz saytda yozilganda:

- tanlangan ustaning Telegram'iga xabar keladi, unda **✅ Qabul qilish** va **❌ Rad etish** tugmalari bo'ladi;
- admin chatiga ham nusxa keladi;
- usta tugmani bossa, holat admin panelda ham yangilanadi.

Bot alohida ishga tushirilmaydi, u `server.py` ichida ishlaydi.

---

## 🇺🇿 O'zbekcha

### 1. Bot yaratish (bir marta)
1. Telegram'da [@BotFather](https://t.me/BotFather) ni oching.
2. `/newbot` yuboring, nom va username bering (masalan `woman_studio_bot`).
3. BotFather bergan tokenni nusxalang (`7123456789:AAF...` ko'rinishida).

### 2. Tokenni saytga kiritish
1. Serverni ishga tushiring (`python server.py`) va `http://localhost:8000/admin.html` ni oching.
2. Admin parol bilan kiring.
3. **🤖 Telegram Bot** bo'limida tokenni joylang va **Saqlash** ni bosing.
4. Holat **🟢 Ulangan: @bot_nomi** bo'lishi kerak.

Token faqat serverda saqlanadi, sayt mijozlariga ko'rinmaydi.

### 3. Admin chatini ulash
Shu bo'limda **admin havolasi** paydo bo'ladi. Uni o'zingizning Telegram'ingizda oching va **Start** ni bosing. Endi barcha yangi buyurtmalar sizga ham keladi.

### 4. Ustalarni ulash
Har bir usta uchun **shaxsiy havola** bor (`📋 Havolani Nusxalash`). Havolani faqat o'sha ustaga yuboring. U havolani ochib **Start** ni bossa, ulanadi.

Havolada maxfiy kod bor, shuning uchun begona odam o'zini usta deb ko'rsatib mijozlar ma'lumotini ololmaydi. Botni oddiy ochgan odam faqat "bu bot ustalar uchun" degan javob oladi.

### 5. Usta uchun bot buyruqlari
- **📋 Bugungi navbatim**: bugungi mijozlar ro'yxati
- **📅 Ertangi navbatim**: ertangi mijozlar ro'yxati
- **🟢 Navbatchilik holati**: ishda / dam olishda (dam olishdagi usta saytda ko'rinmaydi)

---

## 🇷🇺 Русский (кратко)

1. Создайте бота через [@BotFather](https://t.me/BotFather) → `/newbot` и скопируйте токен.
2. Запустите `python server.py`, откройте `admin.html`, войдите и вставьте токен в разделе **Telegram Bot** → **Saqlash**.
3. Откройте у себя ссылку администратора: новые записи будут приходить вам.
4. Отправьте каждому мастеру его личную ссылку. Мастер нажимает **Start** и получает свои записи с кнопками «Принять / Отклонить».
