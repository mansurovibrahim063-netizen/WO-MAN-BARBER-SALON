/**
 * VSM Barbershop & Salon - Core Frontend & Booking Engine
 * Features:
 * - Trilingual System (Uzbek / English / Russian) via VSM_TRANSLATIONS
 * - Time-Slot Reservation (No prices; real-time slot checking)
 * - Dynamic Specialists synchronization from Admin Panel
 * - Automated Telegram Alert Dispatch to the Barber upon booking
 * - Split-Screen Dynamic Lerp & Draggable Divider
 * - Audio Synthesis via Web Audio API
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Current Language State ---
  let currentLang = localStorage.getItem('vsm_lang') || 'uz';

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

  // --- Dynamic Specialists Loader (Sync with Admin Panel) ---
  function getLoadedSpecialists() {
    try {
      const stored = localStorage.getItem('vsm_specialists');
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    return [
      { id: "sp-m1", name: "Marcus Vance", role: "Master Fade Specialist", salon: "homme", phone: "+998 90 111-22-33", telegram: "@marcus_vance", chatId: "78219401", onDuty: true, img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" },
      { id: "sp-m2", name: "Julian Drake", role: "Beard & Shave Master", salon: "homme", phone: "+998 90 222-33-44", telegram: "@julian_drake", chatId: "89312042", onDuty: true, img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80" },
      { id: "sp-m3", name: "Leo Saint", role: "Texture Specialist", salon: "homme", phone: "+998 90 333-44-55", telegram: "@leo_saint", chatId: "91048211", onDuty: true, img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80" },
      { id: "sp-f1", name: "Elena Rostova", role: "Creative Color Director", salon: "femme", phone: "+998 90 444-55-66", telegram: "@elena_rostova", chatId: "65192034", onDuty: true, img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80" },
      { id: "sp-f2", name: "Camille Laurent", role: "Haute Cut Specialist", salon: "femme", phone: "+998 90 555-66-77", telegram: "@camille_laurent", chatId: "73104928", onDuty: true, img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80" },
      { id: "sp-f3", name: "Sienna Blake", role: "Balayage Artisan", salon: "femme", phone: "+998 90 666-77-88", telegram: "@sienna_blake", chatId: "82019483", onDuty: false, img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80" }
    ];
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
        title: { uz: 'VSM Dual Gentlemen To\'plami', en: 'The VSM Signature Dual Package', ru: 'Комплекс VSM Dual (Стрижка + Бритье)' },
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
  let selectedDate = new Date().toISOString().split('T')[0];
  let selectedTimeSlot = '2:30 PM';

  const salonToggleBtns = document.querySelectorAll('.salon-toggle-btn');
  const serviceSelectList = document.getElementById('serviceSelectList');
  const specialistSelectList = document.getElementById('specialistSelectList');
  const timeSlotsContainer = document.getElementById('timeSlots');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  const datePicker = document.getElementById('bookingDateInput');

  function getExistingAppointments() {
    try {
      const stored = localStorage.getItem('vsm_appointments');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  }

  function isSlotBooked(specialistName, date, timeSlot) {
    const list = getExistingAppointments();
    return list.some(a => a.specialistName === specialistName && a.date === date && a.timeSlot === timeSlot && a.status !== 'Cancelled');
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

    const allSpecs = getLoadedSpecialists();
    const list = allSpecs.filter(s => s.salon === salon && s.onDuty !== false);

    if (list.length === 0) {
      specialistSelectList.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted); padding: 10px;">Hozircha ustalar mavjud emas</p>`;
      return;
    }

    list.forEach((sp, idx) => {
      const item = document.createElement('div');
      item.className = `specialist-item ${idx === 0 ? 'selected' : ''}`;
      item.innerHTML = `
        <img src="${sp.img}" alt="${sp.name}">
        <p>${sp.name}</p>
        <span>${sp.role}</span>
      `;

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

    const specName = selectedSpecialist ? selectedSpecialist.name : '';

    defaultSlots.forEach((slot) => {
      const btn = document.createElement('button');
      const booked = isSlotBooked(specName, selectedDate, slot);

      btn.className = `time-chip ${slot === selectedTimeSlot && !booked ? 'selected' : ''}`;
      if (booked) {
        btn.disabled = true;
        btn.classList.add('slot-booked');
        btn.style.opacity = '0.35';
        btn.style.textDecoration = 'line-through';
        btn.textContent = `${slot} (Band)`;
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
    datePicker.value = selectedDate;
    datePicker.addEventListener('change', () => {
      selectedDate = datePicker.value || new Date().toISOString().split('T')[0];
      renderTimeSlots();
    });
  }

  // --- Dispatch Booking Notification to Barber via Telegram ---
  async function notifyBarberViaTelegram(appt) {
    try {
      const cfg = JSON.parse(localStorage.getItem('vsm_telegram_config') || '{}');
      const token = cfg.bot_token;
      if (!token) return;

      const allSpecs = getLoadedSpecialists();
      const barber = allSpecs.find(s => s.name === appt.specialistName || s.id === appt.specialistId);
      if (!barber || !barber.chatId) return;

      const alertText = 
        `🚨 <b>YANGI BUYURTMA! / NEW BOOKING!</b>\n\n` +
        `🆔 <b>ID:</b> <code>${appt.id}</code>\n` +
        `👤 <b>Mijoz:</b> ${appt.clientName} (${appt.clientPhone})\n` +
        `✂️ <b>Xizmat:</b> ${appt.serviceTitle}\n` +
        `📅 <b>Sana:</b> ${appt.date}\n` +
        `⏰ <b>Vaqt Sloti:</b> <b>${appt.timeSlot}</b>\n` +
        `📝 <b>Izoh:</b> ${appt.notes || 'Yo\'q'}\n\n` +
        `<i>Iltimos, ushbu mijozni qabul qilasizmi yoki rad etasizmi?</i>`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ Qabul qilish (Accept)", callback_data: `accept_${appt.id}` },
            { text: "❌ Rad etish (Decline)", callback_data: `decline_${appt.id}` }
          ],
          [
            { text: "📞 Qo'ng'iroq qilish", url: `tel:${appt.clientPhone.replace(/\s+/g, '')}` }
          ]
        ]
      };

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: barber.chatId,
          text: alertText,
          parse_mode: 'HTML',
          reply_markup: keyboard
        })
      });
    } catch (e) {
      console.warn("Could not dispatch Telegram alert:", e);
    }
  }

  // --- Confirm Appointment Logic ---
  if (confirmBookingBtn) {
    confirmBookingBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('clientNameInput');
      const phoneInput = document.getElementById('clientPhoneInput');
      const notesInput = document.getElementById('clientNotesInput');

      const name = nameInput ? nameInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const notes = notesInput ? notesInput.value.trim() : '';

      if (!name || !phone) {
        alert(currentLang === 'uz' ? 'Iltimos, ismingiz va telefon raqamingizni kiriting!' : (currentLang === 'ru' ? 'Пожалуйста, введите имя и номер!' : 'Please enter your name and phone number!'));
        return;
      }

      const bookingId = `VSM-${Math.floor(1000 + Math.random() * 9000)}`;
      const srvTitle = selectedService ? (selectedService.title[currentLang] || selectedService.title.en) : 'Precision Cut';

      const newAppt = {
        id: bookingId,
        clientName: name,
        clientPhone: phone,
        salon: selectedSalon,
        serviceTitle: srvTitle,
        specialistName: selectedSpecialist ? selectedSpecialist.name : 'Master Barber',
        specialistId: selectedSpecialist ? selectedSpecialist.id : '',
        date: selectedDate,
        timeSlot: selectedTimeSlot,
        source: 'Website',
        status: 'Pending',
        createdAt: new Date().toISOString(),
        notes: notes
      };

      // Save to shared localStorage
      const appts = getExistingAppointments();
      appts.unshift(newAppt);
      localStorage.setItem('vsm_appointments', JSON.stringify(appts));

      // Attempt Telegram Notification to Barber
      notifyBarberViaTelegram(newAppt);

      bookingModal.classList.remove('open');

      const d = VSM_TRANSLATIONS[currentLang] || VSM_TRANSLATIONS.uz;
      showToastNotice(`🎉 ${d.toast_success} [ID: ${bookingId} • ${selectedSpecialist ? selectedSpecialist.name : ''} • ${selectedTimeSlot}]`);
      playLuxuryChime(selectedSalon === 'homme');

      if (nameInput) nameInput.value = '';
      if (phoneInput) phoneInput.value = '';
      if (notesInput) notesInput.value = '';
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
    localStorage.setItem('vsm_lang', lang);

    langBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    const dict = VSM_TRANSLATIONS[lang] || VSM_TRANSLATIONS.uz;

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
  }

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setLanguage(btn.getAttribute('data-lang'));
      playSoftClick(650);
    });
  });

  // Initial setup
  setLanguage(currentLang);
  setBookingSalon('homme');
});
