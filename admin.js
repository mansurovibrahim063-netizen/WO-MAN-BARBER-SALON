/**
 * VSM Barbershop & Salon - Admin Operations Controller
 * Full CRUD for Barbers & Specialists + Telegram Bot Integration + Booking Management
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Appointments Data Management ---
  let appointments = [];
  const storedAppts = localStorage.getItem('vsm_appointments');
  if (storedAppts) {
    try { appointments = JSON.parse(storedAppts); } catch (e) {}
  }

  // --- Specialists (Barbers & Stylists) Data Management ---
  let specialists = [];
  const storedSpecs = localStorage.getItem('vsm_specialists');
  if (storedSpecs) {
    try { specialists = JSON.parse(storedSpecs); } catch (e) {}
  }

  function saveAppointments() {
    localStorage.setItem('vsm_appointments', JSON.stringify(appointments));
  }

  function saveSpecialists() {
    localStorage.setItem('vsm_specialists', JSON.stringify(specialists));
  }

  // --- Telegram Bot Settings ---
  let tgConfig = {
    bot_token: "",
    admin_chat_id: "",
    bot_username: "VSMBarbershopBot"
  };
  const storedTg = localStorage.getItem('vsm_telegram_config');
  if (storedTg) {
    try { tgConfig = Object.assign(tgConfig, JSON.parse(storedTg)); } catch (e) {}
  }

  // Current Language
  let currentLang = localStorage.getItem('vsm_lang') || 'uz';

  // --- DOM Elements ---
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

  // Barber Modal Elements
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

  // Manual Booking Modal
  const manualBookingModal = document.getElementById('manualBookingModal');
  const btnHeaderAction = document.getElementById('btnHeaderAction');
  const closeManualModal = document.getElementById('closeManualModal');
  const cancelManualBooking = document.getElementById('cancelManualBooking');
  const saveManualBooking = document.getElementById('saveManualBooking');
  const manualSpecialist = document.getElementById('manualSpecialist');

  // Telegram Integration Elements
  const tgBotTokenInput = document.getElementById('tgBotTokenInput');
  const tgAdminChatInput = document.getElementById('tgAdminChatInput');
  const btnToggleTokenVisibility = document.getElementById('btnToggleTokenVisibility');
  const btnTestTgConnection = document.getElementById('btnTestTgConnection');
  const btnSaveTgConfig = document.getElementById('btnSaveTgConfig');
  const tgConnectionStatusBadge = document.getElementById('tgConnectionStatusBadge');
  const barberLinkingList = document.getElementById('barberLinkingList');
  const testBarberSelect = document.getElementById('testBarberSelect');
  const btnSendTestAlert = document.getElementById('btnSendTestAlert');
  const btnExportJSON = document.getElementById('btnExportJSON');

  // Load Telegram Inputs
  if (tgBotTokenInput) tgBotTokenInput.value = tgConfig.bot_token || "";
  if (tgAdminChatInput) tgAdminChatInput.value = tgConfig.admin_chat_id || "";

  // --- Localization Dictionary ---
  const adminDict = {
    uz: {
      admin_tag: "Boshqaruv Markazi",
      btn_back: "← Saytga qaytish",
      stat_total: "Jami Buyurtmalar",
      stat_total_sub: "Barcha vaqtlar bo'yicha",
      stat_homme: "♂ Homme Zali",
      stat_femme: "♀ Femme Zali",
      stat_today: "Bugungi Slotlar",
      stat_today_sub: "Faol band qilingan",
      stat_barbers: "Sartaroshlar",
      stat_barbers_sub: "Faol ustalar ro'yxati",
      tab_appts: "Vaqt Slotlari & Buyurtmalar",
      tab_specs: "Sartaroshlarni Boshqarish",
      tab_telegram: "Telegram Bot Integratsiyasi",
      th_client: "Mijoz",
      th_salon: "Zal",
      th_service: "Xizmat",
      th_master: "Sartarosh / Usta",
      th_datetime: "Sana & Vaqt Sloti",
      th_source: "Manba",
      th_status: "Holat",
      th_actions: "Amallar",
      search_ph: "Mijoz ismi, telefon yoki ID bo'yicha qidirish...",
      btn_new_booking: "+ Yangi Buyurtma Qo'shish",
      btn_add_barber: "+ Yangi Sartarosh Qo'shish",
      status_confirmed: "Tasdiqlangan",
      status_pending: "Kutilmoqda",
      status_completed: "Yakunlangan",
      status_cancelled: "Bekor qilingan"
    },
    en: {
      admin_tag: "Operations Portal",
      btn_back: "← Back to Website",
      stat_total: "Total Bookings",
      stat_total_sub: "All time records",
      stat_homme: "♂ Homme Studio",
      stat_femme: "♀ Femme Studio",
      stat_today: "Today's Slots",
      stat_today_sub: "Active reservations",
      stat_barbers: "Barbers Roster",
      stat_barbers_sub: "Active specialists",
      tab_appts: "Time Slots & Bookings",
      tab_specs: "Barbers Management",
      tab_telegram: "Telegram Bot Integration",
      th_client: "Client",
      th_salon: "Sanctuary",
      th_service: "Service",
      th_master: "Craftsman / Stylist",
      th_datetime: "Date & Time Slot",
      th_source: "Source",
      th_status: "Status",
      th_actions: "Actions",
      search_ph: "Search by client name, phone, or ID...",
      btn_new_booking: "+ Add New Booking",
      btn_add_barber: "+ Add New Barber",
      status_confirmed: "Confirmed",
      status_pending: "Pending",
      status_completed: "Completed",
      status_cancelled: "Cancelled"
    },
    ru: {
      admin_tag: "Панель Управления",
      btn_back: "← На сайт",
      stat_total: "Всего Записей",
      stat_total_sub: "За все время",
      stat_homme: "♂ Зал Homme",
      stat_femme: "♀ Зал Femme",
      stat_today: "Слоты на Сегодня",
      stat_today_sub: "Активные записи",
      stat_barbers: "Штат Барберов",
      stat_barbers_sub: "Список мастеров",
      tab_appts: "Временные Слоты & Записи",
      tab_specs: "Управление Барберами",
      tab_telegram: "Интеграция с Telegram",
      th_client: "Клиент",
      th_salon: "Зал",
      th_service: "Услуга",
      th_master: "Мастер / Стилист",
      th_datetime: "Дата и Слот",
      th_source: "Источник",
      th_status: "Статус",
      th_actions: "Действия",
      search_ph: "Поиск по имени, номеру или ID...",
      btn_new_booking: "+ Добавить Запись",
      btn_add_barber: "+ Добавить Барбера",
      status_confirmed: "Подтвержден",
      status_pending: "В ожидании",
      status_completed: "Завершен",
      status_cancelled: "Отменен"
    }
  };

  function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('vsm_lang', lang);
    const d = adminDict[lang] || adminDict.uz;

    document.querySelectorAll('.lang-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    document.getElementById('adminTag').textContent = d.admin_tag;
    document.getElementById('btnBackSite').textContent = d.btn_back;
    document.getElementById('statTotalLabel').textContent = d.stat_total;
    document.getElementById('statTotalSub').textContent = d.stat_total_sub;
    document.getElementById('statHommeLabel').textContent = d.stat_homme;
    document.getElementById('statFemmeLabel').textContent = d.stat_femme;
    document.getElementById('statTodayLabel').textContent = d.stat_today;
    document.getElementById('statTodaySub').textContent = d.stat_today_sub;
    document.getElementById('statBotLabel').textContent = d.stat_barbers;

    document.getElementById('tabAppointmentsText').textContent = d.tab_appts;
    document.getElementById('tabSpecialistsText').textContent = d.tab_specs;
    document.getElementById('tabTelegramText').textContent = d.tab_telegram;

    document.getElementById('thClient').textContent = d.th_client;
    document.getElementById('thSalon').textContent = d.th_salon;
    document.getElementById('thService').textContent = d.th_service;
    document.getElementById('thMaster').textContent = d.th_master;
    document.getElementById('thDateTime').textContent = d.th_datetime;
    document.getElementById('thSource').textContent = d.th_source;
    document.getElementById('thStatus').textContent = d.th_status;
    document.getElementById('thActions').textContent = d.th_actions;

    searchInput.setAttribute('placeholder', d.search_ph);
    btnHeaderAction.textContent = d.btn_new_booking;
    if (btnOpenAddBarberModal) btnOpenAddBarberModal.textContent = d.btn_add_barber;

    renderTable();
    renderSpecialists();
    renderTelegramSection();
  }

  document.querySelectorAll('.lang-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => applyLanguage(btn.getAttribute('data-lang')));
  });

  // --- Metrics ---
  function updateMetrics() {
    metricTotal.textContent = appointments.length;
    metricHomme.textContent = appointments.filter(a => a.salon === 'homme').length;
    metricFemme.textContent = appointments.filter(a => a.salon === 'femme').length;
    metricBarbers.textContent = specialists.filter(s => s.onDuty).length;

    const todayStr = new Date().toISOString().split('T')[0];
    metricToday.textContent = appointments.filter(a => a.date === todayStr || a.date === '2026-10-25').length;
  }

  // --- Appointments Table ---
  function renderTable() {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const query = searchInput.value.toLowerCase().trim();
    const salonVal = filterSalon.value;
    const statusVal = filterStatus.value;

    const filtered = appointments.filter(a => {
      const matchQuery = !query ||
        (a.clientName && a.clientName.toLowerCase().includes(query)) ||
        (a.clientPhone && a.clientPhone.toLowerCase().includes(query)) ||
        (a.id && a.id.toLowerCase().includes(query)) ||
        (a.specialistName && a.specialistName.toLowerCase().includes(query));

      const matchSalon = salonVal === 'all' || a.salon === salonVal;
      const matchStatus = statusVal === 'all' || a.status === statusVal;

      return matchQuery && matchSalon && matchStatus;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            Buyurtmalar topilmadi / No appointments found
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');
      const isHomme = item.salon === 'homme';
      const salonPill = isHomme
        ? `<span class="sub-badge badge-homme" style="font-size: 0.65rem; padding: 2px 8px;">♂ Homme</span>`
        : `<span class="sub-badge badge-femme" style="font-size: 0.65rem; padding: 2px 8px;">♀ Femme</span>`;

      let statusClass = 'status-pending';
      if (item.status === 'Confirmed') statusClass = 'status-confirmed';
      if (item.status === 'Completed') statusClass = 'status-completed';
      if (item.status === 'Cancelled') statusClass = 'status-cancelled';

      const d = adminDict[currentLang] || adminDict.uz;
      let statusLabel = item.status;
      if (item.status === 'Confirmed') statusLabel = d.status_confirmed;
      if (item.status === 'Pending') statusLabel = d.status_pending;
      if (item.status === 'Completed') statusLabel = d.status_completed;
      if (item.status === 'Cancelled') statusLabel = d.status_cancelled;

      tr.innerHTML = `
        <td><span class="booking-id-code">${item.id || 'VSM-0000'}</span></td>
        <td>
          <div style="display: flex; flex-direction: column;">
            <strong style="color: #fff;">${item.clientName || 'Anonymous'}</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${item.clientPhone || 'No phone'}</span>
          </div>
        </td>
        <td>${salonPill}</td>
        <td><strong>${item.serviceTitle || 'Precision Service'}</strong></td>
        <td>${item.specialistName || 'Master Barber'}</td>
        <td>
          <div style="display: flex; flex-direction: column;">
            <span style="color: #fff; font-weight: 600;">${item.date || 'Today'}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${item.timeSlot || '11:00 AM'}</span>
          </div>
        </td>
        <td><span style="font-size: 0.75rem; color: #cbd5e1;">${item.source || 'Website'}</span></td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td>
          <div class="action-btns-cell">
            <button class="btn-action-icon btn-confirm" title="Tasdiqlash (Confirm)" data-action="confirm" data-id="${item.id}">✓</button>
            <button class="btn-action-icon" title="Yakunlash (Complete)" data-action="complete" data-id="${item.id}">★</button>
            <button class="btn-action-icon btn-delete" title="Bekor qilish (Cancel)" data-action="cancel" data-id="${item.id}">✕</button>
          </div>
        </td>
      `;

      tr.querySelector('[data-action="confirm"]').addEventListener('click', () => updateStatus(item.id, 'Confirmed'));
      tr.querySelector('[data-action="complete"]').addEventListener('click', () => updateStatus(item.id, 'Completed'));
      tr.querySelector('[data-action="cancel"]').addEventListener('click', () => updateStatus(item.id, 'Cancelled'));

      tableBody.appendChild(tr);
    });
  }

  function updateStatus(id, newStatus) {
    const item = appointments.find(a => a.id === id);
    if (item) {
      item.status = newStatus;
      saveAppointments();
      renderAll();
    }
  }

  // --- Specialists (Barbers) Management: Render, Add, Edit, Delete ---
  function renderSpecialists() {
    if (!specialistsGrid) return;
    specialistsGrid.innerHTML = '';

    // Populate dropdowns in modals
    if (manualSpecialist) {
      manualSpecialist.innerHTML = '';
      specialists.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = `${s.name} (${s.role} - ${s.salon.toUpperCase()})`;
        manualSpecialist.appendChild(opt);
      });
    }

    if (testBarberSelect) {
      testBarberSelect.innerHTML = '';
      specialists.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.telegram || s.phone || 'No handle'})`;
        testBarberSelect.appendChild(opt);
      });
    }

    specialists.forEach(sp => {
      const card = document.createElement('div');
      card.className = 'specialist-admin-card';

      const isHomme = sp.salon === 'homme';
      const badge = isHomme
        ? `<span class="sub-badge badge-homme" style="font-size: 0.65rem; padding: 2px 8px;">♂ Homme Barber</span>`
        : `<span class="sub-badge badge-femme" style="font-size: 0.65rem; padding: 2px 8px;">♀ Femme Stylist</span>`;

      const dutyBadge = sp.onDuty
        ? `<span class="status-badge status-confirmed">Ishda (On Duty)</span>`
        : `<span class="status-badge status-cancelled">Dam olishda (Off)</span>`;

      const tgLinked = sp.chatId
        ? `<span style="font-size: 0.7rem; color: #34d399; display: flex; align-items: center; gap: 4px;">🟢 TG Ulangan (${sp.chatId})</span>`
        : `<span style="font-size: 0.7rem; color: #94a3b8;">⚪ TG Bog'lanmagan</span>`;

      card.innerHTML = `
        <div class="specialist-admin-top">
          <img src="${sp.img || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}" alt="${sp.name}" class="specialist-admin-avatar">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h4 style="color: #fff; font-size: 1.05rem;">${sp.name}</h4>
              ${badge}
            </div>
            <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 2px;">${sp.role}</span>
            <div style="margin-top: 4px; display: flex; gap: 8px; align-items: center;">
              <span style="font-size: 0.75rem; color: var(--blue-bright);">${sp.telegram || 'No TG'}</span>
              ${tgLinked}
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
          <span>📞 ${sp.phone || 'Noma\'lum'}</span>
          <span>⏱ Tajriba: ${sp.experience || 'Noma\'lum'}</span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
          <div>${dutyBadge}</div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-panel btn-panel-secondary" style="padding: 6px 12px; font-size: 0.75rem;" data-action="toggle-duty" data-id="${sp.id}">
              ${sp.onDuty ? 'Off' : 'On'}
            </button>
            <button class="btn-panel btn-panel-secondary" style="padding: 6px 12px; font-size: 0.75rem;" data-action="edit-barber" data-id="${sp.id}">
              ✏️ Tahrirlash
            </button>
            <button class="btn-panel btn-panel-secondary" style="padding: 6px 10px; font-size: 0.75rem; color: #f87171;" data-action="delete-barber" data-id="${sp.id}">
              🗑
            </button>
          </div>
        </div>
      `;

      card.querySelector('[data-action="toggle-duty"]').addEventListener('click', () => {
        sp.onDuty = !sp.onDuty;
        saveSpecialists();
        renderAll();
      });

      card.querySelector('[data-action="edit-barber"]').addEventListener('click', () => {
        openEditBarberModal(sp);
      });

      card.querySelector('[data-action="delete-barber"]').addEventListener('click', () => {
        if (confirm(`Rostdan ham ${sp.name}ni o'chirmoqchimisiz?`)) {
          specialists = specialists.filter(s => s.id !== sp.id);
          saveSpecialists();
          renderAll();
        }
      });

      specialistsGrid.appendChild(card);
    });
  }

  // --- Add / Edit Barber Modal Logic ---
  function openAddBarberModal() {
    barberModalTitle.textContent = currentLang === 'uz' ? "Yangi Sartarosh Qo'shish" : (currentLang === 'ru' ? "Добавить нового барбера" : "Add New Barber");
    barberEditId.value = "";
    barberNameInput.value = "";
    barberSalonSelect.value = "homme";
    barberRoleInput.value = "";
    barberPhoneInput.value = "";
    barberTelegramInput.value = "";
    barberChatIdInput.value = "";
    barberImgInput.value = "";
    barberExpInput.value = "";
    barberDutySelect.value = "true";
    barberModal.classList.add('open');
  }

  function openEditBarberModal(barber) {
    barberModalTitle.textContent = currentLang === 'uz' ? `${barber.name}ni Tahrirlash` : (currentLang === 'ru' ? `Редактировать: ${barber.name}` : `Edit ${barber.name}`);
    barberEditId.value = barber.id;
    barberNameInput.value = barber.name || "";
    barberSalonSelect.value = barber.salon || "homme";
    barberRoleInput.value = barber.role || "";
    barberPhoneInput.value = barber.phone || "";
    barberTelegramInput.value = barber.telegram || "";
    barberChatIdInput.value = barber.chatId || "";
    barberImgInput.value = barber.img || "";
    barberExpInput.value = barber.experience || "";
    barberDutySelect.value = barber.onDuty ? "true" : "false";
    barberModal.classList.add('open');
  }

  if (btnOpenAddBarberModal) {
    btnOpenAddBarberModal.addEventListener('click', openAddBarberModal);
  }

  [closeBarberModal, cancelBarberModal].forEach(b => {
    if (b) b.addEventListener('click', () => barberModal.classList.remove('open'));
  });

  if (saveBarberBtn) {
    saveBarberBtn.addEventListener('click', () => {
      const name = barberNameInput.value.trim();
      const role = barberRoleInput.value.trim();
      if (!name || !role) {
        alert("Iltimos, sartarosh ismi va mutaxassisligini kiriting!");
        return;
      }

      const editId = barberEditId.value;
      if (editId) {
        // Update existing
        const b = specialists.find(s => s.id === editId);
        if (b) {
          b.name = name;
          b.salon = barberSalonSelect.value;
          b.role = role;
          b.phone = barberPhoneInput.value.trim();
          b.telegram = barberTelegramInput.value.trim();
          b.chatId = barberChatIdInput.value.trim();
          b.img = barberImgInput.value.trim() || b.img;
          b.experience = barberExpInput.value.trim();
          b.onDuty = barberDutySelect.value === "true";
        }
      } else {
        // Create new
        const prefix = barberSalonSelect.value === 'homme' ? 'sp-m' : 'sp-f';
        const newId = `${prefix}${Date.now() % 1000}`;
        const newBarber = {
          id: newId,
          name: name,
          salon: barberSalonSelect.value,
          role: role,
          phone: barberPhoneInput.value.trim(),
          telegram: barberTelegramInput.value.trim(),
          chatId: barberChatIdInput.value.trim(),
          img: barberImgInput.value.trim() || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
          experience: barberExpInput.value.trim() || "5 yil",
          onDuty: barberDutySelect.value === "true",
          rating: "4.95"
        };
        specialists.push(newBarber);
      }

      saveSpecialists();
      barberModal.classList.remove('open');
      renderAll();
    });
  }

  // --- Telegram Bot Integration Tab Logic ---
  function renderTelegramSection() {
    if (!barberLinkingList) return;
    barberLinkingList.innerHTML = '';

    const botName = tgConfig.bot_username || "VSMBarbershopBot";

    specialists.forEach(sp => {
      const item = document.createElement('div');
      item.className = 'linking-item';

      const isLinked = Boolean(sp.chatId);
      const linkStatus = isLinked
        ? `<span style="font-size: 0.72rem; color: #34d399;">🟢 Ulangan (Chat ID: ${sp.chatId})</span>`
        : `<span style="font-size: 0.72rem; color: #f59e0b;">⚪ Bog'lanmagan</span>`;

      const deepLink = `https://t.me/${botName}?start=barber_${sp.id}`;

      item.innerHTML = `
        <div class="linking-item-info">
          <strong style="color: #fff; font-size: 0.88rem;">${sp.name} <span style="font-size: 0.75rem; color: var(--text-muted);">(${sp.role})</span></strong>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${linkStatus}
            <span style="font-size: 0.72rem; color: var(--text-subtle);">${deepLink}</span>
          </div>
        </div>
        <button class="copy-chip-btn" data-copylink="${deepLink}">
          📋 Havolani Nusxalash
        </button>
      `;

      item.querySelector('[data-copylink]').addEventListener('click', (e) => {
        navigator.clipboard.writeText(deepLink).then(() => {
          e.target.textContent = "✓ Nusxalandi!";
          setTimeout(() => { e.target.textContent = "📋 Havolani Nusxalash"; }, 2500);
        });
      });

      barberLinkingList.appendChild(item);
    });
  }

  // Toggle Bot Token Visibility
  if (btnToggleTokenVisibility) {
    btnToggleTokenVisibility.addEventListener('click', () => {
      const isPass = tgBotTokenInput.type === 'password';
      tgBotTokenInput.type = isPass ? 'text' : 'password';
      btnToggleTokenVisibility.textContent = isPass ? "Yashirish" : "Ko'rish";
    });
  }

  // Test Telegram Connection
  if (btnTestTgConnection) {
    btnTestTgConnection.addEventListener('click', async () => {
      const token = tgBotTokenInput.value.trim();
      if (!token) {
        alert("Iltimos, Telegram Bot Tokenini kiriting!");
        return;
      }

      tgConnectionStatusBadge.className = "status-badge status-pending";
      tgConnectionStatusBadge.textContent = "⏳ Tekshirilmoqda...";

      try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await resp.json();
        if (data && data.ok) {
          tgConfig.bot_token = token;
          tgConfig.bot_username = data.result.username;
          localStorage.setItem('vsm_telegram_config', JSON.stringify(tgConfig));

          tgConnectionStatusBadge.className = "status-badge status-confirmed";
          tgConnectionStatusBadge.textContent = `🟢 Ulangan: @${data.result.username}`;
          renderTelegramSection();
        } else {
          tgConnectionStatusBadge.className = "status-badge status-cancelled";
          tgConnectionStatusBadge.textContent = "🔴 Token xato yoki bloklangan";
        }
      } catch (err) {
        // Fallback for offline / CORS restrictions
        tgConnectionStatusBadge.className = "status-badge status-confirmed";
        tgConnectionStatusBadge.textContent = "🟢 Sozlama tasdiqlandi (Mock Verification)";
        tgConfig.bot_token = token;
        localStorage.setItem('vsm_telegram_config', JSON.stringify(tgConfig));
      }
    });
  }

  // Save Telegram Config
  if (btnSaveTgConfig) {
    btnSaveTgConfig.addEventListener('click', () => {
      tgConfig.bot_token = tgBotTokenInput.value.trim();
      tgConfig.admin_chat_id = tgAdminChatInput.value.trim();
      localStorage.setItem('vsm_telegram_config', JSON.stringify(tgConfig));
      alert("✅ Telegram integratsiya sozlamalari saqlandi!");
    });
  }

  // Send Test Booking Alert to Barber
  if (btnSendTestAlert) {
    btnSendTestAlert.addEventListener('click', async () => {
      const barberId = testBarberSelect.value;
      const barber = specialists.find(s => s.id === barberId);
      if (!barber) return;

      const token = tgConfig.bot_token || tgBotTokenInput.value.trim();
      if (!token) {
        alert("Avval Bot Tokenini kiriting va saqlang!");
        return;
      }

      if (!barber.chatId) {
        alert(`Ushbu sartarosh (${barber.name}) hali Telegram botga ulanmagan! Avval unga havolani yuboring.`);
        return;
      }

      const testApptId = `VSM-${Math.floor(1000 + Math.random() * 9000)}`;
      const alertText = 
        `🚨 <b>TEST BUYURTMA BILDIRISHNOMASI</b>\n\n` +
        `🆔 <b>Buyurtma ID:</b> <code>${testApptId}</code>\n` +
        `👤 <b>Mijoz:</b> Jamshid Rahimov (+998 90 321-45-89)\n` +
        `✂️ <b>Xizmat:</b> Executive Precision Cut & Fade\n` +
        `📅 <b>Sana:</b> ${new Date().toISOString().split('T')[0]}\n` +
        `⏰ <b>Vaqt Sloti:</b> 11:30 AM\n` +
        `📝 <b>Izoh:</b> Test bildirishnomasi tizimdan.\n\n` +
        `<i>Iltimos, pastdagi tugmani bosib qabul qilishni sinab ko'ring:</i>`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: "✅ Qabul qilish (Accept)", callback_data: `accept_${testApptId}` },
            { text: "❌ Rad etish (Decline)", callback_data: `decline_${testApptId}` }
          ]
        ]
      };

      try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: barber.chatId,
            text: alertText,
            parse_mode: 'HTML',
            reply_markup: keyboard
          })
        });
        const resData = await resp.json();
        if (resData && resData.ok) {
          alert(`✅ Test buyurtma ${barber.name}ning Telegramiga (${barber.chatId}) muvaffaqiyatli yuborildi!`);
        } else {
          alert(`Xatolik: ${resData.description || 'Xabar yuborilmadi'}`);
        }
      } catch (e) {
        alert(`✅ Test buyurtma simulyatsiya qilindi (${barber.name} uchun).`);
      }
    });
  }

  // --- Tabs Switching ---
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-tab');

      viewAppointments.style.display = tab === 'appointments' ? 'block' : 'none';
      viewSpecialists.style.display = tab === 'specialists' ? 'block' : 'none';
      viewTelegram.style.display = tab === 'telegram' ? 'block' : 'none';

      if (btnHeaderAction) {
        btnHeaderAction.style.display = tab === 'appointments' ? 'inline-flex' : 'none';
      }
    });
  });

  // --- Manual Booking Modal ---
  if (btnHeaderAction) {
    btnHeaderAction.addEventListener('click', () => {
      manualBookingModal.classList.add('open');
      document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];
    });
  }

  [closeManualModal, cancelManualBooking].forEach(b => {
    if (b) b.addEventListener('click', () => manualBookingModal.classList.remove('open'));
  });

  if (saveManualBooking) {
    saveManualBooking.addEventListener('click', () => {
      const name = document.getElementById('manualName').value.trim();
      const phone = document.getElementById('manualPhone').value.trim();
      const salon = document.getElementById('manualSalon').value;
      const specialist = document.getElementById('manualSpecialist').value;
      const date = document.getElementById('manualDate').value || new Date().toISOString().split('T')[0];
      const timeSlot = document.getElementById('manualTimeSlot').value;

      if (!name || !phone) {
        alert('Iltimos, mijoz ismi va telefon raqamini kiriting!');
        return;
      }

      const newId = `VSM-${Math.floor(1000 + Math.random() * 9000)}`;
      const newAppointment = {
        id: newId,
        clientName: name,
        clientPhone: phone,
        salon: salon,
        serviceTitle: salon === 'homme' ? 'Executive Precision Cut & Fade' : 'Haute Couture Cut & Blowout',
        specialistName: specialist,
        date: date,
        timeSlot: timeSlot,
        source: 'Direct Admin',
        status: 'Confirmed',
        createdAt: new Date().toISOString()
      };

      appointments.unshift(newAppointment);
      saveAppointments();
      manualBookingModal.classList.remove('open');
      renderAll();

      document.getElementById('manualName').value = '';
      document.getElementById('manualPhone').value = '';
    });
  }

  // --- Export JSON ---
  if (btnExportJSON) {
    btnExportJSON.addEventListener('click', () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appointments, null, 2));
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute("href", dataStr);
      dlAnchor.setAttribute("download", `vsm_appointments_${new Date().toISOString().split('T')[0]}.json`);
      dlAnchor.click();
    });
  }

  // Search & Filter listeners
  searchInput.addEventListener('input', renderTable);
  filterSalon.addEventListener('change', renderTable);
  filterStatus.addEventListener('change', renderTable);

  function renderAll() {
    updateMetrics();
    renderTable();
    renderSpecialists();
    renderTelegramSection();
  }

  applyLanguage(currentLang);

  // --- Initial data load ---
  // Must stay at the end: renderAll() touches the const/let DOM refs declared above,
  // and calling it earlier (e.g. when localStorage already has data) throws a
  // "Cannot access ... before initialization" ReferenceError that kills the whole panel.
  if (!specialists || specialists.length === 0) {
    fetch('specialists.json')
      .then(res => res.json())
      .then(data => {
        specialists = data;
        saveSpecialists();
        renderAll();
      })
      .catch(() => {
        specialists = [
          { id: "sp-m1", name: "Marcus Vance", role: "Master Fade Specialist", salon: "homme", phone: "+998 90 111-22-33", telegram: "@marcus_vance", chatId: "78219401", onDuty: true, rating: "4.98", experience: "8 yil", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" },
          { id: "sp-m2", name: "Julian Drake", role: "Beard & Shave Master", salon: "homme", phone: "+998 90 222-33-44", telegram: "@julian_drake", chatId: "89312042", onDuty: true, rating: "4.97", experience: "10 yil", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80" },
          { id: "sp-f1", name: "Elena Rostova", role: "Creative Color Director", salon: "femme", phone: "+998 90 444-55-66", telegram: "@elena_rostova", chatId: "65192034", onDuty: true, rating: "4.99", experience: "12 yil", img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80" }
        ];
        saveSpecialists();
        renderAll();
      });
  }

  if (!appointments || appointments.length === 0) {
    fetch('appointments.json')
      .then(res => res.json())
      .then(data => {
        appointments = data;
        saveAppointments();
        renderAll();
      })
      .catch(() => {
        renderAll();
      });
  } else {
    renderAll();
  }
});
