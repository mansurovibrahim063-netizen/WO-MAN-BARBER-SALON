/**
 * WO&MAN Beauty Studio - Core Frontend & Booking Engine
 * Features:
 * - Trilingual System (Uzbek / English / Russian) via WOMAN_TRANSLATIONS
 * - Time-Slot Reservation (No prices; busy slots come from the server)
 * - Staff list and bookings are stored on the server (server.py), so every
 *   booking reaches the admin panel and the master's Telegram
 * - Split-Screen Dynamic Lerp & Draggable Divider
 * - Audio Synthesis via Web Audio API
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Helpers ---
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function localDateStr(d = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  // --- Current Language State ---
  let currentLang = storageGet('woman_lang') || 'uz';

  // --- DOM Elements ---
  const heroContainer = document.getElementById('splitHero');
  const panelHomme = document.getElementById('panelHomme');
  const panelFemme = document.getElementById('panelFemme');
  const splitDivider = document.getElementById('splitDivider');
  const dividerHandle = document.getElementById('dividerHandle');
  const viewSwitchers = document.querySelectorAll('.switcher-btn');
  const cursorGlow = document.getElementById('cursorGlow');
  const soundToggle = document.getElementById('soundToggle');
  const langBtns = document.querySelectorAll('.lang-pill-btn');

  // Modals & Triggers
  const bookingModal = document.getElementById('bookingModal');
  const menuModal = document.getElementById('menuModal');
  const openBookingBtns = document.querySelectorAll('[data-open-booking]');
  const openMenuBtns = document.querySelectorAll('[data-open-menu]');
  const modalCloseBtns = document.querySelectorAll('[data-close-modal]');
  const toastNotice = document.getElementById('toastNotice');

  // --- Web Audio API Synthesizer ---
  let audioCtx = null;
  let soundEnabled = false;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSoftClick(freq = 600) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.09);
    } catch (e) {}
  }

  function playLuxuryChime(isHomme = true) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const freqs = isHomme ? [220, 330, 440] : [330, 440, 660];
      freqs.forEach((f, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, audioCtx.currentTime + i * 0.04);
        gain.gain.setValueAtTime(0.02, audioCtx.currentTime + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35 + i * 0.04);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + i * 0.04);
        osc.stop(audioCtx.currentTime + 0.4 + i * 0.04);
      });
    } catch (e) {}
  }

  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      initAudio();
      soundEnabled = !soundEnabled;
      soundToggle.classList.toggle('active', soundEnabled);
      if (soundEnabled) playLuxuryChime(true);
    });
  }

  // --- Dynamic Cursor Glow Follower ---
  if (cursorGlow && window.innerWidth > 992) {
    window.addEventListener('mousemove', (e) => {
      cursorGlow.style.left = `${e.clientX}px`;
      cursorGlow.style.top = `${e.clientY}px`;
    });
  }

  // --- Split Screen Hover & Drag Transitions ---
  let isDragging = false;

  function resetSplitRatio() {
    if (window.innerWidth <= 768) return;
    panelHomme.style.flexBasis = '50%';
    panelFemme.style.flexBasis = '50%';
    if (splitDivider) splitDivider.style.left = '50%';
  }

  if (panelHomme && panelFemme && heroContainer) {
    panelHomme.addEventListener('mouseenter', () => {
      if (isDragging || heroContainer.classList.contains('view-homme-full') || heroContainer.classList.contains('view-femme-full')) return;
      heroContainer.classList.remove('hover-femme');
      heroContainer.classList.add('hover-homme');
      panelHomme.style.flexBasis = '';
      panelFemme.style.flexBasis = '';
      if (splitDivider) splitDivider.style.left = '64%';
      playSoftClick(420);
    });

    panelFemme.addEventListener('mouseenter', () => {
      if (isDragging || heroContainer.classList.contains('view-homme-full') || heroContainer.classList.contains('view-femme-full')) return;
      heroContainer.classList.remove('hover-homme');
      heroContainer.classList.add('hover-femme');
      panelHomme.style.flexBasis = '';
      panelFemme.style.flexBasis = '';
      if (splitDivider) splitDivider.style.left = '36%';
      playSoftClick(540);
    });

    heroContainer.addEventListener('mouseleave', () => {
      if (isDragging) return;
      heroContainer.classList.remove('hover-homme', 'hover-femme');
      if (!heroContainer.classList.contains('view-homme-full') && !heroContainer.classList.contains('view-femme-full')) {
        resetSplitRatio();
      }
    });
  }

  if (dividerHandle && heroContainer) {
    dividerHandle.addEventListener('mousedown', () => { isDragging = true; initAudio(); });
    dividerHandle.addEventListener('touchstart', () => { isDragging = true; initAudio(); }, { passive: true });
    
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = heroContainer.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      if (!clientX) return;

      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(22, Math.min(78, pct));
      panelHomme.style.flexBasis = `${pct}%`;
      panelFemme.style.flexBasis = `${100 - pct}%`;
      if (splitDivider) splitDivider.style.left = `${pct}%`;
    });

    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('touchend', () => { isDragging = false; });
  }

  // Segmented View Switcher
  viewSwitchers.forEach(btn => {
    btn.addEventListener('click', () => {
      viewSwitchers.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.getAttribute('data-view');

      heroContainer.classList.remove('hover-homme', 'hover-femme', 'view-homme-full', 'view-femme-full');
      panelHomme.style.flexBasis = '';
      panelFemme.style.flexBasis = '';

      if (view === 'homme') {
        heroContainer.classList.add('view-homme-full');
        if (splitDivider) splitDivider.style.left = '100%';
        playLuxuryChime(true);
      } else if (view === 'femme') {
        heroContainer.classList.add('view-femme-full');
        if (splitDivider) splitDivider.style.left = '0%';
        playLuxuryChime(false);
      } else {
        if (splitDivider) splitDivider.style.left = '50%';
        playSoftClick(500);
      }
    });
  });

  // --- Staff list & busy slots come from the server ---
  const DEFAULT_AVATAR = 'assets/logo.png';
  let specialists = [];
  let specialistsLoadFailed = false;
  const busyByDate = {};   // { 'YYYY-MM-DD': { specialistId: ['10:00 AM', ...] } }

  async function loadSpecialists() {
    try {
      const res = await fetch('/api/public/specialists', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      specialists = await res.json();
      specialistsLoadFailed = false;
    } catch (e) {
      specialists = [];
      specialistsLoadFailed = true;
    }
  }

  async function loadBusySlots(date) {
    try {
      const res = await fetch(`/api/public/busy?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      busyByDate[date] = data.busy || {};
    } catch (e) {
      busyByDate[date] = busyByDate[date] || {};
    }
  }

  // --- Service Catalog Data (No Prices, Only Durations) ---
  const servicesCatalog = {
    homme: [
      {
        id: 'h1',
        title: { uz: 'Klassik & Skin Feyd', en: 'Executive Precision Cut & Fade', ru: 'Точный скин-фейд и стрижка' },
        duration: { uz: '45 daqiqa', en: '45 mins', ru: '45 минут' },
        desc: { uz: 'Maslahatlashuv, ustarali feyd, bo\'yinga qaynoq sochiq va ukladka.', en: 'Precision razor fade, hot lather neck shave & styling.', ru: 'Консультация, чистый скин-фейд, горячее бритье шеи и укладка.' }
      },
      {
        id: 'h2',
        title: { uz: 'Qirollik Tarash Rituali', en: 'Royal Hot Towel Shave Ritual', ru: 'Королевское бритье опасной бритвой' },
        duration: { uz: '40 daqiqa', en: '40 mins', ru: '40 минут' },
        desc: { uz: 'Yog\'li ekstraktlar, 3 bosqichli bug\'li sochiq va xavfli ustarada tarash.', en: 'Essential oils, 3 steamed hot towels & straight-razor glide.', ru: 'Аромамасла, 3 распаривающих полотенца и бритье опасной бритвой.' }
      },
      {
        id: 'h3',
        title: { uz: 'Usta Soqol Arxitekturasi', en: 'Master Beard Sculpt & Line-up', ru: 'Архитектура и моделирование бороды' },
        duration: { uz: '30 daqiqa', en: '30 mins', ru: '30 минут' },
        desc: { uz: 'Soqolni qisqartirish, aniq chiziqlar, namlantiruvchi balzam va uqalash.', en: 'Beard tapering, sharp foil edges, organic balm treatment.', ru: 'Филировка бороды, четкие контуры шейвером и бальзам.' }
      },
      {
        id: 'h4',
        title: { uz: 'WO&MAN Dual Erkaklar To\'plami', en: 'The WO&MAN Signature Dual Package', ru: 'Комплекс WO&MAN Dual (Стрижка + Бритье)' },
        duration: { uz: '75 daqiqa', en: '75 mins', ru: '75 минут' },
        desc: { uz: 'Soch turmagi + Qirollik tarash rituali + bosh terisi massaji.', en: 'Haircut + Royal hot towel shave + scalp massage.', ru: 'Авторская стрижка + королевское бритье + массаж головы.' }
      }
    ],
    femme: [
      {
        id: 'f1',
        title: { uz: 'Kutyur Soch Turmagi & Ukladka', en: 'Haute Couture Cut & Signature Blowout', ru: 'Кутюрная стрижка и укладка' },
        duration: { uz: '60 daqiqa', en: '60 mins', ru: '60 минут' },
        desc: { uz: 'Arxitekturaviy kesish, chuqur konditsionerlash va fen ukladkasi.', en: 'Architectural haircut, deep conditioning & editorial finish.', ru: 'Геометрическая стрижка, глубокое питание и брашинг-укладка.' }
      },
      {
        id: 'f2',
        title: { uz: 'Hajmli Balayaj & Glos', en: 'Dimensional Balayage & Gloss Toners', ru: 'Сложный авторский балаяж и глянец' },
        duration: { uz: '150 daqiqa', en: '150 mins', ru: '150 минут' },
        desc: { uz: 'Qo\'lda chizilgan quyosh nurlari effekti, maxsus tonlar.', en: 'Hand-painted sun-kissed dimension & custom gloss.', ru: 'Ручная растяжка цвета, безаммиачный глянец и защита связей.' }
      },
      {
        id: 'f3',
        title: { uz: 'Ipak Keratin Infuziya Spasi', en: 'Keratin Silk Infusion Treatment', ru: 'Шелковое кератиновое спа-восстановление' },
        duration: { uz: '120 daqiqa', en: '120 mins', ru: '120 минут' },
        desc: { uz: 'Sochlarning jingalakligini yo\'qotish, 4 oygacha oyna kabi porlash.', en: 'Frizz-free smoothness, mirror shine up to 4 months.', ru: 'Абсолютная гладкость, зеркальный блеск без пушистости.' }
      },
      {
        id: 'f4',
        title: { uz: 'Botanika Bosh Teri Spasi', en: 'Botanical Hair & Scalp Spa Therapy', ru: 'Ботаническое спа для волос и кожи головы' },
        duration: { uz: '45 daqiqa', en: '45 mins', ru: '45 минут' },
        desc: { uz: 'Bug\'li oziqlantiruvchi niqob, lavandali akupressura massaji.', en: 'Steam infusion mask, lavender scalp acupressure massage.', ru: 'Паровая терапия, маска на травах и точечный массаж.' }
      }
    ]
  };

  const defaultSlots = ['10:00 AM', '11:30 AM', '1:00 PM', '2:30 PM', '4:00 PM', '5:30 PM', '7:00 PM'];

  // --- Booking State ---
  let selectedSalon = 'homme';
  let selectedService = null;
  let selectedSpecialist = null;
  let selectedDate = localDateStr();
  let selectedTimeSlot = null;

  const salonToggleBtns = document.querySelectorAll('.salon-toggle-btn');
  const serviceSelectList = document.getElementById('serviceSelectList');
  const specialistSelectList = document.getElementById('specialistSelectList');
  const timeSlotsContainer = document.getElementById('timeSlots');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  const datePicker = document.getElementById('bookingDateInput');

  function isSlotBooked(specialistId, date, timeSlot) {
    const busy = (busyByDate[date] || {})[specialistId] || [];
    return busy.includes(timeSlot);
  }

  function slotMinutes(slot) {
    const m = slot.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
    if (!m) return 0;
    let h = parseInt(m[1], 10) % 12;
    if (m[3] === 'PM') h += 12;
    return h * 60 + parseInt(m[2], 10);
  }

  function isSlotPast(date, slot) {
    if (date !== localDateStr()) return date < localDateStr();
    const now = new Date();
    return slotMinutes(slot) <= now.getHours() * 60 + now.getMinutes();
  }

  function uiText(key) {
    const t = {
      busy: { uz: 'Band', en: 'Booked', ru: 'Занято' },
      past: { uz: "O'tgan", en: 'Past', ru: 'Прошло' },
      noStaff: { uz: 'Hozircha bu zalda bo\'sh ustalar yo\'q', en: 'No masters available right now', ru: 'Сейчас нет свободных мастеров' },
      loadFailed: { uz: "Ustalar ro'yxatini yuklab bo'lmadi. Sahifani yangilang yoki bizga qo'ng'iroq qiling.", en: 'Could not load the masters. Refresh the page or call us.', ru: 'Не удалось загрузить мастеров. Обновите страницу или позвоните нам.' },
      pickSlot: { uz: "Iltimos, bo'sh vaqtni tanlang!", en: 'Please pick a free time slot!', ru: 'Пожалуйста, выберите свободное время!' },
      pickStaff: { uz: 'Iltimos, ustani tanlang!', en: 'Please pick a master!', ru: 'Пожалуйста, выберите мастера!' },
      needInfo: { uz: 'Iltimos, ismingiz va telefon raqamingizni kiriting!', en: 'Please enter your name and phone number!', ru: 'Пожалуйста, введите имя и номер!' },
      sending: { uz: 'Yuborilmoqda...', en: 'Sending...', ru: 'Отправка...' },
      netError: { uz: "Ulanishda xatolik. Internetni tekshirib, qayta urinib ko'ring.", en: 'Connection error. Check your internet and try again.', ru: 'Ошибка соединения. Проверьте интернет и попробуйте снова.' }
    };
    return (t[key] && (t[key][currentLang] || t[key].uz)) || key;
  }

  function renderBookingServices(salon) {
    if (!serviceSelectList) return;
    serviceSelectList.innerHTML = '';
    const list = servicesCatalog[salon] || [];

    list.forEach((srv, idx) => {
      const card = document.createElement('div');
      card.className = `service-card-select ${idx === 0 ? 'selected' : ''}`;
      
      const title = srv.title[currentLang] || srv.title.en;
      const duration = srv.duration[currentLang] || srv.duration.en;
      const desc = srv.desc[currentLang] || srv.desc.en;

      card.innerHTML = `
        <div class="service-info">
          <h5>${title}</h5>
          <span>⏱ ${duration} • ${desc}</span>
        </div>
        <div class="service-price-tag" style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
          ${duration}
        </div>
      `;

      card.addEventListener('click', () => {
        serviceSelectList.querySelectorAll('.service-card-select').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedService = srv;
        playSoftClick(520);
      });

      serviceSelectList.appendChild(card);
    });

    selectedService = list[0];
  }

  function renderBookingSpecialists(salon) {
    if (!specialistSelectList) return;
    specialistSelectList.innerHTML = '';

    const list = specialists.filter(s => s.salon === salon && s.onDuty !== false);

    if (list.length === 0) {
      selectedSpecialist = null;
      specialistSelectList.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted); padding: 10px;">${esc(specialistsLoadFailed ? uiText('loadFailed') : uiText('noStaff'))}</p>`;
      renderTimeSlots();
      return;
    }

    list.forEach((sp, idx) => {
      const item = document.createElement('div');
      item.className = `specialist-item ${idx === 0 ? 'selected' : ''}`;
      item.innerHTML = `
        <img src="${esc(sp.img || DEFAULT_AVATAR)}" alt="${esc(sp.name)}">
        <p>${esc(sp.name)}</p>
        <span>${esc(sp.role)}</span>
      `;
      item.querySelector('img').addEventListener('error', (e) => { e.target.src = DEFAULT_AVATAR; }, { once: true });

      item.addEventListener('click', () => {
        specialistSelectList.querySelectorAll('.specialist-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedSpecialist = sp;
        renderTimeSlots();
        playSoftClick(480);
      });

      specialistSelectList.appendChild(item);
    });

    selectedSpecialist = list[0];
    renderTimeSlots();
  }

  function renderTimeSlots() {
    if (!timeSlotsContainer) return;
    timeSlotsContainer.innerHTML = '';

    const specId = selectedSpecialist ? selectedSpecialist.id : '';
    const isFree = slot => !isSlotBooked(specId, selectedDate, slot) && !isSlotPast(selectedDate, slot);
    if (!selectedTimeSlot || !isFree(selectedTimeSlot)) {
      selectedTimeSlot = defaultSlots.find(isFree) || null;
    }

    defaultSlots.forEach((slot) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const booked = isSlotBooked(specId, selectedDate, slot);
      const past = isSlotPast(selectedDate, slot);

      btn.className = `time-chip ${slot === selectedTimeSlot ? 'selected' : ''}`;
      if (booked || past) {
        btn.disabled = true;
        btn.classList.add('slot-booked');
        btn.style.opacity = '0.35';
        btn.style.textDecoration = 'line-through';
        btn.textContent = `${slot} (${uiText(booked ? 'busy' : 'past')})`;
      } else {
        btn.textContent = slot;
        btn.addEventListener('click', () => {
          timeSlotsContainer.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
          btn.classList.add('selected');
          selectedTimeSlot = slot;
          playSoftClick(600);
        });
      }

      timeSlotsContainer.appendChild(btn);
    });
  }

  function setBookingSalon(salon) {
    selectedSalon = salon;
    if (bookingModal) {
      bookingModal.classList.toggle('salon-is-homme', salon === 'homme');
      bookingModal.classList.toggle('salon-is-femme', salon === 'femme');
    }

    salonToggleBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-salon') === salon);
    });

    renderBookingServices(salon);
    renderBookingSpecialists(salon);
    playLuxuryChime(salon === 'homme');
  }

  salonToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => setBookingSalon(btn.getAttribute('data-salon')));
  });

  if (datePicker) {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 90);
    datePicker.value = selectedDate;
    datePicker.min = localDateStr();
    datePicker.max = localDateStr(maxDate);
    datePicker.addEventListener('change', async () => {
      selectedDate = datePicker.value && datePicker.value >= localDateStr() ? datePicker.value : localDateStr();
      datePicker.value = selectedDate;
      renderTimeSlots();
      await loadBusySlots(selectedDate);
      renderTimeSlots();
    });
  }

  // --- Confirm Appointment: send the booking to the server ---
  let bookingInFlight = false;

  if (confirmBookingBtn) {
    confirmBookingBtn.addEventListener('click', async () => {
      if (bookingInFlight) return;
      const nameInput = document.getElementById('clientNameInput');
      const phoneInput = document.getElementById('clientPhoneInput');
      const notesInput = document.getElementById('clientNotesInput');

      const name = nameInput ? nameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const notes = notesInput ? notesInput.value.trim() : '';

      if (!selectedSpecialist) { alert(uiText('pickStaff')); return; }
      if (!selectedTimeSlot) { alert(uiText('pickSlot')); return; }
      if (!name || !phone) { alert(uiText('needInfo')); return; }

      const srvTitle = selectedService ? (selectedService.title[currentLang] || selectedService.title.en) : '';
      const payload = {
        salon: selectedSalon,
        serviceId: selectedService ? selectedService.id : '',
        serviceTitle: srvTitle,
        specialistId: selectedSpecialist.id,
        date: selectedDate,
        timeSlot: selectedTimeSlot,
        clientName: name,
        clientPhone: phone,
        notes: notes
      };

      bookingInFlight = true;
      const originalLabel = confirmBookingBtn.textContent;
      confirmBookingBtn.disabled = true;
      confirmBookingBtn.textContent = uiText('sending');

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(data.error || uiText('netError'));
          if (res.status === 409) {
            await loadBusySlots(selectedDate);
            renderTimeSlots();
          }
          return;
        }

        bookingModal.classList.remove('open');
        const d = WOMAN_TRANSLATIONS[currentLang] || WOMAN_TRANSLATIONS.uz;
        showToastNotice(`🎉 ${d.toast_success} [ID: ${data.id} • ${data.specialistName} • ${data.date} ${data.timeSlot}]`);
        playLuxuryChime(selectedSalon === 'homme');

        if (nameInput) nameInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (notesInput) notesInput.value = '';
        await loadBusySlots(selectedDate);
        renderTimeSlots();
      } catch (e) {
        alert(uiText('netError'));
      } finally {
        bookingInFlight = false;
        confirmBookingBtn.disabled = false;
        confirmBookingBtn.textContent = originalLabel;
      }
    });
  }

  function showToastNotice(msg) {
    if (!toastNotice) return;
    toastNotice.querySelector('.toast-text').textContent = msg;
    toastNotice.classList.add('show');
    setTimeout(() => toastNotice.classList.remove('show'), 5500);
  }

  // Modal open triggers
  openBookingBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setBookingSalon(btn.getAttribute('data-salon') || 'homme');
      bookingModal.classList.add('open');
      playSoftClick(550);
    });
  });

  openMenuBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openFullMenu(btn.getAttribute('data-menu-salon') || 'homme');
      menuModal.classList.add('open');
      playSoftClick(550);
    });
  });

  modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      bookingModal.classList.remove('open');
      menuModal.classList.remove('open');
    });
  });

  [bookingModal, menuModal].forEach(m => {
    if (!m) return;
    m.addEventListener('click', (e) => {
      if (e.target === m) m.classList.remove('open');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') [bookingModal, menuModal].forEach(m => m && m.classList.remove('open'));
  });

  // --- Menu Modal Tabs ---
  const menuTabBtns = document.querySelectorAll('.menu-tab-btn');
  const menuContentHomme = document.getElementById('menuContentHomme');
  const menuContentFemme = document.getElementById('menuContentFemme');

  function openFullMenu(tab) {
    menuTabBtns.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === tab));
    if (menuContentHomme && menuContentFemme) {
      menuContentHomme.style.display = tab === 'homme' ? 'block' : 'none';
      menuContentFemme.style.display = tab === 'femme' ? 'block' : 'none';
    }
  }

  menuTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      openFullMenu(btn.getAttribute('data-tab'));
      playSoftClick(480);
    });
  });

  document.querySelectorAll('[data-book-service]').forEach(btn => {
    btn.addEventListener('click', () => {
      const salon = btn.getAttribute('data-salon');
      menuModal.classList.remove('open');
      setBookingSalon(salon);
      bookingModal.classList.add('open');
    });
  });

  // --- Lookbook Filter ---
  const lookbookPills = document.querySelectorAll('.filter-pill');
  const galleryCards = document.querySelectorAll('.gallery-card');

  lookbookPills.forEach(pill => {
    pill.addEventListener('click', () => {
      lookbookPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const tag = pill.getAttribute('data-tag');
      playSoftClick(520);

      galleryCards.forEach(card => {
        if (tag === 'all' || card.getAttribute('data-category') === tag) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // --- Trilingual Language Switcher ---
  function setLanguage(lang) {
    currentLang = lang;
    storageSet('woman_lang', lang);

    langBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    const dict = WOMAN_TRANSLATIONS[lang] || WOMAN_TRANSLATIONS.uz;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.innerHTML = dict[key];
    });

    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    renderBookingServices(selectedSalon);
    renderBookingSpecialists(selectedSalon);
    applySalonConfig();
  }

  // --- Contact details from site-config.js (empty values stay hidden) ---
  function applySalonConfig() {
    const cfg = window.SALON_CONFIG || {};
    const clean = v => String(v || '').trim().replace(/^@/, '');
    const address = cfg.address ? (cfg.address[currentLang] || cfg.address.uz || '') : '';
    const phoneDigits = String(cfg.phone || '').replace(/[^\d+]/g, '');
    const contacts = {
      phone: cfg.phone ? { href: `tel:${phoneDigits}`, label: cfg.phone } : null,
      telegram: clean(cfg.telegram) ? { href: `https://t.me/${encodeURIComponent(clean(cfg.telegram))}`, label: `Telegram @${clean(cfg.telegram)}` } : null,
      instagram: clean(cfg.instagram) ? { href: `https://instagram.com/${encodeURIComponent(clean(cfg.instagram))}`, label: `Instagram @${clean(cfg.instagram)}` } : null,
      address: address ? { href: cfg.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(address)}`, label: address } : null
    };

    document.querySelectorAll('[data-contact]').forEach(el => {
      const c = contacts[el.getAttribute('data-contact')];
      const target = el.closest('li') || el;
      target.classList.toggle('is-hidden', !c);
      if (!c) return;
      el.setAttribute('href', c.href);
      if (el.closest('li')) el.textContent = c.label;
    });

    document.querySelectorAll('[data-contact-section]').forEach(el => {
      el.classList.toggle('is-hidden', !contacts[el.getAttribute('data-contact-section')]);
    });

    // Hide the footer "contact" column entirely while nothing is filled in
    document.querySelectorAll('.footer-col').forEach(col => {
      const items = col.querySelectorAll('li [data-contact]');
      if (!items.length) return;
      col.classList.toggle('is-hidden', !Object.values(contacts).some(Boolean));
    });
  }

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setLanguage(btn.getAttribute('data-lang'));
      playSoftClick(650);
    });
  });

  // Opening the booking form refreshes staff and busy slots from the server
  async function refreshBookingData() {
    await Promise.all([loadSpecialists(), loadBusySlots(selectedDate)]);
    renderBookingSpecialists(selectedSalon);
  }

  document.querySelectorAll('[data-open-booking], [data-book-service]').forEach(btn => {
    btn.addEventListener('click', refreshBookingData);
  });

  // Initial setup
  setLanguage(currentLang);
  setBookingSalon('homme');
  refreshBookingData();
});
