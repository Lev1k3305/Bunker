// =====================================================================
// SHELTER — клиентское мультиплеерное приложение (комнаты, реальные игроки)
// =====================================================================

(function () {
  'use strict';

  const SESSION_KEY = 'bunker_mp_session_v1';
  const DEFAULT_NAME_KEY = 'bunker_default_name_v1';
  const POLL_INTERVAL = 2500;
  const API_BASE = '/api/room';

  // TODO: замените на ссылку своего Telegram-канала (например 'https://t.me/my_channel')
  const TELEGRAM_CHANNEL_URL = 'https://t.me/';

  const ATTR_FIELDS = [
    { key: 'ageGender', label: 'Возраст / пол', icon: 'fa-id-card' },
    { key: 'health', label: 'Здоровье', icon: 'fa-heart-pulse' },
    { key: 'hobby', label: 'Хобби', icon: 'fa-mask' },
    { key: 'phobia', label: 'Фобия', icon: 'fa-eye' },
    { key: 'traitPositive', label: 'Черта характера (+)', icon: 'fa-thumbs-up' },
    { key: 'traitNegative', label: 'Черта характера (−)', icon: 'fa-thumbs-down' },
    { key: 'inventory', label: 'Инвентарь', icon: 'fa-box-archive' },
    { key: 'extraInfo', label: 'Доп. информация', icon: 'fa-file-lines' },
  ];

  const ERROR_MESSAGES = {
    room_not_found: 'Комната не найдена. Проверьте код.',
    slot_not_found: 'Такого места не существует.',
    slot_taken: 'Это место уже занято другим игроком.',
    only_host: 'Это действие доступно только хосту комнаты.',
    only_host_can_start: 'Начать игру может только хост.',
    not_enough_players: 'Нужно минимум 2 занятых места, чтобы начать игру.',
    bad_field: 'Некорректное поле характеристики.',
    not_joined: 'Вы ещё не заняли место в этой комнате.',
    already_revealed: 'Нельзя перебросить уже раскрытую характеристику.',
    voting_locked: 'Голосование ещё не открыто.',
    vote_already_active: 'Голосование уже идёт.',
    no_active_vote: 'Сейчас нет активного голосования.',
    vote_expired: 'Время голосования истекло.',
    target_not_found: 'Выбранный игрок не найден.',
    excluded_cannot_vote: 'Исключённые игроки не могут голосовать.',
    empty_message: 'Сообщение не может быть пустым.',
    only_host_or_expired: 'Завершить голосование раньше времени может только хост.',
    player_not_found: 'Игрок не найден.',
  };

  // ---------------------------------------------------------------------
  // Состояние клиента
  // ---------------------------------------------------------------------

  let session = getSession();           // { code, token } | null
  let lastData = null;                  // последний ответ /state
  let currentView = null;               // home | seat-select | lobby | catastrophe | game
  let pollHandle = null;
  let tickHandle = null;

  let homeScreen = 'landing';   // 'landing' | 'play' | 'settings'
  let createCount = 8;
  let joinCodeDraft = '';
  let pendingSlot = null;

  let seenEventRound = null;
  let seenSituationSig = undefined;
  let lastKnownStatus = null;
  let autoFinalizeInFlight = false;

  const appEl = document.getElementById('app');
  let toastContainer = null;

  // ---------------------------------------------------------------------
  // Инициализация
  // ---------------------------------------------------------------------

  function init() {
    ensureToastContainer();

    const params = new URLSearchParams(location.search);
    const roomFromUrl = (params.get('room') || '').toUpperCase().trim();

    if (session && session.code) {
      startPolling();
    } else if (roomFromUrl) {
      homeScreen = 'play';
      joinCodeDraft = roomFromUrl;
      renderHome();
    } else {
      renderHome();
    }

    if (!tickHandle) {
      tickHandle = setInterval(tick, 250);
    }

    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      if (loader) loader.classList.add('hidden');
    }, 500);
  }

  function ensureToastContainer() {
    toastContainer = document.getElementById('global-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      toastContainer.id = 'global-toast-container';
      document.body.appendChild(toastContainer);
    }
  }

  // ---------------------------------------------------------------------
  // Сессия (localStorage: только код комнаты + токен игрока)
  // ---------------------------------------------------------------------

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.code) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function setSession(code, token) {
    session = { code: (code || '').toUpperCase(), token: token || null };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* ignore */ }
  }

  function clearSession() {
    session = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  function getDefaultName() {
    try { return localStorage.getItem(DEFAULT_NAME_KEY) || ''; } catch (e) { return ''; }
  }

  function setDefaultName(name) {
    try {
      if (name) localStorage.setItem(DEFAULT_NAME_KEY, name);
      else localStorage.removeItem(DEFAULT_NAME_KEY);
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------
  // API helper
  // ---------------------------------------------------------------------

  async function api(method, path, body) {
    const headers = {};
    if (session && session.token) headers['X-Player-Token'] = session.token;
    const res = await axios({ method, url: API_BASE + path, data: body, headers });
    return res.data;
  }

  function errorMessageFrom(e) {
    const code = e && e.response && e.response.data && e.response.data.error;
    return ERROR_MESSAGES[code] || 'Что-то пошло не так. Попробуйте ещё раз.';
  }

  // ---------------------------------------------------------------------
  // Поллинг состояния комнаты
  // ---------------------------------------------------------------------

  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
  }

  function startPolling() {
    stopPolling();
    pollOnce();
    pollHandle = setInterval(pollOnce, POLL_INTERVAL);
  }

  async function pollOnce() {
    if (!session || !session.code) return;
    try {
      const data = await api('get', `/${session.code}/state`);
      lastData = data;
      render();
    } catch (e) {
      const code = e && e.response && e.response.data && e.response.data.error;
      if (code === 'room_not_found') {
        showToast('Комната не найдена', 'Возможно, комната была удалена или код неверен.', 'fa-triangle-exclamation');
        clearSession();
        stopPolling();
        lastData = null;
        currentView = null;
        renderHome();
      }
      // прочие ошибки — временный сбой сети, просто ждём следующий тик
    }
  }

  // ---------------------------------------------------------------------
  // Сохранение значений полей ввода при полной перерисовке (чтобы не терять фокус/текст)
  // ---------------------------------------------------------------------

  function preserveInputs(ids) {
    const out = {};
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        out[id] = {
          value: el.value,
          focused: document.activeElement === el,
          selStart: el.selectionStart,
          selEnd: el.selectionEnd,
        };
      }
    });
    return out;
  }

  function restoreInputs(vals) {
    Object.entries(vals).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v.value;
      if (v.focused) {
        el.focus();
        try { el.setSelectionRange(v.selStart, v.selEnd); } catch (e) { /* ignore */ }
      }
    });
  }

  function captureChatScroll() {
    const el = document.getElementById('chat-messages');
    if (!el) return null;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    return { atBottom, scrollTop: el.scrollTop };
  }

  function restoreChatScroll(saved) {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    if (!saved || saved.atBottom) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = saved.scrollTop;
    }
  }

  // ---------------------------------------------------------------------
  // Главный рендер-диспетчер
  // ---------------------------------------------------------------------

  function computeView(data) {
    if (!session || !session.token) return 'seat-select';
    if (!data || !data.room) return 'seat-select';
    if (data.room.status === 'catastrophe') return 'catastrophe';
    if (data.room.status === 'game' || data.room.status === 'ended') return 'game';
    return 'lobby';
  }

  function render() {
    const data = lastData;
    const view = data ? computeView(data) : 'home';

    if (data && data.room && data.room.status !== lastKnownStatus) {
      if (data.room.status === 'catastrophe') {
        seenEventRound = 0;
        seenSituationSig = null;
      }
      lastKnownStatus = data.room.status;
    }

    currentView = view;

    const preserved = preserveInputs(['seat-name-input', 'chat-input', 'join-code-input', 'discussion-seconds-input', 'voting-seconds-input']);
    const chatScroll = captureChatScroll();

    if (view === 'seat-select') renderSeatSelect(data);
    else if (view === 'lobby') renderLobby(data);
    else if (view === 'catastrophe') renderCatastrophe(data);
    else if (view === 'game') renderGame(data);
    else renderHome();

    restoreInputs(preserved);
    restoreChatScroll(chatScroll);

    if (data) checkAutoModals(data);
  }

  function tick() {
    document.querySelectorAll('[data-ends-at]').forEach((el) => {
      const endsAt = Number(el.dataset.endsAt);
      const remain = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      el.textContent = formatCountdown(remain);
      el.classList.toggle('urgent', remain <= 15 && remain > 0);
      el.classList.toggle('expired', remain <= 0);
    });
    maybeAutoFinalizeVote();
  }

  function formatCountdown(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function maybeAutoFinalizeVote() {
    if (!lastData || !lastData.voting || lastData.voting.status !== 'active') return;
    if (!lastData.room || !lastData.me) return;
    if (lastData.me.id !== lastData.room.hostPlayerId) return;
    if (Number(lastData.voting.endsAt) > Date.now()) return;
    if (autoFinalizeInFlight) return;
    autoFinalizeInFlight = true;
    try {
      await api('post', `/${session.code}/vote/finalize`, {});
      await pollOnce();
    } catch (e) { /* ignore */ } finally {
      autoFinalizeInFlight = false;
    }
  }

  // ---------------------------------------------------------------------
  // ГЛАВНАЯ (создание / вход в комнату)
  // ---------------------------------------------------------------------

  function renderHome() {
    if (homeScreen === 'play') renderPlayScreen();
    else if (homeScreen === 'settings') renderSettingsScreen();
    else renderLandingScreen();
  }

  // --- Общий блок «Правила игры» (используется в лобби, настройках и подсказке) ---

  function fullRulesGridHtml() {
    return `
      <div class="rules-grid">
        <div class="rule-item"><i class="fa-solid fa-1"></i><div>
          <div class="rule-h">Катастрофа и бункер</div>
          <div class="rule-t">Хост объявляет катастрофу, уничтожившую мир на поверхности, и параметры бункера. Мест на всех не хватит.</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-2"></i><div>
          <div class="rule-h">Секретное досье — только для тебя</div>
          <div class="rule-t">Каждый получает карточку: профессия видна сразу, а возраст, здоровье, фобия, хобби, черты характера, инвентарь — видны только тебе, пока ты сам их не раскроешь.</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-3"></i><div>
          <div class="rule-h">Раунды и раскрытие</div>
          <div class="rule-t">В каждом раунде игроки по очереди раскрывают характеристики и рассказывают о себе вслух, чтобы убедить остальных оставить их в бункере.</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-4"></i><div>
          <div class="rule-h">Ситуации</div>
          <div class="rule-t">Хост периодически озвучивает случайные ситуации в бункере — их нужно обсудить в чате или вслух и принять решение сообща.</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-5"></i><div>
          <div class="rule-h">Голосование с таймером</div>
          <div class="rule-t">Начиная с 3-го раунда открывается голосование на время: все решают, кто покинет бункер. Исключённый выбывает из игры.</div>
        </div></div>
        <div class="rule-item"><i class="fa-solid fa-6"></i><div>
          <div class="rule-h">Победа</div>
          <div class="rule-t">Игра продолжается, пока не останется ровно столько выживших, сколько мест в бункере — они и побеждают.</div>
        </div></div>
      </div>
    `;
  }

  function showRulesModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box rules-modal-box">
        <div class="rules-title"><i class="fa-solid fa-book-open"></i> Правила игры «Shelter»</div>
        ${fullRulesGridHtml()}
        <div class="modal-actions" style="margin-top:18px;">
          <button class="btn btn-primary" id="rules-modal-close-btn"><i class="fa-solid fa-check"></i> Понятно</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('rules-modal-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // --- СТРАНИЦА 1: лендинг / главное меню ---------------------------------

  function renderLandingScreen() {
    currentView = 'home';
    appEl.innerHTML = `
      <div class="screen mp-home-screen">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-radiation"></i>
            <h1>SHELTER</h1>
          </div>
          <div class="subtitle">сетевая игра на выживание — каждый со своего устройства</div>

          <div class="landing-layout">
            <div class="landing-actions">
              <button class="btn btn-primary btn-lg" id="landing-play-btn"><i class="fa-solid fa-play"></i> Играть</button>
              <button class="btn btn-secondary" id="landing-settings-btn"><i class="fa-solid fa-gear"></i> Настройки</button>
              <button class="btn btn-secondary" id="landing-support-btn"><i class="fa-brands fa-telegram"></i> Наш Telegram-канал</button>
            </div>

            <div class="panel rules-panel landing-howto">
              <div class="stamp-corner">Секретно</div>
              <div class="rules-title"><i class="fa-solid fa-circle-info"></i> Как это работает</div>
              <div class="rules-grid rules-grid-single">
                <div class="rule-item"><i class="fa-solid fa-1"></i><div>
                  <div class="rule-h">Создайте комнату</div>
                  <div class="rule-t">Вы создаёте комнату и получаете короткий код.</div>
                </div></div>
                <div class="rule-item"><i class="fa-solid fa-2"></i><div>
                  <div class="rule-h">Позовите игроков</div>
                  <div class="rule-t">Передайте код остальным — каждый заходит на этот же сайт со своего устройства.</div>
                </div></div>
                <div class="rule-item"><i class="fa-solid fa-3"></i><div>
                  <div class="rule-h">Займите место</div>
                  <div class="rule-t">Каждый выбирает своё место в лобби и вписывает имя.</div>
                </div></div>
                <div class="rule-item"><i class="fa-solid fa-4"></i><div>
                  <div class="rule-h">Хост управляет игрой</div>
                  <div class="rule-t">Первый занявший место становится хостом и запускает катастрофу.</div>
                </div></div>
                <div class="rule-item"><i class="fa-solid fa-5"></i><div>
                  <div class="rule-h">Ваша тайна — только ваша</div>
                  <div class="rule-t">Свои характеристики видите только вы — другим они не видны, пока вы сами их не раскроете.</div>
                </div></div>
              </div>
            </div>
          </div>

          <div class="app-footer">© SHELTER — сетевая игра на выживание</div>
        </div>
      </div>
    `;

    document.getElementById('landing-play-btn').addEventListener('click', () => { homeScreen = 'play'; renderHome(); });
    document.getElementById('landing-settings-btn').addEventListener('click', () => { homeScreen = 'settings'; renderHome(); });
    document.getElementById('landing-support-btn').addEventListener('click', () => {
      window.open(TELEGRAM_CHANNEL_URL, '_blank', 'noopener');
    });
  }

  // --- СТРАНИЦА 2: играть (создать комнату / войти по коду) ---------------

  function renderPlayScreen() {
    currentView = 'home';
    appEl.innerHTML = `
      <div class="screen mp-home-screen">
        <div class="container">
          <button class="btn btn-ghost back-btn" id="play-back-btn"><i class="fa-solid fa-arrow-left"></i> Назад</button>
          <div class="top-title">
            <i class="fa-solid fa-radiation"></i>
            <h1>ИГРАТЬ</h1>
          </div>
          <div class="subtitle">создайте комнату или войдите в существующую</div>

          <div class="play-layout">
            <div class="panel mp-panel play-panel">
              ${createPanelHtml()}
            </div>

            <div class="play-divider"><span>или</span></div>

            <div class="panel mp-panel play-panel">
              ${joinPanelHtml()}
            </div>
          </div>

          <div class="app-footer">© SHELTER — сетевая игра на выживание</div>
        </div>
      </div>
    `;

    document.getElementById('play-back-btn').addEventListener('click', () => { homeScreen = 'landing'; renderHome(); });

    const slider = document.getElementById('create-count-slider');
    const countVal = document.getElementById('create-count-val');
    slider.addEventListener('input', () => {
      countVal.textContent = slider.value;
      createCount = Number(slider.value);
    });
    document.getElementById('create-room-btn').addEventListener('click', handleCreateRoom);

    const input = document.getElementById('join-code-input');
    input.addEventListener('input', () => {
      joinCodeDraft = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      input.value = joinCodeDraft;
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleJoinByCode(); });
    document.getElementById('join-room-btn').addEventListener('click', handleJoinByCode);
  }

  // --- СТРАНИЦА 3: настройки (заглушка) ------------------------------------

  function renderSettingsScreen() {
    currentView = 'home';
    const savedName = getDefaultName();
    appEl.innerHTML = `
      <div class="screen mp-home-screen">
        <div class="container">
          <button class="btn btn-ghost back-btn" id="settings-back-btn"><i class="fa-solid fa-arrow-left"></i> Назад</button>
          <div class="top-title">
            <i class="fa-solid fa-gear"></i>
            <h1>НАСТРОЙКИ</h1>
          </div>

          <div class="settings-layout">
            <div class="panel mp-panel settings-section">
              <div class="rules-title"><i class="fa-solid fa-id-badge"></i> Имя по умолчанию</div>
              <div class="setup-hint" style="margin-top:0;margin-bottom:14px;">Это имя будет автоматически предложено, когда вы занимаете место в новой комнате. Можно изменить его в любой момент перед подтверждением.</div>
              <div class="setup-field">
                <input type="text" id="default-name-input" class="name-input-lg" placeholder="Например, Алекс" maxlength="24" autocomplete="off" value="${escapeHtml(savedName)}" />
              </div>
              <div class="setup-actions" style="margin-top:16px;">
                <button class="btn btn-primary" id="default-name-save-btn"><i class="fa-solid fa-floppy-disk"></i> Сохранить</button>
              </div>
            </div>

            <div class="panel rules-panel settings-section">
              <div class="rules-title"><i class="fa-solid fa-book-open"></i> Правила игры</div>
              ${fullRulesGridHtml()}
            </div>

            <div class="panel mp-panel settings-section">
              <div class="rules-title"><i class="fa-solid fa-circle-info"></i> О проекте</div>
              <div class="about-text">
                <p>«SHELTER» — бесплатная сетевая игра-ролевая дискуссия о выживших в укрытии после катастрофы. Проект создан независимыми разработчиками и не связан с правообладателями каких-либо коммерческих настольных игр.</p>
                <p>Каждый игрок заходит со своего устройства по коду комнаты — сервер хранит характеристики персонажей приватно и раскрывает их только по решению самого игрока.</p>
                <p>Проект развивается силами энтузиастов. Если он вам нравится — подпишитесь на наш Telegram-канал, там мы рассказываем о новых возможностях и обновлениях.</p>
              </div>
              <div class="setup-actions" style="margin-top:20px;">
                <button class="btn btn-secondary" id="settings-support-btn"><i class="fa-brands fa-telegram"></i> Наш Telegram-канал</button>
              </div>
            </div>
          </div>

          <div class="app-footer">© SHELTER — сетевая игра на выживание</div>
        </div>
      </div>
    `;

    const back = () => { homeScreen = 'landing'; renderHome(); };
    document.getElementById('settings-back-btn').addEventListener('click', back);

    document.getElementById('default-name-save-btn').addEventListener('click', () => {
      const input = document.getElementById('default-name-input');
      const name = (input.value || '').trim().slice(0, 24);
      setDefaultName(name);
      showToast('Сохранено', name ? `Имя по умолчанию: ${escapeHtml(name)}.` : 'Имя по умолчанию очищено.', 'fa-floppy-disk');
    });

    document.getElementById('settings-support-btn').addEventListener('click', () => {
      window.open(TELEGRAM_CHANNEL_URL, '_blank', 'noopener');
    });
  }

  function createPanelHtml() {
    return `
      <div class="stamp-corner">Секретно</div>
      <div class="rules-title"><i class="fa-solid fa-plus"></i> Создать комнату</div>
      <div class="setup-field">
        <label>Количество мест в игре: <span class="val" id="create-count-val">${createCount}</span></label>
        <input type="range" id="create-count-slider" min="4" max="16" step="1" value="${createCount}" />
        <div class="setup-hint">Каждый реальный игрок сам займёт своё место в лобби со своего устройства — по коду комнаты.</div>
      </div>
      <div class="setup-field">
        <label>Как это работает</label>
        <div class="setup-hint">
          1. Вы создаёте комнату и получаете короткий код.<br/>
          2. Передайте код остальным игрокам — каждый заходит на этот же сайт и вводит код.<br/>
          3. Каждый выбирает своё место и вписывает имя — так определяется, кто есть кто.<br/>
          4. Первый занявший место становится хостом и управляет ходом игры.<br/>
          5. В начале игры только вы видите свои характеристики — другим они не видны, пока вы сами их не раскроете.
        </div>
      </div>
      <div class="setup-actions">
        <button class="btn btn-primary" id="create-room-btn"><i class="fa-solid fa-door-open"></i> Создать комнату</button>
      </div>
    `;
  }

  function joinPanelHtml() {
    return `
      <div class="rules-title"><i class="fa-solid fa-right-to-bracket"></i> Войти по коду</div>
      <div class="setup-field" style="text-align:center;">
        <label>Код комнаты</label>
        <input type="text" id="join-code-input" class="room-code-input" placeholder="XXXXX" maxlength="5" value="${escapeHtml(joinCodeDraft)}" autocomplete="off" autocapitalize="characters" />
        <div class="setup-hint">Получите код у того, кто создал комнату, и введите его здесь, чтобы выбрать своё место.</div>
      </div>
      <div class="setup-actions">
        <button class="btn btn-primary" id="join-room-btn"><i class="fa-solid fa-right-to-bracket"></i> Войти</button>
      </div>
    `;
  }

  async function handleCreateRoom() {
    const btn = document.getElementById('create-room-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Создание...';
    try {
      const res = await api('post', '/create', { playerCount: createCount });
      seenEventRound = null;
      seenSituationSig = undefined;
      lastKnownStatus = null;
      setSession(res.code, null);
      startPolling();
    } catch (e) {
      showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-door-open"></i> Создать комнату';
    }
  }

  function handleJoinByCode() {
    const code = (joinCodeDraft || '').toUpperCase().trim();
    if (code.length !== 5) {
      showToast('Некорректный код', 'Код комнаты состоит из 5 символов.', 'fa-triangle-exclamation');
      return;
    }
    seenEventRound = null;
    seenSituationSig = undefined;
    lastKnownStatus = null;
    setSession(code, null);
    startPolling();
  }

  // ---------------------------------------------------------------------
  // ВЫБОР МЕСТА (до получения токена)
  // ---------------------------------------------------------------------

  function renderSeatSelect(data) {
    if (!data || !data.room) {
      appEl.innerHTML = `
        <div class="screen" style="display:flex;align-items:center;justify-content:center;">
          <div class="container" style="text-align:center;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:32px;color:var(--rust-light);"></i>
            <p class="setup-hint" style="margin-top:16px;">Подключение к комнате ${escapeHtml(session ? session.code : '')}...</p>
          </div>
        </div>
      `;
      return;
    }

    const room = data.room;
    const players = data.players || [];
    const gameStarted = room.status !== 'lobby';

    appEl.innerHTML = `
      <div class="screen">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-people-roof"></i>
            <h1>КОМНАТА</h1>
          </div>
          ${roomCodeBadgeHtml(room.code)}
          <div class="subtitle">выбери своё место<span class="divider"></span>${players.filter(p => p.claimed).length} / ${players.length} занято</div>

          ${gameStarted ? `
            <div class="panel mp-panel" style="text-align:center;">
              <i class="fa-solid fa-hourglass-half" style="font-size:32px;color:var(--warning);margin-bottom:14px;"></i>
              <p>Игра в этой комнате уже началась. Дождитесь новой игры или попросите хоста нажать «Новая игра».</p>
              <button class="btn btn-secondary" id="seat-back-btn"><i class="fa-solid fa-arrow-left"></i> Назад</button>
            </div>
          ` : `
            <div class="panel mp-panel">
              <div class="seat-grid" id="seat-grid">
                ${players.map((p) => seatCellHtml(p, { hostId: room.hostPlayerId, clickable: true })).join('')}
              </div>
            </div>
            <div class="panel name-claim-panel ${pendingSlot ? '' : 'hidden'}" id="name-claim-panel">
              ${pendingSlot ? `
                <div class="rules-title" style="margin-bottom:14px;"><i class="fa-solid fa-user-pen"></i> Место №${pendingSlot}</div>
                <input type="text" id="seat-name-input" class="name-input-lg" placeholder="Твоё имя" maxlength="24" autocomplete="off" value="${escapeHtml(getDefaultName())}" />
                <div class="modal-actions" style="margin-top:16px;">
                  <button class="btn btn-secondary" id="seat-cancel-btn">Отмена</button>
                  <button class="btn btn-primary" id="seat-confirm-btn"><i class="fa-solid fa-check"></i> Занять место</button>
                </div>
              ` : ''}
            </div>
          `}

          <div class="setup-actions" style="margin-top:20px;">
            <button class="btn btn-ghost" id="leave-home-btn"><i class="fa-solid fa-arrow-left"></i> Выйти в главное меню</button>
          </div>

          <div class="app-footer">© SHELTER — сетевая настольная игра на выживание</div>
        </div>
      </div>
    `;

    attachRoomCodeCopy();

    const backBtn = document.getElementById('seat-back-btn');
    if (backBtn) backBtn.addEventListener('click', handleLeaveToHome);

    document.getElementById('leave-home-btn').addEventListener('click', handleLeaveToHome);

    if (!gameStarted) {
      document.querySelectorAll('#seat-grid .seat-cell.empty').forEach((cell) => {
        cell.addEventListener('click', () => {
          pendingSlot = Number(cell.dataset.slot);
          render();
          setTimeout(() => {
            const input = document.getElementById('seat-name-input');
            if (input) input.focus();
          }, 30);
        });
      });

      const cancelBtn = document.getElementById('seat-cancel-btn');
      if (cancelBtn) cancelBtn.addEventListener('click', () => { pendingSlot = null; render(); });

      const confirmBtn = document.getElementById('seat-confirm-btn');
      if (confirmBtn) confirmBtn.addEventListener('click', handleClaimSeat);

      const nameInput = document.getElementById('seat-name-input');
      if (nameInput) nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleClaimSeat(); });
    }
  }

  async function handleClaimSeat() {
    const input = document.getElementById('seat-name-input');
    const name = (input ? input.value : '').trim().slice(0, 24);
    if (!name) {
      showToast('Введите имя', 'Пожалуйста, впишите своё имя перед тем, как занять место.', 'fa-triangle-exclamation');
      return;
    }
    const btn = document.getElementById('seat-confirm-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Занимаем...'; }
    try {
      const res = await api('post', `/${session.code}/join`, { slot: pendingSlot, name });
      setSession(session.code, res.token);
      setDefaultName(name);
      pendingSlot = null;
      lastData = res;
      render();
      showToast('Добро пожаловать!', `Вы заняли место №${res.me ? res.me.slot : ''} как ${escapeHtml(name)}.`, 'fa-user-check');
    } catch (e) {
      showToast('Не удалось занять место', errorMessageFrom(e), 'fa-triangle-exclamation');
      pendingSlot = null;
      render();
    }
  }

  function handleLeaveToHome() {
    clearSession();
    stopPolling();
    lastData = null;
    currentView = null;
    pendingSlot = null;
    homeScreen = 'landing';
    renderHome();
  }

  function seatCellHtml(p, ctx) {
    const isHostSeat = ctx.hostId && p.id === ctx.hostId;
    if (!p.claimed) {
      return `<div class="seat-cell empty" data-slot="${p.slot}">
        <div class="seat-num">${p.slot}</div>
        <div class="seat-state"><i class="fa-solid fa-user-plus"></i> Свободно</div>
      </div>`;
    }
    return `<div class="seat-cell taken ${p.isMe ? 'mine' : ''}" data-slot="${p.slot}">
      <div class="seat-num">${p.slot}</div>
      <div class="seat-name">${escapeHtml(p.name)}</div>
      <div class="seat-badges">
        ${p.isMe ? '<span class="me-badge">Ты</span>' : ''}
        ${isHostSeat ? '<span class="host-badge" title="Хост"><i class="fa-solid fa-crown"></i></span>' : ''}
        ${p.excluded ? '<span class="excluded-badge" title="Исключён"><i class="fa-solid fa-user-slash"></i></span>' : ''}
      </div>
    </div>`;
  }

  function roomCodeBadgeHtml(code) {
    return `
      <div class="room-code-badge">
        <span>Код комнаты:</span>
        <span class="code-text">${escapeHtml(code)}</span>
        <button class="copy-code-btn" id="copy-code-btn" title="Скопировать ссылку-приглашение"><i class="fa-solid fa-copy"></i></button>
      </div>
    `;
  }

  function attachRoomCodeCopy() {
    const btn = document.getElementById('copy-code-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const code = session ? session.code : '';
      const url = `${location.origin}${location.pathname}?room=${code}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast('Скопировано', 'Ссылка-приглашение скопирована в буфер обмена.', 'fa-copy');
      } catch (e) {
        showToast('Код комнаты', code, 'fa-copy');
      }
    });
  }

  // ---------------------------------------------------------------------
  // ЛОББИ (уже занял место, ожидание старта игры)
  // ---------------------------------------------------------------------

  function renderLobby(data) {
    const room = data.room;
    const players = data.players || [];
    const me = data.me;
    const isHost = !!(me && room.hostPlayerId === me.id);
    const claimedCount = players.filter((p) => p.claimed).length;
    const hostPlayer = players.find((p) => p.id === room.hostPlayerId);

    appEl.innerHTML = `
      <div class="screen">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-people-roof"></i>
            <h1>ЛОББИ</h1>
          </div>
          ${roomCodeBadgeHtml(room.code)}
          <div class="subtitle">знакомство перед спуском<span class="divider"></span>${claimedCount} / ${players.length} игроков в комнате</div>

          <div class="panel rules-panel">
            <div class="rules-title"><i class="fa-solid fa-book-open"></i> Правила игры «Shelter»</div>
            ${fullRulesGridHtml()}
          </div>

          <div class="panel mp-panel">
            <div class="rules-title"><i class="fa-solid fa-signature"></i> Игроки в лобби</div>
            <div class="seat-grid" id="seat-grid">
              ${players.map((p) => seatCellHtml(p, { hostId: room.hostPlayerId, clickable: false })).join('')}
            </div>
          </div>

          <div class="catastrophe-actions">
            ${isHost ? `
              <button class="btn btn-primary" id="lobby-start-btn" ${claimedCount < 2 ? 'disabled' : ''}>
                <i class="fa-solid fa-door-closed"></i> Начать катастрофу
              </button>
              ${claimedCount < 2 ? '<div class="setup-hint">Нужно минимум 2 занятых места, чтобы начать игру.</div>' : ''}
            ` : `
              <div class="setup-hint"><i class="fa-solid fa-hourglass-half"></i> Ожидаем, пока хост${hostPlayer ? ' (' + escapeHtml(hostPlayer.name) + ')' : ''} начнёт игру...</div>
            `}
          </div>

          <div class="setup-actions">
            <button class="btn btn-ghost" id="leave-home-btn"><i class="fa-solid fa-arrow-right-from-bracket"></i> Покинуть комнату</button>
          </div>

          <div class="app-footer">© SHELTER — сетевая настольная игра на выживание</div>
        </div>
      </div>
    `;

    attachRoomCodeCopy();
    document.getElementById('leave-home-btn').addEventListener('click', handleLeaveToHome);

    const startBtn = document.getElementById('lobby-start-btn');
    if (startBtn) startBtn.addEventListener('click', handleStartGame);
  }

  async function handleStartGame() {
    const btn = document.getElementById('lobby-start-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Генерация катастрофы...'; }
    try {
      await api('post', `/${session.code}/start`, {});
      await pollOnce();
    } catch (e) {
      showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation');
      render();
    }
  }

  // ---------------------------------------------------------------------
  // КАТАСТРОФА
  // ---------------------------------------------------------------------

  function renderCatastrophe(data) {
    const room = data.room;
    const me = data.me;
    const isHost = !!(me && room.hostPlayerId === me.id);
    const catastrophe = room.catastrophe || { icon: 'fa-radiation', title: '...', description: '' };
    const bunker = room.bunker || {};

    appEl.innerHTML = `
      <div class="catastrophe-screen">
        <div class="catastrophe-alert"><i class="fa-solid fa-triangle-exclamation"></i> Внимание — глобальная катастрофа <i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="panel catastrophe-card">
          ${roomCodeBadgeHtml(room.code)}
          <i class="fa-solid ${catastrophe.icon} catastrophe-icon"></i>
          <h2 class="catastrophe-title">${escapeHtml(catastrophe.title)}</h2>
          <p class="catastrophe-desc">${escapeHtml(catastrophe.description || '')}</p>

          <div class="bunker-params">
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-ruler-combined"></i>Площадь</div><div class="value">${escapeHtml(bunker.size || '')}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-hourglass-half"></i>Срок пребывания</div><div class="value">${escapeHtml(bunker.duration || '')}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-layer-group"></i>Этажность</div><div class="value">${escapeHtml(bunker.floors || '')}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-door-open"></i>Доп. помещение</div><div class="value">${escapeHtml(bunker.extraRoom || '')}</div></div>
            <div class="bunker-param"><div class="label"><i class="fa-solid fa-drumstick-bite"></i>Запасы провизии</div><div class="value">${escapeHtml(bunker.foodSupply || '')}</div></div>
          </div>

          <div class="catastrophe-actions">
            ${isHost ? `
              <button class="btn btn-secondary" id="reroll-catastrophe"><i class="fa-solid fa-rotate"></i> Другая катастрофа</button>
              <button class="btn btn-secondary" id="reroll-bunker"><i class="fa-solid fa-rotate"></i> Другой бункер</button>
              <button class="btn btn-primary" id="enter-bunker"><i class="fa-solid fa-people-group"></i> Спуститься в бункер</button>
            ` : `
              <div class="setup-hint"><i class="fa-solid fa-hourglass-half"></i> Хост изучает катастрофу — скоро все спустятся в бункер...</div>
            `}
          </div>
        </div>
        <div class="app-footer">© SHELTER — сетевая настольная игра на выживание</div>
      </div>
    `;

    attachRoomCodeCopy();

    const rerollC = document.getElementById('reroll-catastrophe');
    if (rerollC) rerollC.addEventListener('click', async () => {
      try { await api('post', `/${session.code}/reroll-catastrophe`, {}); await pollOnce(); }
      catch (e) { showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });

    const rerollB = document.getElementById('reroll-bunker');
    if (rerollB) rerollB.addEventListener('click', async () => {
      try { await api('post', `/${session.code}/reroll-bunker`, {}); await pollOnce(); }
      catch (e) { showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });

    const enterBtn = document.getElementById('enter-bunker');
    if (enterBtn) enterBtn.addEventListener('click', async () => {
      try { await api('post', `/${session.code}/enter-bunker`, {}); await pollOnce(); }
      catch (e) { showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });
  }

  // ---------------------------------------------------------------------
  // ИГРА (основной экран)
  // ---------------------------------------------------------------------

  function renderGame(data) {
    const room = data.room;
    const players = data.players || [];
    const me = data.me;
    const isHost = !!(me && room.hostPlayerId === me.id);
    const aliveCount = players.filter((p) => !p.excluded && p.claimed).length;
    const totalCount = players.filter((p) => p.claimed).length || players.length;
    const pct = totalCount ? Math.min(100, Math.round((aliveCount / totalCount) * 100)) : 0;
    const votingUnlocked = room.round >= room.votingThreshold;
    const timer = room.timer;

    appEl.innerHTML = `
      <div class="screen" style="padding-top:0;">
        <div class="game-topbar">
          <div class="brand"><i class="fa-solid fa-radiation"></i> SHELTER</div>
          <div class="room-code-badge small">${escapeHtml(room.code)}</div>
          <div class="round-badge"><i class="fa-solid fa-hourglass-half"></i> Раунд ${room.round}</div>
          ${timer ? `<div class="timer-pill ${timer.type}">${timer.type === 'voting' ? '🗳' : '⏱'} <span data-ends-at="${timer.endsAt}">--:--</span></div>` : ''}
          <div class="topbar-actions">
            ${isHost ? `
              <button class="btn btn-secondary" id="situation-btn"><i class="fa-solid fa-triangle-exclamation"></i> Ситуация</button>
              <button class="btn btn-secondary" id="next-round-btn"><i class="fa-solid fa-forward"></i> Следующий раунд</button>
              <button class="btn btn-ghost" id="reset-game-btn"><i class="fa-solid fa-rotate-left"></i> Новая игра</button>
            ` : ''}
            <button class="btn btn-ghost" id="rules-hint-btn" title="Правила игры"><i class="fa-solid fa-circle-question"></i></button>
            <button class="btn btn-ghost" id="leave-home-btn"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
          </div>
        </div>

        <div class="survivors-bar-wrap">
          <div class="survivors-bar-label">
            <span><i class="fa-solid fa-people-roof"></i> Выживших в бункере: ${aliveCount} / ${totalCount}</span>
            <span>${votingUnlocked ? '<i class="fa-solid fa-unlock" style="color:var(--toxic);"></i> Голосование доступно' : `Голосование откроется в раунде ${room.votingThreshold}`}</span>
          </div>
          <div class="survivors-bar"><div class="survivors-bar-fill ${pct < 40 ? 'over' : ''}" style="width:${pct}%"></div></div>
        </div>

        <div class="info-strip">
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid ${room.catastrophe ? room.catastrophe.icon : 'fa-radiation'}"></i>Катастрофа</div><div class="mini-value">${escapeHtml(room.catastrophe ? room.catastrophe.title : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-ruler-combined"></i>Бункер</div><div class="mini-value">${escapeHtml(room.bunker ? room.bunker.size : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-hourglass-half"></i>Срок</div><div class="mini-value">${escapeHtml(room.bunker ? room.bunker.duration : '—')}</div></div>
          <div class="panel mini-panel"><div class="mini-title"><i class="fa-solid fa-drumstick-bite"></i>Провизия</div><div class="mini-value">${escapeHtml(room.bunker ? room.bunker.foodSupply : '—')}</div></div>
        </div>

        <div class="main-columns">
          <div class="players-grid" id="players-grid">
            ${players.filter((p) => p.claimed).map((p) => renderPlayerCardMp(p, { isHost, room, data })).join('')}
          </div>
          <aside class="side-panel">
            <div class="panel voting-card" id="voting-card">${renderVotingCardHtml(data, isHost)}</div>
            <div class="panel chat-card" id="chat-card">${renderChatCardHtml(data, isHost)}</div>
          </aside>
        </div>

        <div class="app-footer">© SHELTER — сетевая настольная игра на выживание</div>
      </div>
    `;

    attachGameHandlers(data, isHost);
  }

  function renderPlayerCardMp(p, ctx) {
    const initial = (p.name || '?').trim().charAt(0).toUpperCase() || '?';
    const isHostSeat = ctx.room.hostPlayerId === p.id;
    const isMe = !!p.isMe;
    const votingActive = ctx.data.voting && ctx.data.voting.status === 'active';
    const meExcluded = !!(ctx.data.players.find((x) => x.isMe) || {}).excluded;
    const canVoteFor = votingActive && !isMe && !p.excluded && !meExcluded;
    const myVoteTargetId = ctx.data.voting ? ctx.data.voting.myVoteTargetId : null;

    return `
      <div class="player-card ${p.excluded ? 'excluded' : ''} ${isMe ? 'is-me' : ''}" id="card-${p.id}">
        <div class="player-card-head">
          <div class="player-avatar">${initial}</div>
          <div class="player-name-static">
            ${escapeHtml(p.name)}
            ${isMe ? '<span class="me-badge">Ты</span>' : ''}
            ${isHostSeat ? '<span class="host-badge" title="Хост"><i class="fa-solid fa-crown"></i></span>' : ''}
          </div>
          <div class="player-card-actions">
            ${ctx.isHost ? `<button class="icon-toggle ${p.excluded ? 'active' : ''}" data-action="exclude" data-target-id="${p.id}" title="Исключить/вернуть"><i class="fa-solid ${p.excluded ? 'fa-user-check' : 'fa-user-slash'}"></i></button>` : ''}
          </div>
        </div>

        <div class="player-profession-strip">
          <i class="fa-solid fa-briefcase"></i>
          <div><span class="prof-label">Профессия</span><span class="prof-text">${escapeHtml(p.profession || '')}</span></div>
        </div>

        <div class="attributes-list">
          ${ATTR_FIELDS.map((f) => renderAttrRowMp(p, f, isMe)).join('')}
        </div>

        ${canVoteFor ? `
          <button class="vote-target-btn ${myVoteTargetId === p.id ? 'chosen' : ''}" data-action="vote" data-target-id="${p.id}">
            <i class="fa-solid fa-square-poll-vertical"></i> ${myVoteTargetId === p.id ? 'Твой голос' : 'Голосовать против'}
          </button>
        ` : ''}
      </div>
    `;
  }

  function renderAttrRowMp(p, f, isMe) {
    const revealed = !!(p.revealed && p.revealed[f.key]);
    const value = p[f.key];
    const classes = ['attr-row'];
    if (isMe) classes.push('mine');
    classes.push(revealed ? 'revealed' : 'hidden-state');

    const head = isMe
      ? `<div class="attr-row-head attr-head-toggle" data-action="reveal" data-field="${f.key}">
           <div class="attr-label"><i class="fa-solid ${f.icon}"></i>${f.label}</div>
           ${revealed
              ? `<i class="fa-solid fa-lock-open" style="color:var(--rust-light);font-size:11px;"></i>`
              : `<div class="attr-lock">
                   <button class="attr-reroll" data-action="reroll" data-field="${f.key}" title="Перебросить, пока скрыто от других"><i class="fa-solid fa-dice"></i></button>
                   <i class="fa-solid fa-lock"></i>
                 </div>`}
         </div>`
      : `<div class="attr-row-head">
           <div class="attr-label"><i class="fa-solid ${f.icon}"></i>${f.label}</div>
           ${revealed ? `<i class="fa-solid fa-eye" style="color:var(--rust-light);font-size:11px;"></i>` : `<i class="fa-solid fa-lock" style="font-size:11px;color:var(--text-faint);"></i>`}
         </div>`;

    const showValue = isMe || revealed;
    return `<div class="${classes.join(' ')}">${head}${showValue ? `<div class="attr-value">${escapeHtml(String(value == null ? '' : value))}</div>` : ''}</div>`;
  }

  function renderVotingCardHtml(data, isHost) {
    const room = data.room;
    const voting = data.voting;
    const votingUnlocked = room.round >= room.votingThreshold;
    const alivePlayers = data.players.filter((p) => p.claimed && !p.excluded);
    const meExcluded = !!(data.players.find((p) => p.isMe) || {}).excluded;

    if (voting && voting.status === 'active') {
      const canFinalizeNow = isHost || Number(voting.endsAt) <= Date.now();
      return `
        <div class="voting-header">
          <div class="rules-title"><i class="fa-solid fa-square-poll-vertical"></i> Голосование — раунд ${voting.round}</div>
          <div class="timer-pill voting"><span data-ends-at="${voting.endsAt}">--:--</span></div>
        </div>
        <div class="voting-progress-note">Голосов подано: ${voting.votesCast} / ${voting.totalVoters}</div>
        <div class="voting-list">
          ${alivePlayers.map((p) => {
            const votes = voting.tally[p.id] || 0;
            const isTarget = voting.myVoteTargetId === p.id;
            return `
              <div class="voting-row">
                <div class="voting-name"><i class="fa-solid fa-user"></i> ${escapeHtml(p.name)}${p.isMe ? ' <span class="me-badge">Ты</span>' : ''}</div>
                <div class="voting-controls">
                  <span class="vote-count">${votes}</span>
                  ${(!p.isMe && !meExcluded) ? `<button class="vote-btn-small ${isTarget ? 'chosen' : ''}" data-action="vote" data-target-id="${p.id}" title="Голосовать против"><i class="fa-solid fa-hand-point-right"></i></button>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="modal-actions" style="margin-top:14px;">
          <button class="btn btn-danger" id="vote-finalize-btn" ${canFinalizeNow ? '' : 'disabled title="Завершить раньше времени может только хост"'}>
            <i class="fa-solid fa-flag-checkered"></i> Завершить голосование
          </button>
        </div>
      `;
    }

    if (voting && voting.status === 'finished' && voting.result) {
      const r = voting.result;
      let resultText = 'Никто не был исключён.';
      if (r.excludedPlayerId) {
        const target = data.players.find((p) => p.id === r.excludedPlayerId);
        resultText = `Исключён(а): ${target ? escapeHtml(target.name) : 'игрок'} (${r.tally[r.excludedPlayerId]} голос.)`;
      } else if (r.tie) {
        resultText = 'Ничья — никто не исключён.';
      }
      return `
        <div class="rules-title"><i class="fa-solid fa-square-poll-vertical"></i> Итоги голосования (раунд ${voting.round})</div>
        <p class="setup-hint" style="margin:10px 0 16px;">${resultText}</p>
        ${isHost && votingUnlocked ? `
          <div class="voting-start-row">
            <input type="number" id="voting-seconds-input" min="15" max="900" value="60" class="seconds-input" />
            <button class="btn btn-danger" id="vote-start-btn"><i class="fa-solid fa-square-poll-vertical"></i> Новое голосование</button>
          </div>
        ` : ''}
      `;
    }

    if (!votingUnlocked) {
      return `
        <div class="rules-title"><i class="fa-solid fa-lock"></i> Голосование</div>
        <p class="setup-hint">Голосование откроется начиная с ${room.votingThreshold}-го раунда. Сейчас раунд ${room.round}.</p>
      `;
    }

    return `
      <div class="rules-title"><i class="fa-solid fa-square-poll-vertical"></i> Голосование</div>
      ${isHost ? `
        <p class="setup-hint" style="margin-bottom:12px;">Запустите голосование за исключение — у всех будет ограниченное время на голос.</p>
        <div class="voting-start-row">
          <input type="number" id="voting-seconds-input" min="15" max="900" value="60" class="seconds-input" />
          <span class="seconds-label">сек.</span>
          <button class="btn btn-danger" id="vote-start-btn"><i class="fa-solid fa-square-poll-vertical"></i> Начать голосование</button>
        </div>
      ` : `<p class="setup-hint">Голосование доступно — хост может его запустить в любой момент.</p>`}
    `;
  }

  function renderChatCardHtml(data, isHost) {
    const room = data.room;
    const chat = data.chat || [];
    const discussionTimer = room.timer && room.timer.type === 'discussion' ? room.timer : null;

    return `
      <div class="chat-header">
        <div class="rules-title" style="margin-bottom:0;"><i class="fa-solid fa-comments"></i> Чат бункера</div>
        ${discussionTimer ? `<div class="timer-pill discussion"><i class="fa-solid fa-hourglass-half"></i> <span data-ends-at="${discussionTimer.endsAt}">--:--</span></div>` : ''}
      </div>
      ${isHost ? `
        <div class="discussion-timer-controls">
          <input type="number" id="discussion-seconds-input" min="15" max="1800" value="${discussionTimer ? discussionTimer.seconds : 180}" class="seconds-input" />
          <span class="seconds-label">сек.</span>
          <button class="btn btn-secondary btn-xs" id="discussion-start-btn"><i class="fa-solid fa-hourglass-start"></i> Таймер обсуждения</button>
          ${discussionTimer ? `<button class="btn btn-ghost btn-xs" id="discussion-cancel-btn"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>
      ` : ''}
      <div class="chat-messages" id="chat-messages">
        ${chat.map((m) => chatMessageHtml(m)).join('')}
      </div>
      <div class="chat-form">
        <input type="text" id="chat-input" class="chat-input" placeholder="Написать сообщение..." maxlength="500" autocomplete="off" />
        <button class="btn btn-primary btn-xs" id="chat-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    `;
  }

  function chatMessageHtml(m) {
    if (m.type === 'system') {
      return `<div class="chat-message system"><i class="fa-solid fa-tower-broadcast"></i> ${escapeHtml(m.text)}</div>`;
    }
    return `<div class="chat-message">
      <span class="chat-author">${escapeHtml(m.playerName || 'Игрок')}:</span>
      <span class="chat-text">${escapeHtml(m.text)}</span>
    </div>`;
  }

  function attachGameHandlers(data, isHost) {
    attachRoomCodeCopy();

    const leaveBtn = document.getElementById('leave-home-btn');
    if (leaveBtn) leaveBtn.addEventListener('click', handleLeaveToHome);

    const rulesHintBtn = document.getElementById('rules-hint-btn');
    if (rulesHintBtn) rulesHintBtn.addEventListener('click', showRulesModal);

    const grid = document.getElementById('players-grid');
    if (grid) grid.addEventListener('click', onPlayersGridClick);

    const votingCard = document.getElementById('voting-card');
    if (votingCard) votingCard.addEventListener('click', onVotingCardClick);

    if (isHost) {
      const situationBtn = document.getElementById('situation-btn');
      if (situationBtn) situationBtn.addEventListener('click', async () => {
        try { await api('post', `/${session.code}/situation`, {}); await pollOnce(); }
        catch (e) { showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation'); }
      });

      const nextRoundBtn = document.getElementById('next-round-btn');
      if (nextRoundBtn) nextRoundBtn.addEventListener('click', async () => {
        try { await api('post', `/${session.code}/next-round`, { seconds: 180 }); await pollOnce(); }
        catch (e) { showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation'); }
      });

      const resetBtn = document.getElementById('reset-game-btn');
      if (resetBtn) resetBtn.addEventListener('click', handleResetGameConfirm);

      const discussionStartBtn = document.getElementById('discussion-start-btn');
      if (discussionStartBtn) discussionStartBtn.addEventListener('click', async () => {
        const input = document.getElementById('discussion-seconds-input');
        const seconds = Math.min(Math.max(Number(input.value) || 180, 15), 1800);
        try { await api('post', `/${session.code}/timer/start`, { seconds, label: 'Обсуждение' }); await pollOnce(); }
        catch (e) { showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation'); }
      });

      const discussionCancelBtn = document.getElementById('discussion-cancel-btn');
      if (discussionCancelBtn) discussionCancelBtn.addEventListener('click', async () => {
        try { await api('post', `/${session.code}/timer/cancel`, {}); await pollOnce(); }
        catch (e) { /* ignore */ }
      });
    }

    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    if (chatSendBtn && chatInput) {
      const sendChat = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        try { await api('post', `/${session.code}/chat`, { text }); await pollOnce(); }
        catch (e) { showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation'); }
      };
      chatSendBtn.addEventListener('click', sendChat);
      chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    }
  }

  async function onPlayersGridClick(e) {
    const rerollBtn = e.target.closest('[data-action="reroll"]');
    if (rerollBtn) {
      e.stopPropagation();
      const field = rerollBtn.dataset.field;
      try { await api('post', `/${session.code}/reroll-attr`, { field }); await pollOnce(); }
      catch (err) { showToast('Ошибка', errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const revealHead = e.target.closest('[data-action="reveal"]');
    if (revealHead) {
      const field = revealHead.dataset.field;
      try { await api('post', `/${session.code}/reveal`, { field }); await pollOnce(); }
      catch (err) { showToast('Ошибка', errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const excludeBtn = e.target.closest('[data-action="exclude"]');
    if (excludeBtn) {
      const targetId = Number(excludeBtn.dataset.targetId);
      try { await api('post', `/${session.code}/exclude`, { playerId: targetId }); await pollOnce(); }
      catch (err) { showToast('Ошибка', errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const voteBtn = e.target.closest('[data-action="vote"]');
    if (voteBtn) {
      const targetId = Number(voteBtn.dataset.targetId);
      try { await api('post', `/${session.code}/vote/cast`, { targetPlayerId: targetId }); await pollOnce(); }
      catch (err) { showToast('Ошибка', errorMessageFrom(err), 'fa-triangle-exclamation'); }
    }
  }

  async function onVotingCardClick(e) {
    const startBtn = e.target.closest('#vote-start-btn');
    if (startBtn) {
      const input = document.getElementById('voting-seconds-input');
      const seconds = Math.min(Math.max(Number(input ? input.value : 60) || 60, 15), 900);
      try { await api('post', `/${session.code}/vote/start`, { seconds }); await pollOnce(); }
      catch (err) { showToast('Ошибка', errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const finalizeBtn = e.target.closest('#vote-finalize-btn');
    if (finalizeBtn) {
      try { await api('post', `/${session.code}/vote/finalize`, {}); await pollOnce(); }
      catch (err) { showToast('Ошибка', errorMessageFrom(err), 'fa-triangle-exclamation'); }
      return;
    }
    const voteBtn = e.target.closest('[data-action="vote"]');
    if (voteBtn) {
      const targetId = Number(voteBtn.dataset.targetId);
      try { await api('post', `/${session.code}/vote/cast`, { targetPlayerId: targetId }); await pollOnce(); }
      catch (err) { showToast('Ошибка', errorMessageFrom(err), 'fa-triangle-exclamation'); }
    }
  }

  function handleResetGameConfirm() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box">
        <i class="fa-solid fa-skull modal-icon" style="color:var(--danger);"></i>
        <h3>Начать новую игру?</h3>
        <p>Текущий прогресс (раунды, раскрытые характеристики, исключённые игроки) будет удалён для всех игроков комнаты. Все останутся на своих местах.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel-btn">Отмена</button>
          <button class="btn btn-danger" id="modal-confirm-btn"><i class="fa-solid fa-rotate-left"></i> Да, начать заново</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modal-cancel-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
      overlay.remove();
      try { await api('post', `/${session.code}/reset`, {}); await pollOnce(); }
      catch (e) { showToast('Ошибка', errorMessageFrom(e), 'fa-triangle-exclamation'); }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // ---------------------------------------------------------------------
  // Автоматические модалки: событие раунда и ситуация
  // ---------------------------------------------------------------------

  function checkAutoModals(data) {
    const room = data.room;
    if (!room) return;

    if (seenEventRound === null) {
      seenEventRound = room.round;
    } else if (room.event && room.round > seenEventRound) {
      seenEventRound = room.round;
      showEventModal(room.event, room.round);
    }

    const sig = room.situation ? JSON.stringify(room.situation) : null;
    if (seenSituationSig === undefined) {
      seenSituationSig = sig;
    } else if (sig && sig !== seenSituationSig) {
      seenSituationSig = sig;
      showSituationModal(room.situation);
    }
  }

  function showEventModal(eventText, round) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box">
        <i class="fa-solid fa-triangle-exclamation modal-icon"></i>
        <h3>Событие раунда ${round}</h3>
        <p>${escapeHtml(eventText)}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="modal-close-btn"><i class="fa-solid fa-check"></i> Понятно</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modal-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  function showSituationModal(s) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box situation-box">
        <div class="situation-category"><i class="fa-solid ${s.icon}"></i> ${escapeHtml(s.category)}</div>
        <h3>${escapeHtml(s.title)}</h3>
        <p class="situation-text">${escapeHtml(s.text)}</p>
        <div class="setup-hint" style="margin-bottom:18px;">Озвучьте эту ситуацию вслух всем участникам и обсудите в чате, как бункер будет действовать.</div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="situation-close-btn"><i class="fa-solid fa-check"></i> Обсудили</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('situation-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  // ---------------------------------------------------------------------
  // TOASTS
  // ---------------------------------------------------------------------

  function showToast(title, message, icon) {
    if (!toastContainer) ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="toast-title"><i class="fa-solid ${icon || 'fa-info-circle'}"></i>${escapeHtml(title)}</div>
      <div>${escapeHtml(message)}</div>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 320);
    }, 3600);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // -------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', init);
})();
