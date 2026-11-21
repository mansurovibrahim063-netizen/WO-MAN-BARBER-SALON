/**
 * WO&MAN Beauty Studio - Admin panel
 * All data lives on the server (server.py). The panel is password-protected:
 * it logs in once, keeps the session token for this browser tab, and talks to
 * /api/admin/* for bookings, staff and Telegram settings.
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

  function storeGet(store, key) {
    try { return window[store].getItem(key); } catch (e) { return null; }
  }
  function storeSet(store, key, value) {
    try {
      if (value === null) window[store].removeItem(key);
      else window[store].setItem(key, value);
    } catch (e) {}
  }

  const DEFAULT_AVATAR = 'assets/logo.png';

  // --- State ---
  let appointments = [];
  let specialists = [];
  let tgStatus = null;
  let authToken = storeGet('sessionStorage', 'woman_admin_token');
  let currentLang = ['uz', 'ru'].includes(storeGet('localStorage', 'woman_lang')) ? storeGet('localStorage', 'woman_lang') : 'uz';
  let refreshTimer = null;

  // --- DOM Elements ---
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const btnLogout = document.getElementById('btnLogout');

  const tableBody = document.getElementById('appointmentsTableBody');
  const searchInput = document.getElementById('searchAppointments');
  const filterSalon = document.getElementById('filterSalon');
  const filterStatus = document.getElementById('filterStatus');

  const metricTotal = document.getElementById('metricTotal');
  const metricHomme = document.getElementById('metricHomme');
  const metricFemme = document.getElementById('metricFemme');
  const metricToday = document.getElementById('metricToday');
  const metricBarbers = document.getElementById('metricBarbers');

  const tabBtns = document.querySelectorAll('.admin-tab-btn');
  const viewAppointments = document.getElementById('viewAppointments');
  const viewSpecialists = document.getElementById('viewSpecialists');
  const viewTelegram = document.getElementById('viewTelegram');
  const specialistsGrid = document.getElementById('specialistsGrid');

  const barberModal = document.getElementById('barberModal');
  const barberModalTitle = document.getElementById('barberModalTitle');
  const barberEditId = document.getElementById('barberEditId');
  const barberNameInput = document.getElementById('barberNameInput');
  const barberSalonSelect = document.getElementById('barberSalonSelect');
  const barberRoleInput = document.getElementById('barberRoleInput');
  const barberPhoneInput = document.getElementById('barberPhoneInput');
  const barberTelegramInput = document.getElementById('barberTelegramInput');
  const barberChatIdInput = document.getElementById('barberChatIdInput');
  const barberImgInput = document.getElementById('barberImgInput');
  const barberExpInput = document.getElementById('barberExpInput');
  const barberDutySelect = document.getElementById('barberDutySelect');
  const saveBarberBtn = document.getElementById('saveBarberBtn');
  const closeBarberModal = document.getElementById('closeBarberModal');
  const cancelBarberModal = document.getElementById('cancelBarberModal');
  const btnOpenAddBarberModal = document.getElementById('btnOpenAddBarberModal');

  const manualBookingModal = document.getElementById('manualBookingModal');
  const btnHeaderAction = document.getElementById('btnHeaderAction');
  const closeManualModal = document.getElementById('closeManualModal');
  const cancelManualBooking = document.getElementById('cancelManualBooking');
  const saveManualBooking = document.getElementById('saveManualBooking');
  const manualSalon = document.getElementById('manualSalon');
  const manualSpecialist = document.getElementById('manualSpecialist');

  const tgBotTokenInput = document.getElementById('tgBotTokenInput');
  const tgAdminChatInput = document.getElementById('tgAdminChatInput');
  const btnToggleTokenVisibility = document.getElementById('btnToggleTokenVisibility');
  const btnTestTgConnection = document.getElementById('btnTestTgConnection');
  const btnSaveTgConfig = document.getElementById('btnSaveTgConfig');
  const tgConnectionStatusBadge = document.getElementById('tgConnectionStatusBadge');
  const tgAdminLinkBox = document.getElementById('tgAdminLinkBox');
  const barberLinkingList = document.getElementById('barberLinkingList');
  const testBarberSelect = document.getElementById('testBarberSelect');
  const btnSendTestAlert = document.getElementById('btnSendTestAlert');
  const btnExportJSON = document.getElementById('btnExportJSON');

  // --- Server API ---
  const NOT_SERVER_MSG = "Admin panel server.py orqali ochilmagan (masalan GitHub sahifasi, \"Go Live\" yoki fayl sifatida). " +
    "Kompyuterda loyiha papkasida terminalda `python server.py` ni ishga tushiring va brauzerda http://localhost:8000/admin.html ni oching.";

  // Shown on the login card before the password is typed, so nobody guesses passwords against a page that can't check them
  async function checkServer() {
    try {
      const res = await fetch('/api/public/specialists', { cache: 'no-store' });
      if ((res.headers.get('content-type') || '').includes('application/json')) return true;
    } catch (e) {}
    if (loginError) loginError.textContent = NOT_SERVER_MSG;
    return false;
  }

  async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    let res;
    try {
      res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch (e) {
      throw new Error(NOT_SERVER_MSG);
    }
    // Our server always answers /api/* with JSON. Anything else (e.g. "405" from
    // GitHub Pages, VS Code "Go Live" or a plain file server) means server.py isn't serving this page.
    if (!(res.headers.get('content-type') || '').includes('application/json')) throw new Error(NOT_SERVER_MSG);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/api/admin/login') {
      setToken(null);
      showLogin();
      throw new Error(data.error || 'Avval admin sifatida kiring');
    }
    if (!res.ok) throw new Error(data.error || `Xatolik (HTTP ${res.status})`);
    return data;
  }

  function setToken(token) {
    authToken = token;
    storeSet('sessionStorage', 'woman_admin_token', token);
  }

  // --- Login / Logout ---
  function showLogin() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (loginOverlay) loginOverlay.classList.add('open');
    if (loginPassword) setTimeout(() => loginPassword.focus(), 50);
  }

  function hideLogin() {
    if (loginOverlay) loginOverlay.classList.remove('open');
    if (loginError) loginError.textContent = '';
    if (loginPassword) loginPassword.value = '';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.textContent = '';
      try {
        const data = await api('POST', '/api/admin/login', { password: loginPassword.value });
        setToken(data.token);
        hideLogin();
        await loadAll();
        startAutoRefresh();
      } catch (err) {
        loginError.textContent = err.message;
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try { await api('POST', '/api/admin/logout'); } catch (e) {}
      setToken(null);
      appointments = []; specialists = []; tgStatus = null;
      renderAll();
      showLogin();
    });
  }

  async function loadAll() {
    const [appts, specs, tg] = await Promise.all([
      api('GET', '/api/admin/appointments'),
      api('GET', '/api/admin/specialists'),
      api('GET', '/api/admin/telegram')
    ]);
    appointments = appts;
    specialists = specs;
    tgStatus = tg;
    renderAll();
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
      if (!authToken || document.hidden) return;
      try {
        appointments = await api('GET', '/api/admin/appointments');
        updateMetrics();
        renderTable();
      } catch (e) {}
    }, 30000);
  }

  // --- Localization Dictionary ---
  const adminDict = {
    uz: {
      admin_tag: "Boshqaruv Markazi",
      btn_back: "← Saytga qaytish",
      btn_logout: "Chiqish",
      stat_total: "Jami Buyurtmalar",
      stat_total_sub: "Barcha vaqtlar bo'yicha",
      stat_homme: "♂ Erkaklar zali",
      stat_femme: "♀ Ayollar zali",
      stat_today: "Bugungi Slotlar",
      stat_today_sub: "Faol band qilingan",
      stat_barbers: "Ustalar",
      stat_barbers_sub: "Faol ustalar ro'yxati",
      tab_appts: "Vaqt Slotlari & Buyurtmalar",
      tab_specs: "Ustalarni Boshqarish",
      tab_telegram: "Telegram Bot",
      th_client: "Mijoz",
      th_salon: "Zal",
      th_service: "Xizmat",
      th_master: "Usta",
      th_datetime: "Sana & Vaqt Sloti",
      th_source: "Manba",
      th_status: "Holat",
      th_actions: "Amallar",
      search_ph: "Mijoz ismi, telefon yoki ID bo'yicha qidirish...",
      btn_new_booking: "+ Yangi Buyurtma Qo'shish",
      btn_add_barber: "+ Yangi Usta Qo'shish",
      status_confirmed: "Tasdiqlangan",
      status_pending: "Kutilmoqda",
      status_completed: "Yakunlangan",
      status_cancelled: "Bekor qilingan",
      no_appts: "Buyurtmalar topilmadi"
    },
    ru: {
      admin_tag: "Панель Управления",
      btn_back: "← На сайт",
      btn_logout: "Выйти",
      stat_total: "Всего Записей",
      stat_total_sub: "За все время",
      stat_homme: "♂ Мужской зал",
      stat_femme: "♀ Женский зал",
      stat_today: "Слоты на Сегодня",
      stat_today_sub: "Активные записи",
      stat_barbers: "Мастера",
      stat_barbers_sub: "Список мастеров",
      tab_appts: "Временные Слоты & Записи",
      tab_specs: "Управление Мастерами",
      tab_telegram: "Telegram Бот",
      th_client: "Клиент",
      th_salon: "Зал",
      th_service: "Услуга",
      th_master: "Мастер",
      th_datetime: "Дата и Слот",
      th_source: "Источник",
      th_status: "Статус",
      th_actions: "Действия",
      search_ph: "Поиск по имени, номеру или ID...",
      btn_new_booking: "+ Добавить Запись",
      btn_add_barber: "+ Добавить Мастера",
      status_confirmed: "Подтвержден",
      status_pending: "В ожидании",
      status_completed: "Завершен",
      status_cancelled: "Отменен",
      no_appts: "Записи не найдены"
    }
  };

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function applyLanguage(lang) {
    if (!adminDict[lang]) lang = 'uz';
    currentLang = lang;
    document.documentElement.lang = lang;
    storeSet('localStorage', 'woman_lang', lang);
    const d = adminDict[lang] || adminDict.uz;

    document.querySelectorAll('.lang-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    setText('adminTag', d.admin_tag);
    setText('btnBackSite', d.btn_back);
    setText('btnLogout', d.btn_logout);
    setText('statTotalLabel', d.stat_total);
    setText('statTotalSub', d.stat_total_sub);
    setText('statHommeLabel', d.stat_homme);
    setText('statFemmeLabel', d.stat_femme);
    setText('statTodayLabel', d.stat_today);
    setText('statTodaySub', d.stat_today_sub);
    setText('statBotLabel', d.stat_barbers);
    setText('tabAppointmentsText', d.tab_appts);
    setText('tabSpecialistsText', d.tab_specs);
    setText('tabTelegramText', d.tab_telegram);
    setText('thClient', d.th_client);
    setText('thSalon', d.th_salon);
    setText('thService', d.th_service);
    setText('thMaster', d.th_master);
    setText('thDateTime', d.th_datetime);
    setText('thSource', d.th_source);
    setText('thStatus', d.th_status);
    setText('thActions', d.th_actions);

    searchInput.setAttribute('placeholder', d.search_ph);
    btnHeaderAction.textContent = d.btn_new_booking;
    if (btnOpenAddBarberModal) btnOpenAddBarberModal.textContent = d.btn_add_barber;

    renderAll();
  }

  document.querySelectorAll('.lang-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => applyLanguage(btn.getAttribute('data-lang')));
  });

  // --- Metrics ---
  function updateMetrics() {
    const active = appointments.filter(a => a.status !== 'Cancelled');
    metricTotal.textContent = appointments.length;
    metricHomme.textContent = appointments.filter(a => a.salon === 'homme').length;
    metricFemme.textContent = appointments.filter(a => a.salon === 'femme').length;
    metricBarbers.textContent = specialists.filter(s => s.onDuty).length;
    const today = localDateStr();
    metricToday.textContent = active.filter(a => a.date === today).length;
  }

  // --- Appointments Table ---
  const STATUS_CLASS = { Confirmed: 'status-confirmed', Completed: 'status-completed', Cancelled: 'status-cancelled', Pending: 'status-pending' };

  function statusLabel(status) {
    const d = adminDict[currentLang] || adminDict.uz;
    return ({ Confirmed: d.status_confirmed, Pending: d.status_pending, Completed: d.status_completed, Cancelled: d.status_cancelled })[status] || status;
  }

  function renderTable() {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const query = searchInput.value.toLowerCase().trim();
    const salonVal = filterSalon.value;
    const statusVal = filterStatus.value;

    const filtered = appointments.filter(a => {
      const matchQuery = !query ||
        [a.clientName, a.clientPhone, a.id, a.specialistName].some(v => v && String(v).toLowerCase().includes(query));
      return matchQuery && (salonVal === 'all' || a.salon === salonVal) && (statusVal === 'all' || a.status === statusVal);
    });

    if (filtered.length === 0) {
      const d = adminDict[currentLang] || adminDict.uz;
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted);">${esc(d.no_appts)}</td></tr>`;
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const salonPill = item.salon === 'homme'
        ? `<span class="sub-badge badge-homme" style="font-size: 0.65rem; padding: 2px 8px;">♂ MAN</span>`
        : `<span class="sub-badge badge-femme" style="font-size: 0.65rem; padding: 2px 8px;">♀ WO</span>`;

      tr.innerHTML = `
        <td><span class="booking-id-code">${esc(item.id)}</span></td>
        <td>
          <div style="display: flex; flex-direction: column;">
            <strong style="color: #fff;">${esc(item.clientName || '—')}</strong>
            <a href="tel:${esc(String(item.clientPhone || '').replace(/[^\d+]/g, ''))}" style="font-size: 0.75rem; color: var(--text-muted);">${esc(item.clientPhone || '—')}</a>
            ${item.notes ? `<span style="font-size: 0.7rem; color: var(--text-subtle);">📝 ${esc(item.notes)}</span>` : ''}
          </div>
        </td>
        <td>${salonPill}</td>
        <td><strong>${esc(item.serviceTitle || '—')}</strong></td>
        <td>${esc(item.specialistName || '—')}</td>
        <td>
          <div style="display: flex; flex-direction: column;">
            <span style="color: #fff; font-weight: 600;">${esc(item.date)}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${esc(item.timeSlot)}</span>
          </div>
        </td>
        <td><span style="font-size: 0.75rem; color: #cbd5e1;">${esc(item.source || 'Website')}</span></td>
        <td><span class="status-badge ${STATUS_CLASS[item.status] || 'status-pending'}">${esc(statusLabel(item.status))}</span></td>
        <td>
          <div class="action-btns-cell">
            <button class="btn-action-icon btn-confirm" title="Tasdiqlash" data-action="confirm">✓</button>
            <button class="btn-action-icon" title="Yakunlash" data-action="complete">★</button>
            <button class="btn-action-icon btn-delete" title="Bekor qilish" data-action="cancel">✕</button>
          </div>
        </td>
      `;

      tr.querySelector('[data-action="confirm"]').addEventListener('click', () => updateStatus(item.id, 'Confirmed'));
      tr.querySelector('[data-action="complete"]').addEventListener('click', () => updateStatus(item.id, 'Completed'));
      tr.querySelector('[data-action="cancel"]').addEventListener('click', () => updateStatus(item.id, 'Cancelled'));
      tableBody.appendChild(tr);
    });
  }

  async function updateStatus(id, newStatus) {
    try {
      const updated = await api('PATCH', `/api/admin/appointments/${encodeURIComponent(id)}`, { status: newStatus });
      appointments = appointments.map(a => a.id === id ? updated : a);
      updateMetrics();
      renderTable();
    } catch (err) {
      alert(err.message);
    }
  }

  // --- Specialists ---
  function fillSpecialistSelects() {
    if (manualSpecialist && manualSalon) {
      const salon = manualSalon.value;
      manualSpecialist.innerHTML = '';
      specialists.filter(s => s.salon === salon).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.role})${s.onDuty ? '' : ' — dam olishda'}`;
        manualSpecialist.appendChild(opt);
      });
    }

    if (testBarberSelect) {
      testBarberSelect.innerHTML = '';
      specialists.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} ${s.chatId ? '🟢' : '⚪'}`;
        testBarberSelect.appendChild(opt);
      });
    }
  }

  function renderSpecialists() {
    fillSpecialistSelects();
    if (!specialistsGrid) return;
    specialistsGrid.innerHTML = '';

    specialists.forEach(sp => {
      const card = document.createElement('div');
      card.className = 'specialist-admin-card';

      const badge = sp.salon === 'homme'
        ? `<span class="sub-badge badge-homme" style="font-size: 0.65rem; padding: 2px 8px;">♂ MAN</span>`
        : `<span class="sub-badge badge-femme" style="font-size: 0.65rem; padding: 2px 8px;">♀ WO</span>`;
      const dutyBadge = sp.onDuty
        ? `<span class="status-badge status-confirmed">Ishda</span>`
        : `<span class="status-badge status-cancelled">Dam olishda</span>`;
      const tgLinked = sp.chatId
        ? `<span style="font-size: 0.7rem; color: #34d399;">🟢 Telegram ulangan</span>`
        : `<span style="font-size: 0.7rem; color: #94a3b8;">⚪ Telegram ulanmagan</span>`;

      card.innerHTML = `
        <div class="specialist-admin-top">
          <img src="${esc(sp.img || DEFAULT_AVATAR)}" alt="${esc(sp.name)}" class="specialist-admin-avatar">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <h4 style="color: #fff; font-size: 1.05rem;">${esc(sp.name)}</h4>
              ${badge}
            </div>
            <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 2px;">${esc(sp.role)}</span>
            <div style="margin-top: 4px; display: flex; gap: 8px; align-items: center;">
              <span style="font-size: 0.75rem; color: var(--blue-bright);">${esc(sp.telegram || '')}</span>
              ${tgLinked}
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
          <span>📞 ${esc(sp.phone || "Noma'lum")}</span>
          <span>⏱ Tajriba: ${esc(sp.experience || "Noma'lum")}</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
          <div>${dutyBadge}</div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-panel btn-panel-secondary" style="padding: 6px 12px; font-size: 0.75rem;" data-action="toggle-duty">${sp.onDuty ? 'Dam olishga' : 'Ishga'}</button>
            <button class="btn-panel btn-panel-secondary" style="padding: 6px 12px; font-size: 0.75rem;" data-action="edit-barber">✏️ Tahrirlash</button>
            <button class="btn-panel btn-panel-secondary" style="padding: 6px 10px; font-size: 0.75rem; color: #f87171;" data-action="delete-barber">🗑</button>
          </div>
        </div>
      `;

      card.querySelector('img').addEventListener('error', (e) => { e.target.src = DEFAULT_AVATAR; }, { once: true });
      card.querySelector('[data-action="toggle-duty"]').addEventListener('click', () => saveSpecialist(sp.id, { ...sp, onDuty: !sp.onDuty }));
      card.querySelector('[data-action="edit-barber"]').addEventListener('click', () => openEditBarberModal(sp));
      card.querySelector('[data-action="delete-barber"]').addEventListener('click', async () => {
        if (!confirm(`Rostdan ham ${sp.name}ni o'chirmoqchimisiz?`)) return;
        try {
          await api('DELETE', `/api/admin/specialists/${encodeURIComponent(sp.id)}`);
          specialists = specialists.filter(s => s.id !== sp.id);
          renderAll();
        } catch (err) {
          alert(err.message);
        }
      });

      specialistsGrid.appendChild(card);
    });
  }

  async function saveSpecialist(id, data) {
    try {
      if (id) {
        const updated = await api('PUT', `/api/admin/specialists/${encodeURIComponent(id)}`, data);
        specialists = specialists.map(s => s.id === id ? updated : s);
      } else {
        specialists.push(await api('POST', '/api/admin/specialists', data));
      }
      renderAll();
      return true;
    } catch (err) {
      alert(err.message);
      return false;
    }
  }

  // --- Add / Edit Master Modal ---
  function openAddBarberModal() {
    barberModalTitle.textContent = currentLang === 'ru' ? 'Добавить мастера' : "Yangi Usta Qo'shish";
    barberEditId.value = '';
    [barberNameInput, barberRoleInput, barberPhoneInput, barberTelegramInput, barberChatIdInput, barberImgInput, barberExpInput]
      .forEach(el => { el.value = ''; });
    barberSalonSelect.value = 'homme';
    barberDutySelect.value = 'true';
    barberModal.classList.add('open');
  }

  function openEditBarberModal(barber) {
    barberModalTitle.textContent = currentLang === 'ru' ? `Редактировать: ${barber.name}` : `${barber.name}ni Tahrirlash`;
    barberEditId.value = barber.id;
    barberNameInput.value = barber.name || '';
    barberSalonSelect.value = barber.salon || 'homme';
    barberRoleInput.value = barber.role || '';
    barberPhoneInput.value = barber.phone || '';
    barberTelegramInput.value = barber.telegram || '';
    barberChatIdInput.value = barber.chatId || '';
    barberImgInput.value = barber.img || '';
    barberExpInput.value = barber.experience || '';
    barberDutySelect.value = barber.onDuty ? 'true' : 'false';
    barberModal.classList.add('open');
  }

  if (btnOpenAddBarberModal) btnOpenAddBarberModal.addEventListener('click', openAddBarberModal);
  [closeBarberModal, cancelBarberModal].forEach(b => {
    if (b) b.addEventListener('click', () => barberModal.classList.remove('open'));
  });

  if (saveBarberBtn) {
    saveBarberBtn.addEventListener('click', async () => {
      const name = barberNameInput.value.trim();
      const role = barberRoleInput.value.trim();
      if (!name || !role) {
        alert("Iltimos, usta ismi va mutaxassisligini kiriting!");
        return;
      }
      const ok = await saveSpecialist(barberEditId.value, {
        name, role,
        salon: barberSalonSelect.value,
        phone: barberPhoneInput.value.trim(),
        telegram: barberTelegramInput.value.trim(),
        chatId: barberChatIdInput.value.trim(),
        img: barberImgInput.value.trim(),
        experience: barberExpInput.value.trim(),
        onDuty: barberDutySelect.value === 'true'
      });
      if (ok) barberModal.classList.remove('open');
    });
  }

  // --- Telegram Tab ---
  function setTgBadge(kind, textValue) {
    if (!tgConnectionStatusBadge) return;
    tgConnectionStatusBadge.className = `status-badge ${kind}`;
    tgConnectionStatusBadge.textContent = textValue;
  }

  function copyButton(btn, value) {
    btn.addEventListener('click', () => {
      const done = () => {
        const old = btn.textContent;
        btn.textContent = '✓ Nusxalandi!';
        setTimeout(() => { btn.textContent = old; }, 2000);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(value).then(done, () => prompt('Havolani nusxalang:', value));
      else prompt('Havolani nusxalang:', value);
    });
  }

  function renderTelegramSection() {
    if (tgStatus) {
      if (tgBotTokenInput) {
        tgBotTokenInput.placeholder = tgStatus.tokenSet ? `Saqlangan: ${tgStatus.tokenMasked}` : '7123456789:AAFlkBj...';
        tgBotTokenInput.disabled = tgStatus.tokenFromEnv;
      }
      if (tgAdminChatInput && document.activeElement !== tgAdminChatInput) tgAdminChatInput.value = tgStatus.adminChatId || '';
      if (tgStatus.botUsername) setTgBadge('status-confirmed', `🟢 Ulangan: @${tgStatus.botUsername}`);
      else if (tgStatus.tokenSet) setTgBadge('status-cancelled', "🔴 Token bor, lekin Telegram'ga ulanib bo'lmadi");
      else setTgBadge('status-pending', '⚪ Bot tokeni kiritilmagan');

      if (tgAdminLinkBox) {
        tgAdminLinkBox.innerHTML = '';
        if (tgStatus.adminLink) {
          const status = tgStatus.adminChatId
            ? `<span style="color: #34d399;">🟢 Admin chati ulangan (${esc(tgStatus.adminChatId)})</span>`
            : `<span style="color: #f59e0b;">⚪ Admin chati hali ulanmagan</span>`;
          tgAdminLinkBox.innerHTML = `
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">${status}<br>Barcha buyurtmalar sizga ham kelishi uchun quyidagi havolani Telegram'da oching:</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <code style="font-size: 0.7rem; color: var(--text-subtle); word-break: break-all; flex: 1;">${esc(tgStatus.adminLink)}</code>
              <button class="copy-chip-btn" type="button">📋 Nusxalash</button>
            </div>`;
          copyButton(tgAdminLinkBox.querySelector('button'), tgStatus.adminLink);
        }
      }
    }

    if (!barberLinkingList) return;
    barberLinkingList.innerHTML = '';
    if (!tgStatus || !tgStatus.botUsername) {
      barberLinkingList.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted);">Avval chap tomonda bot tokenini saqlang — keyin har bir usta uchun shaxsiy havola paydo bo'ladi.</p>`;
      return;
    }

    specialists.forEach(sp => {
      const item = document.createElement('div');
      item.className = 'linking-item';
      const linkStatus = sp.chatId
        ? `<span style="font-size: 0.72rem; color: #34d399;">🟢 Ulangan</span>`
        : `<span style="font-size: 0.72rem; color: #f59e0b;">⚪ Bog'lanmagan</span>`;
      item.innerHTML = `
        <div class="linking-item-info">
          <strong style="color: #fff; font-size: 0.88rem;">${esc(sp.name)} <span style="font-size: 0.75rem; color: var(--text-muted);">(${esc(sp.role)})</span></strong>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${linkStatus}
            <span style="font-size: 0.72rem; color: var(--text-subtle); word-break: break-all;">${esc(sp.link)}</span>
          </div>
        </div>
        <button class="copy-chip-btn" type="button">📋 Havolani Nusxalash</button>
      `;
      copyButton(item.querySelector('button'), sp.link);
      barberLinkingList.appendChild(item);
    });
  }

  if (btnToggleTokenVisibility) {
    btnToggleTokenVisibility.addEventListener('click', () => {
      const isPass = tgBotTokenInput.type === 'password';
      tgBotTokenInput.type = isPass ? 'text' : 'password';
      btnToggleTokenVisibility.textContent = isPass ? 'Yashirish' : "Ko'rish";
    });
  }

  if (btnTestTgConnection) {
    btnTestTgConnection.addEventListener('click', async () => {
      setTgBadge('status-pending', '⏳ Tekshirilmoqda...');
      try {
        tgStatus = await api('GET', '/api/admin/telegram');
        specialists = await api('GET', '/api/admin/specialists');
        renderAll();
      } catch (err) {
        setTgBadge('status-cancelled', `🔴 ${err.message}`);
      }
    });
  }

  if (btnSaveTgConfig) {
    btnSaveTgConfig.addEventListener('click', async () => {
      const body = { adminChatId: tgAdminChatInput.value.trim() };
      const token = tgBotTokenInput.value.trim();
      if (token) body.botToken = token;
      setTgBadge('status-pending', '⏳ Saqlanmoqda...');
      try {
        tgStatus = await api('POST', '/api/admin/telegram', body);
        tgBotTokenInput.value = '';
        specialists = await api('GET', '/api/admin/specialists');
        renderAll();
        alert('✅ Telegram sozlamalari saqlandi!');
      } catch (err) {
        renderTelegramSection();
        alert(err.message);
      }
    });
  }

  if (btnSendTestAlert) {
    btnSendTestAlert.addEventListener('click', async () => {
      try {
        await api('POST', '/api/admin/telegram/test', { specialistId: testBarberSelect.value });
        alert("✅ Test xabari yuborildi! Ustaning Telegram'ini tekshiring.");
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // --- Tabs ---
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');
      viewAppointments.style.display = tab === 'appointments' ? 'block' : 'none';
      viewSpecialists.style.display = tab === 'specialists' ? 'block' : 'none';
      viewTelegram.style.display = tab === 'telegram' ? 'block' : 'none';
      if (btnHeaderAction) btnHeaderAction.style.display = tab === 'appointments' ? 'inline-flex' : 'none';
    });
  });

  // --- Manual Booking Modal ---
  if (btnHeaderAction) {
    btnHeaderAction.addEventListener('click', () => {
      fillSpecialistSelects();
      document.getElementById('manualDate').value = localDateStr();
      manualBookingModal.classList.add('open');
    });
  }
  if (manualSalon) manualSalon.addEventListener('change', fillSpecialistSelects);

  [closeManualModal, cancelManualBooking].forEach(b => {
    if (b) b.addEventListener('click', () => manualBookingModal.classList.remove('open'));
  });

  if (saveManualBooking) {
    saveManualBooking.addEventListener('click', async () => {
      const name = document.getElementById('manualName').value.trim();
      const phone = document.getElementById('manualPhone').value.trim();
      const salon = manualSalon.value;
      if (!name || !phone) {
        alert('Iltimos, mijoz ismi va telefon raqamini kiriting!');
        return;
      }
      if (!manualSpecialist.value) {
        alert("Bu zalda usta yo'q. Avval usta qo'shing.");
        return;
      }
      try {
        const appt = await api('POST', '/api/admin/appointments', {
          clientName: name,
          clientPhone: phone,
          salon,
          serviceTitle: salon === 'homme' ? 'Erkaklar soch turmagi' : 'Ayollar soch turmagi',
          specialistId: manualSpecialist.value,
          date: document.getElementById('manualDate').value || localDateStr(),
          timeSlot: document.getElementById('manualTimeSlot').value
        });
        appointments.unshift(appt);
        manualBookingModal.classList.remove('open');
        document.getElementById('manualName').value = '';
        document.getElementById('manualPhone').value = '';
        renderAll();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  // --- Export JSON ---
  if (btnExportJSON) {
    btnExportJSON.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(appointments, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `woman_buyurtmalar_${localDateStr()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  searchInput.addEventListener('input', renderTable);
  filterSalon.addEventListener('change', renderTable);
  filterStatus.addEventListener('change', renderTable);

  function renderAll() {
    updateMetrics();
    renderTable();
    renderSpecialists();
    renderTelegramSection();
  }

  // --- Start ---
  applyLanguage(currentLang);
  if (authToken) {
    loadAll().then(startAutoRefresh).catch(() => { showLogin(); checkServer(); });
  } else {
    showLogin();
    checkServer();
  }
});
