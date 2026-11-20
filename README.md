# WO&MAN — Go'zallik studiyasi / Студия красоты

Erkaklar (**MAN**) va ayollar (**WO**) zali uchun sayt, onlayn yozilish, admin panel va ustalar uchun Telegram bot.

- **Sayt** (`index.html`): xizmatlar, usta, sana va vaqtni tanlab yozilish. Ikki tilda: o'zbek va rus.
- **Admin panel** (`admin.html`): parol bilan kiriladi. Buyurtmalar, ustalar, Telegram sozlamalari.
- **Telegram bot**: har bir yangi buyurtma ustaga (Qabul / Rad tugmalari bilan) va adminga keladi.
- **Server** (`server.py`): hammasini bitta dasturda ishlatadi. Faqat Python 3 kerak, qo'shimcha o'rnatish shart emas.

---

## 1. Ishga tushirish

```bash
python server.py
```

Keyin brauzerda oching:

- Sayt: <http://localhost:8000>
- Admin panel: <http://localhost:8000/admin.html>

**Admin paroli** birinchi ishga tushirishda terminalda **bir marta** ko'rsatiladi (`ADMIN PAROLI: ...`). Uni yozib qo'ying. O'z parolingizni qo'ymoqchi bo'lsangiz:

```bash
WOMAN_ADMIN_PASSWORD="sizning-parolingiz" python server.py
```

(Windows PowerShell'da: `$env:WOMAN_ADMIN_PASSWORD="sizning-parolingiz"; python server.py`)

> ⚠️ `index.html` ni faylni ikki marta bosib ochmang. Yozilish faqat `server.py` orqali ochilganda ishlaydi.

## 2. Birinchi sozlash (5 daqiqa)

1. **Ustalar.** Erkaklar zali barberlari (Akrom, Axror, Jamoliddin) suratlari bilan qo'shilgan. Ayollar zalidagi ismlar hali namunaviy: admin panel → *Ustalarni Boshqarish* bo'limida almashtiring yoki o'chiring. Agar server avval ishga tushirilgan bo'lsa, ustalar ro'yxati `data/specialists.json` da turadi, o'zgarishlarni admin paneldan kiriting.
2. **Telegram.** `TELEGRAM_BOT_GUIDE.md` dagi qadamlarni bajaring: bot tokeni, admin havolasi, ustalar havolalari.
3. **Aloqa ma'lumotlari.** `site-config.js` faylida telefon, manzil, Instagram va Telegram'ni yozing. Bo'sh qatorlar saytda ko'rinmaydi.
4. **Xizmatlar va narxlar.** `app.js` dagi `servicesCatalog`: erkaklar zali narxlari salonning rasmiy narxlar ro'yxatidan olingan. Ayollar zali narxlari hali kiritilmagan (`price: null` → saytda "Narxini so'rang"). Narxni faqat shu yerda o'zgartirasiz: yozilish oynasi, "Xizmatlar" oynasi va bosh sahifa shu ro'yxatdan oladi. Ish vaqti (`index.html` footer) va sayt matnlari namuna sifatida yozilgan, salonga moslang.
5. **Rasmlar.** Lukbuk rasmlari namunaviy stok fotolar. Iloji bo'lsa o'z ishlaringiz rasmlari bilan almashtiring. "Mijozlar fikrlari" bo'limi va reytinglar yashirilgan, chunki ular to'qib chiqarilgan edi. Haqiqiy sharhlar bo'lsa, qo'shib yoqing.

## 3. Ma'lumotlar qayerda saqlanadi?

`data/` papkasida (u gitga **qo'shilmaydi**, chunki ichida mijozlarning ismlari va telefonlari bor):

| Fayl | Ichida |
|------|--------|
| `data/appointments.json` | buyurtmalar |
| `data/specialists.json` | ustalar (birinchi ishga tushirishda `specialists.json` dan nusxalanadi) |
| `data/bot_config.json` | bot tokeni, admin chat, admin parol xeshi |

Zaxira nusxa olish uchun `data/` papkasini nusxalab qo'ying yoki admin paneldagi **Export (JSON)** tugmasidan foydalaning.

## 4. Internetga joylash

Mijozlar saytga kira olishi uchun `server.py` doimiy ishlaydigan kompyuter yoki serverda (VPS) turishi kerak. Muhim:

- `data/` papkasi o'chib ketmaydigan diskda bo'lsin (`WOMAN_DATA_DIR` bilan joyini o'zgartirish mumkin).
- Server oldida Nginx yoki hosting proksisi bo'lsa, `WOMAN_TRUST_PROXY=1` qo'ying, aks holda spamdan himoya hamma mijozni bitta odam deb hisoblaydi.
- Domen va HTTPS (masalan Nginx + Let's Encrypt) bilan oching, chunki admin parol internet orqali yuboriladi.

| O'zgaruvchi | Ma'nosi |
|-------------|---------|
| `PORT` | port (standart 8000) |
| `WOMAN_ADMIN_PASSWORD` | admin paroli |
| `WOMAN_BOT_TOKEN` | Telegram bot tokeni (admin paneldan ham kiritsa bo'ladi) |
| `WOMAN_DATA_DIR` | ma'lumotlar papkasi (standart `./data`) |
| `WOMAN_TRUST_PROXY` | `1`: proksi orqasida |
| `WOMAN_TZ_OFFSET_HOURS` | vaqt mintaqasi (standart 5, Toshkent) |

## 5. Testlar

```bash
python test_suite.py
```

```bash
python test_server.py
```

## Fayllar

```
index.html        sayt
admin.html        admin panel
app.js            sayt logikasi (yozilish)
admin.js          admin panel logikasi
translations.js   UZ / RU matnlar
site-config.js    telefon, manzil, Instagram, Telegram
styles.css        dizayn (qora + pushti + oq, logotip ranglari)
assets/           logotip va ikonkalar
server.py         veb-server va API
bot.py            Telegram bot
storage.py        ma'lumotlarni xavfsiz saqlash
specialists.json  ustalar ro'yxati namunasi (boshlang'ich)
```
