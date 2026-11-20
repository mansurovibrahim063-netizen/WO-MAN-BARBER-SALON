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

  // --- Services & prices (so'm) ---
  // MAN: from the salon's official price list. Change prices here only:
  // the booking form, the "Xizmatlar" window and the home page all read this list.
  // WO: prices not provided yet -> price: null shows "price on request".
  const servicesCatalog = {
    homme: [
      { id: 'h1',  price: 60000,  title: { uz: 'Soch olish', en: 'Haircut', ru: 'Стрижка' } },
      { id: 'h2',  price: 100000, title: { uz: 'Soch + soqol', en: 'Haircut + beard', ru: 'Стрижка + борода' } },
      { id: 'h3',  price: 50000,  title: { uz: 'Bolalar soch olishi', en: "Kids' haircut", ru: 'Детская стрижка' } },
      { id: 'h4',  price: 50000,  title: { uz: 'Ukladka', en: 'Styling', ru: 'Укладка' } },
      { id: 'h5',  price: 50000,  title: { uz: "Soch bo'yash", en: 'Hair colouring', ru: 'Окрашивание волос' } },
      { id: 'h6',  price: 40000,  title: { uz: 'Soqol', en: 'Beard', ru: 'Борода' } },
      { id: 'h7',  price: 30000,  title: { uz: 'Vosk', en: 'Waxing', ru: 'Воск' } },
      { id: 'h8',  price: 40000,  title: { uz: 'Yuz maskasi', en: 'Face mask', ru: 'Маска для лица' } },
      { id: 'h9',  price: 50000,  title: { uz: 'Bosh massaji', en: 'Head massage', ru: 'Массаж головы' } },
      { id: 'h10', price: 400000, title: { uz: 'Kuyov obrazi', en: 'Groom look', ru: 'Образ жениха' } }
    ],
    femme: [
      { id: 'f1', price: null, title: { uz: 'Soch turmagi va ukladka', en: 'Haircut & blow-dry', ru: 'Стрижка и укладка' } },
      { id: 'f2', price: null, title: { uz: 'Balayaj', en: 'Balayage', ru: 'Балаяж' } },
      { id: 'f3', price: null, title: { uz: 'Keratin', en: 'Keratin treatment', ru: 'Кератин' } },
      { id: 'f4', price: null, title: { uz: 'Soch parvarishi', en: 'Hair care', ru: 'Уход за волосами' } }
    ]
  };

  function formatPrice(price, lang = currentLang) {
    if (price == null) {
      return { uz: "Narxini so'rang", en: 'Price on request', ru: 'Цена по запросу' }[lang] || "Narxini so'rang";
    }
    const grouped = String(price).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${grouped} ${{ uz: "so'm", en: 'UZS', ru: 'сум' }[lang] || "so'm"}`;
  }

  function serviceTitle(srv, lang = currentLang) {
    return srv.title[lang] || srv.title.uz;
  }

  // Home page pills (first 3 services of each studio) and the full "Xizmatlar" window
  function renderServiceLists() {
    [['homme', 'heroPillsHomme'], ['femme', 'heroPillsFemme']].forEach(([salon, id]) => {
      const box = document.getElementById(id);
      if (!box) return;
      box.innerHTML = servicesCatalog[salon].slice(0, 3).map(srv => `
        <div class="service-pill badge-${salon}-pill">
          <span>${esc(serviceTitle(srv))}${srv.price != null ? ` • ${esc(formatPrice(srv.price))}` : ''}</span>
        </div>`).join('');
    });

    [['homme', 'menuListHomme'], ['femme', 'menuListFemme']].forEach(([salon, id]) => {
      const box = document.getElementById(id);
      if (!box) return;
      box.innerHTML = servicesCatalog[salon].map(srv => `
        <div class="service-card-select">
          <div class="service-info"><h5>${esc(serviceTitle(srv))}</h5></div>
          <div class="service-price-tag">${esc(formatPrice(srv.price))}</div>
        </div>`).join('');
    });
  }

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
      
      card.innerHTML = `
        <div class="service-info">
          <h5>${esc(serviceTitle(srv))}</h5>
        </div>
        <div class="service-price-tag">${esc(formatPrice(srv.price))}</div>
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

      const srvTitle = selectedService
        ? (selectedService.price != null
            ? `${serviceTitle(selectedService, 'uz')} — ${formatPrice(selectedService.price, 'uz')}`
            : serviceTitle(selectedService, 'uz'))
        : '';
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
    renderServiceLists();
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
