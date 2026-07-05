// =====================================================================
// БУНКЕР — клиентское приложение
// =====================================================================

(function () {
  'use strict';

  const STORAGE_KEY = 'bunker_game_state_v1';

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

  let state = null;
  const appEl = document.getElementById('app');

  // -------------------------------------------------------------------
  // Инициализация
  // -------------------------------------------------------------------

  function init() {
    const saved = loadState();
    if (saved) {
      state = saved;
      renderCurrentScreen();
    } else {
      state = { screen: 'setup', playerCount: 8 };
      renderCurrentScreen();
    }

    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      if (loader) loader.classList.add('hidden');
    }, 500);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore quota errors */ }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function resetGame() {
    localStorage.removeItem(STORAGE_KEY);
    state = { screen: 'setup', playerCount: 8 };
    renderCurrentScreen();
  }

  function renderCurrentScreen() {
    if (!state || state.screen === 'setup') renderSetupScreen();
    else if (state.screen === 'catastrophe') renderCatastropheScreen();
    else if (state.screen === 'game') renderGameScreen();
  }

  // -------------------------------------------------------------------
  // ЭКРАН НАСТРОЙКИ
  // -------------------------------------------------------------------

  function renderSetupScreen() {
    const count = state.playerCount || 8;
    appEl.innerHTML = `
      <div class="screen" style="display:flex;align-items:center;justify-content:center;">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-radiation"></i>
            <h1>БУНКЕР</h1>
          </div>
          <div class="subtitle">игра на выживание<span class="divider"></span>кто останется жить?</div>

          <div class="panel setup-panel">
            <div class="stamp-corner">Секретно</div>
            <div class="setup-field">
              <label>Количество выживших: <span class="val" id="count-val">${count}</span></label>
              <input type="range" id="player-count" min="4" max="16" step="1" value="${count}" />
              <div class="setup-hint">Рекомендуется от 6 до 12 игроков для оптимального баланса катастрофы и вместимости бункера.</div>
            </div>

            <div class="setup-field">
              <label>Как это работает</label>
              <div class="setup-hint">
                1. Генерируется случайная катастрофа и параметры бункера.<br/>
                2. Каждый игрок получает секретное досье: профессия, возраст, здоровье, фобия, хобби, черты характера, инвентарь.<br/>
                3. По раундам игроки раскрывают характеристики и голосованием решают, кого исключить из бункера — мест на всех не хватит!
              </div>
            </div>

            <div class="setup-actions">
              <button class="btn btn-primary" id="start-btn">
                <i class="fa-solid fa-door-closed"></i> Начать катастрофу
              </button>
            </div>
          </div>

          <div class="app-footer">© БУНКЕР — электронный помощник для настольной игры</div>
        </div>
      </div>
    `;

    const slider = document.getElementById('player-count');
    const countVal = document.getElementById('count-val');
    slider.addEventListener('input', () => {
      countVal.textContent = slider.value;
      state.playerCount = Number(slider.value);
    });

    document.getElementById('start-btn').addEventListener('click', startNewGame);
  }

  async function startNewGame() {
    const btn = document.getElementById('start-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Генерация катастрофы...';

    try {
      const res = await axios.post('/api/game/new', { playerCount: state.playerCount });
      const { catastrophe, bunker, players } = res.data;

      const preparedPlayers = players.map((p) => ({
        ...p,
        revealed: { profession: true },
        excluded: false,
      }));

      state = {
        screen: 'catastrophe',
        playerCount: state.playerCount,
        catastrophe,
        bunker,
        players: preparedPlayers,
        round: 0,
        events: [],
      };
      saveState();
      renderCurrentScreen();
    } catch (e) {
      alert('Ошибка генерации игры. Попробуйте снова.');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-door-closed"></i> Начать катастрофу';
    }
  }

  // -------------------------------------------------------------------
  // ЭКРАН КАТАСТРОФЫ
  // -------------------------------------------------------------------

  function renderCatastropheScreen() {
    const { catastrophe, bunker } = state;
    appEl.innerHTML = `
      <div class="catastrophe-screen">
        <div class="catastrophe-alert"><i class="fa-solid fa-triangle-exclamation"></i> Внимание — глобальная катастрофа <i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="panel catastrophe-card">
          <i class="fa-solid ${catastrophe.icon} catastrophe-icon"></i>
          <h2 class="catastrophe-title">${catastrophe.title}</h2>
          <p class="catastrophe-desc">${catastrophe.description}</p>

          <div class="bunker-params">
            <div class="bunker-param">
              <div class="label"><i class="fa-solid fa-ruler-combined"></i>Площадь</div>
              <div class="value">${bunker.size}</div>
            </div>
            <div class="bunker-param">
              <div class="label"><i class="fa-solid fa-hourglass-half"></i>Срок пребывания</div>
              <div class="value">${bunker.duration}</div>
            </div>
            <div class="bunker-param">
              <div class="label"><i class="fa-solid fa-layer-group"></i>Этажность</div>
              <div class="value">${bunker.floors}</div>
            </div>
            <div class="bunker-param">
              <div class="label"><i class="fa-solid fa-door-open"></i>Доп. помещение</div>
              <div class="value">${bunker.extraRoom}</div>
            </div>
            <div class="bunker-param">
              <div class="label"><i class="fa-solid fa-drumstick-bite"></i>Запасы провизии</div>
              <div class="value">${bunker.foodSupply}</div>
            </div>
          </div>

          <div class="catastrophe-actions">
            <button class="btn btn-secondary" id="reroll-catastrophe"><i class="fa-solid fa-rotate"></i> Другая катастрофа</button>
            <button class="btn btn-secondary" id="reroll-bunker"><i class="fa-solid fa-rotate"></i> Другой бункер</button>
            <button class="btn btn-primary" id="enter-bunker"><i class="fa-solid fa-people-group"></i> Спуститься в бункер</button>
          </div>
        </div>
        <div class="app-footer">© БУНКЕР — электронный помощник для настольной игры</div>
      </div>
    `;

    document.getElementById('reroll-catastrophe').addEventListener('click', async () => {
      const res = await axios.get('/api/game/catastrophe');
      state.catastrophe = res.data.catastrophe;
      saveState();
      renderCatastropheScreen();
    });

    document.getElementById('reroll-bunker').addEventListener('click', async () => {
      const res = await axios.get('/api/game/bunker');
      state.bunker = res.data.bunker;
      saveState();
      renderCatastropheScreen();
    });

    document.getElementById('enter-bunker').addEventListener('click', () => {
      state.screen = 'game';
      saveState();
      renderCurrentScreen();
    });
  }

  // -------------------------------------------------------------------
  // ЭКРАН ИГРЫ
  // -------------------------------------------------------------------

  function renderGameScreen() {
    const { catastrophe, bunker, players, round } = state;
    const aliveCount = players.filter((p) => !p.excluded).length;
    const totalCount = players.length;
    const pct = Math.min(100, Math.round((aliveCount / totalCount) * 100));

    appEl.innerHTML = `
      <div class="screen" style="padding-top:0;">
        <div class="game-topbar">
          <div class="brand"><i class="fa-solid fa-radiation"></i> БУНКЕР</div>
          <div class="round-badge"><i class="fa-solid fa-hourglass-half"></i> Раунд ${round}</div>
          <div class="topbar-actions">
            <button class="btn btn-secondary" id="next-round-btn"><i class="fa-solid fa-forward"></i> Следующий раунд</button>
            <button class="btn btn-ghost" id="new-game-btn"><i class="fa-solid fa-rotate-left"></i> Новая игра</button>
          </div>
        </div>

        <div class="survivors-bar-wrap">
          <div class="survivors-bar-label">
            <span><i class="fa-solid fa-people-roof"></i> Выживших в бункере: ${aliveCount} / ${totalCount}</span>
            <span>${pct}%</span>
          </div>
          <div class="survivors-bar">
            <div class="survivors-bar-fill ${pct < 40 ? 'over' : ''}" style="width:${pct}%"></div>
          </div>
        </div>

        <div class="info-strip">
          <div class="panel mini-panel">
            <div class="mini-title"><i class="fa-solid ${catastrophe.icon}"></i>Катастрофа</div>
            <div class="mini-value">${catastrophe.title}</div>
          </div>
          <div class="panel mini-panel">
            <div class="mini-title"><i class="fa-solid fa-ruler-combined"></i>Бункер</div>
            <div class="mini-value">${bunker.size}</div>
          </div>
          <div class="panel mini-panel">
            <div class="mini-title"><i class="fa-solid fa-hourglass-half"></i>Срок</div>
            <div class="mini-value">${bunker.duration}</div>
          </div>
          <div class="panel mini-panel">
            <div class="mini-title"><i class="fa-solid fa-drumstick-bite"></i>Провизия</div>
            <div class="mini-value">${bunker.foodSupply}</div>
          </div>
        </div>

        <div class="players-grid" id="players-grid">
          ${players.map(renderPlayerCard).join('')}
        </div>

        <div class="app-footer">© БУНКЕР — электронный помощник для настольной игры</div>
      </div>
      <div class="toast-container" id="toast-container"></div>
    `;

    document.getElementById('next-round-btn').addEventListener('click', handleNextRound);
    document.getElementById('new-game-btn').addEventListener('click', handleNewGameClick);

    // Player name inputs
    players.forEach((p) => {
      const nameInput = document.getElementById(`name-${p.id}`);
      if (nameInput) {
        nameInput.addEventListener('change', () => {
          p.name = nameInput.value || `Игрок ${p.id}`;
          saveState();
        });
      }

      const excludeBtn = document.getElementById(`exclude-${p.id}`);
      if (excludeBtn) {
        excludeBtn.addEventListener('click', () => toggleExclude(p.id));
      }

      ATTR_FIELDS.forEach((f) => {
        const head = document.getElementById(`attr-head-${p.id}-${f.key}`);
        if (head) {
          head.addEventListener('click', (e) => {
            if (e.target.closest('.attr-reroll')) return;
            toggleReveal(p.id, f.key);
          });
        }
        const rerollBtn = document.getElementById(`attr-reroll-${p.id}-${f.key}`);
        if (rerollBtn) {
          rerollBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleReroll(p.id, f.key);
          });
        }
      });
    });
  }

  function renderPlayerCard(p) {
    const initial = (p.name || '?').trim().charAt(0).toUpperCase() || '?';
    return `
      <div class="player-card ${p.excluded ? 'excluded' : ''}" id="card-${p.id}">
        <div class="player-card-head">
          <div class="player-avatar">${initial}</div>
          <input class="player-name-input" id="name-${p.id}" value="${escapeHtml(p.name)}" maxlength="24" />
          <div class="player-card-actions">
            <button class="icon-toggle ${p.excluded ? 'active' : ''}" id="exclude-${p.id}" title="Исключить/вернуть">
              <i class="fa-solid ${p.excluded ? 'fa-user-check' : 'fa-user-slash'}"></i>
            </button>
          </div>
        </div>

        <div class="player-profession-strip">
          <i class="fa-solid fa-briefcase"></i>
          <div>
            <span class="prof-label">Профессия</span>
            <span class="prof-text">${p.profession}</span>
          </div>
        </div>

        <div class="attributes-list">
          ${ATTR_FIELDS.map((f) => renderAttrRow(p, f)).join('')}
        </div>
      </div>
    `;
  }

  function renderAttrRow(p, f) {
    const revealed = !!p.revealed[f.key];
    return `
      <div class="attr-row ${revealed ? 'revealed' : 'hidden-state'}" id="attr-row-${p.id}-${f.key}">
        <div class="attr-row-head" id="attr-head-${p.id}-${f.key}">
          <div class="attr-label"><i class="fa-solid ${f.icon}"></i>${f.label}</div>
          ${
            revealed
              ? `<i class="fa-solid fa-lock-open" style="color:var(--rust-light);font-size:11px;"></i>`
              : `<div class="attr-lock">
                   <button class="attr-reroll" id="attr-reroll-${p.id}-${f.key}" title="Перебросить (пока скрыто)">
                     <i class="fa-solid fa-dice"></i>
                   </button>
                   <i class="fa-solid fa-lock"></i>
                 </div>`
          }
        </div>
        <div class="attr-value">${p[f.key]}</div>
      </div>
    `;
  }

  function toggleReveal(playerId, field) {
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    p.revealed[field] = !p.revealed[field];
    saveState();

    const row = document.getElementById(`attr-row-${playerId}-${field}`);
    if (row) {
      row.classList.toggle('revealed', !!p.revealed[field]);
      row.classList.toggle('hidden-state', !p.revealed[field]);
      row.classList.add('just-revealed');
      setTimeout(() => row.classList.remove('just-revealed'), 400);
    }
    // Re-render the head part to swap lock/reroll icon
    const head = document.getElementById(`attr-head-${playerId}-${field}`);
    if (head) {
      const f = ATTR_FIELDS.find((x) => x.key === field);
      const revealed = !!p.revealed[field];
      head.innerHTML = `
        <div class="attr-label"><i class="fa-solid ${f.icon}"></i>${f.label}</div>
        ${
          revealed
            ? `<i class="fa-solid fa-lock-open" style="color:var(--rust-light);font-size:11px;"></i>`
            : `<div class="attr-lock">
                 <button class="attr-reroll" id="attr-reroll-${playerId}-${field}" title="Перебросить (пока скрыто)">
                   <i class="fa-solid fa-dice"></i>
                 </button>
                 <i class="fa-solid fa-lock"></i>
               </div>`
        }
      `;
      const rerollBtn = document.getElementById(`attr-reroll-${playerId}-${field}`);
      if (rerollBtn) {
        rerollBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleReroll(playerId, field);
        });
      }
    }
  }

  async function handleReroll(playerId, field) {
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.revealed[field]) return;

    try {
      const res = await axios.post('/api/game/reroll', { field });
      p[field] = res.data.value;
      saveState();
      const row = document.getElementById(`attr-row-${playerId}-${field}`);
      if (row) {
        const valueEl = row.querySelector('.attr-value');
        if (valueEl) valueEl.textContent = p[field];
        row.classList.add('just-revealed');
        setTimeout(() => row.classList.remove('just-revealed'), 400);
      }
      showToast('Переброшено', `Новая характеристика «${labelForField(field)}» сгенерирована.`, 'fa-dice');
    } catch (e) {
      showToast('Ошибка', 'Не удалось перебросить характеристику.', 'fa-triangle-exclamation');
    }
  }

  function labelForField(field) {
    const f = ATTR_FIELDS.find((x) => x.key === field);
    return f ? f.label : field;
  }

  function toggleExclude(playerId) {
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    p.excluded = !p.excluded;
    saveState();
    renderGameScreen();
  }

  async function handleNextRound() {
    state.round += 1;
    saveState();

    document.querySelector('.round-badge').innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Раунд ${state.round}`;

    try {
      const res = await axios.get('/api/game/event');
      showEventModal(res.data.event);
    } catch (e) {
      showToast('Раунд начат', `Раунд ${state.round} начался.`, 'fa-forward');
    }
  }

  function showEventModal(eventText) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box">
        <i class="fa-solid fa-triangle-exclamation modal-icon"></i>
        <h3>Событие раунда ${state.round}</h3>
        <p>${eventText}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="modal-close-btn"><i class="fa-solid fa-check"></i> Понятно</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      overlay.remove();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function handleNewGameClick() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box">
        <i class="fa-solid fa-skull modal-icon" style="color:var(--danger);"></i>
        <h3>Начать новую игру?</h3>
        <p>Текущий прогресс (раунды, раскрытые характеристики, исключённые игроки) будет полностью удалён.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel-btn">Отмена</button>
          <button class="btn btn-danger" id="modal-confirm-btn"><i class="fa-solid fa-rotate-left"></i> Да, начать заново</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('modal-cancel-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('modal-confirm-btn').addEventListener('click', () => {
      overlay.remove();
      resetGame();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // -------------------------------------------------------------------
  // TOASTS
  // -------------------------------------------------------------------

  function showToast(title, message, icon) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="toast-title"><i class="fa-solid ${icon || 'fa-info-circle'}"></i>${title}</div>
      <div>${message}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 320);
    }, 3600);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // -------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', init);
})();
