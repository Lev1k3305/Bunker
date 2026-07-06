// =====================================================================
// БУНКЕР — клиентское приложение
// =====================================================================

(function () {
  'use strict';

  const STORAGE_KEY = 'bunker_game_state_v2';
  const VOTING_ROUND_THRESHOLD = 3;

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
    if (!state) return;
    if (state.screen === 'setup') renderSetupScreen();
    else if (state.screen === 'lobby') renderLobbyScreen();
    else if (state.screen === 'catastrophe') renderCatastropheScreen();
    else if (state.screen === 'game') renderGameScreen();
    else renderSetupScreen();
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
                1. В лобби каждый игрок вписывает своё имя, и ведущий подробно объясняет правила.<br/>
                2. Генерируется случайная катастрофа и параметры бункера.<br/>
                3. Каждый получает секретное досье: профессия, возраст, здоровье, фобия, хобби, черты характера, инвентарь.<br/>
                4. По раундам игроки раскрывают характеристики, обсуждают и озвучивают ситуации.<br/>
                5. Начиная с 3-го раунда открывается голосование — сообщество решает, кого исключить из бункера.
              </div>
            </div>

            <div class="setup-actions">
              <button class="btn btn-primary" id="start-btn">
                <i class="fa-solid fa-people-roof"></i> Далее: лобби
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

    document.getElementById('start-btn').addEventListener('click', goToLobby);
  }

  function goToLobby() {
    const count = state.playerCount || 8;
    const existingNames = (state.names && state.names.length === count) ? state.names : null;
    const names = existingNames || Array.from({ length: count }, (_, i) => '');
    state = { screen: 'lobby', playerCount: count, names };
    saveState();
    renderCurrentScreen();
  }

  // -------------------------------------------------------------------
  // ЭКРАН ЛОББИ
  // -------------------------------------------------------------------

  function renderLobbyScreen() {
    const names = state.names || [];
    appEl.innerHTML = `
      <div class="screen">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-people-roof"></i>
            <h1>ЛОББИ</h1>
          </div>
          <div class="subtitle">знакомство перед спуском<span class="divider"></span>${names.length} мест в бункере</div>

          <div class="panel rules-panel">
            <div class="rules-title"><i class="fa-solid fa-book-open"></i> Правила игры «Бункер»</div>
            <div class="rules-grid">
              <div class="rule-item">
                <i class="fa-solid fa-1"></i>
                <div>
                  <div class="rule-h">Катастрофа и бункер</div>
                  <div class="rule-t">Ведущий объявляет катастрофу, уничтожившую мир на поверхности, и параметры бункера: площадь, срок пребывания, этажность, запасы. Мест на всех не хватит.</div>
                </div>
              </div>
              <div class="rule-item">
                <i class="fa-solid fa-2"></i>
                <div>
                  <div class="rule-h">Секретное досье</div>
                  <div class="rule-t">Каждый получает карточку: профессия (видна сразу), возраст и пол, здоровье, фобия, хобби, черты характера, инвентарь и доп. информация — всё это до поры скрыто от остальных.</div>
                </div>
              </div>
              <div class="rule-item">
                <i class="fa-solid fa-3"></i>
                <div>
                  <div class="rule-h">Раунды и раскрытие</div>
                  <div class="rule-t">В каждом раунде игроки по очереди раскрывают по одной характеристике (или больше) и подробно рассказывают о себе, чтобы убедить остальных оставить их в бункере.</div>
                </div>
              </div>
              <div class="rule-item">
                <i class="fa-solid fa-4"></i>
                <div>
                  <div class="rule-h">Ситуации</div>
                  <div class="rule-t">Ведущий периодически озвучивает случайные ситуации и происшествия в бункере — их нужно обсудить и принять решение сообща.</div>
                </div>
              </div>
              <div class="rule-item">
                <i class="fa-solid fa-5"></i>
                <div>
                  <div class="rule-h">Голосование</div>
                  <div class="rule-t">Начиная с 3-го раунда открывается голосование: все решают, кто покинет бункер. Исключённый выбывает из игры.</div>
                </div>
              </div>
              <div class="rule-item">
                <i class="fa-solid fa-6"></i>
                <div>
                  <div class="rule-h">Победа</div>
                  <div class="rule-t">Игра продолжается до тех пор, пока не останется ровно столько выживших, сколько мест в бункере — именно они и побеждают.</div>
                </div>
              </div>
            </div>
          </div>

          <div class="panel names-panel">
            <div class="rules-title"><i class="fa-solid fa-signature"></i> Представление игроков</div>
            <div class="setup-hint" style="margin-bottom:18px;">Впишите имена всех участников (или оставьте поле пустым — тогда игрок будет назван «Игрок N»). Каждый сможет в любой момент приватно посмотреть своё полное досье кнопкой с иконкой глаза на карточке.</div>
            <div class="names-grid" id="names-grid">
              ${names.map((n, i) => `
                <div class="name-field">
                  <div class="name-num">${i + 1}</div>
                  <input type="text" class="name-input" id="lobby-name-${i}" placeholder="Игрок ${i + 1}" maxlength="24" value="${escapeHtml(n || '')}" />
                </div>
              `).join('')}
            </div>
          </div>

          <div class="catastrophe-actions">
            <button class="btn btn-secondary" id="lobby-back-btn"><i class="fa-solid fa-arrow-left"></i> Назад</button>
            <button class="btn btn-primary" id="lobby-start-btn"><i class="fa-solid fa-door-closed"></i> Начать катастрофу</button>
          </div>

          <div class="app-footer">© БУНКЕР — электронный помощник для настольной игры</div>
        </div>
      </div>
    `;

    names.forEach((_, i) => {
      const input = document.getElementById(`lobby-name-${i}`);
      input.addEventListener('input', () => {
        state.names[i] = input.value;
        saveState();
      });
    });

    document.getElementById('lobby-back-btn').addEventListener('click', () => {
      state.screen = 'setup';
      saveState();
      renderCurrentScreen();
    });

    document.getElementById('lobby-start-btn').addEventListener('click', startNewGame);
  }

  async function startNewGame() {
    const btn = document.getElementById('lobby-start-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Генерация катастрофы...';

    try {
      const res = await axios.post('/api/game/new', {
        playerCount: state.playerCount,
        names: state.names,
      });
      const { catastrophe, bunker, players } = res.data;

      const preparedPlayers = players.map((p) => ({
        ...p,
        revealed: { profession: true },
        excluded: false,
      }));

      state = {
        screen: 'catastrophe',
        playerCount: state.playerCount,
        names: state.names,
        catastrophe,
        bunker,
        players: preparedPlayers,
        round: 1,
        situationsLog: [],
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
            <button class="btn btn-secondary" id="lobby-return-btn"><i class="fa-solid fa-arrow-left"></i> В лобби</button>
            <button class="btn btn-secondary" id="reroll-catastrophe"><i class="fa-solid fa-rotate"></i> Другая катастрофа</button>
            <button class="btn btn-secondary" id="reroll-bunker"><i class="fa-solid fa-rotate"></i> Другой бункер</button>
            <button class="btn btn-primary" id="enter-bunker"><i class="fa-solid fa-people-group"></i> Спуститься в бункер</button>
          </div>
        </div>
        <div class="app-footer">© БУНКЕР — электронный помощник для настольной игры</div>
      </div>
    `;

    document.getElementById('lobby-return-btn').addEventListener('click', () => {
      state.screen = 'lobby';
      saveState();
      renderCurrentScreen();
    });

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
    const votingUnlocked = round >= VOTING_ROUND_THRESHOLD;

    appEl.innerHTML = `
      <div class="screen" style="padding-top:0;">
        <div class="game-topbar">
          <div class="brand"><i class="fa-solid fa-radiation"></i> БУНКЕР</div>
          <div class="round-badge"><i class="fa-solid fa-hourglass-half"></i> Раунд ${round}</div>
          <div class="topbar-actions">
            <button class="btn btn-secondary" id="situation-btn"><i class="fa-solid fa-triangle-exclamation"></i> Ситуация</button>
            <button class="btn ${votingUnlocked ? 'btn-danger' : 'btn-secondary'}" id="voting-btn" ${votingUnlocked ? '' : 'title="Голосование откроется с 3-го раунда"'}>
              <i class="fa-solid fa-square-poll-vertical"></i> Голосование ${votingUnlocked ? '' : `<i class="fa-solid fa-lock" style="font-size:11px;margin-left:4px;"></i>`}
            </button>
            <button class="btn btn-secondary" id="next-round-btn"><i class="fa-solid fa-forward"></i> Следующий раунд</button>
            <button class="btn btn-ghost" id="new-game-btn"><i class="fa-solid fa-rotate-left"></i> Новая игра</button>
          </div>
        </div>

        <div class="survivors-bar-wrap">
          <div class="survivors-bar-label">
            <span><i class="fa-solid fa-people-roof"></i> Выживших в бункере: ${aliveCount} / ${totalCount}</span>
            <span>${votingUnlocked ? '<i class="fa-solid fa-unlock" style="color:var(--toxic);"></i> Голосование доступно' : `Голосование откроется в раунде ${VOTING_ROUND_THRESHOLD}`}</span>
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
    document.getElementById('situation-btn').addEventListener('click', handleShowSituation);
    document.getElementById('voting-btn').addEventListener('click', () => handleOpenVoting(votingUnlocked));

    // Player name inputs & actions
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

      const peekBtn = document.getElementById(`peek-${p.id}`);
      if (peekBtn) {
        peekBtn.addEventListener('click', () => openPeekModal(p.id));
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
            <button class="icon-toggle" id="peek-${p.id}" title="Приватный просмотр — полное досье для тебя">
              <i class="fa-solid fa-eye"></i>
            </button>
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

  // -------------------------------------------------------------------
  // ПРИВАТНЫЙ ПРОСМОТР СВОЕЙ КАРТОЧКИ («раскрыта для тебя»)
  // -------------------------------------------------------------------

  function openPeekModal(playerId) {
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box peek-box">
        <div class="peek-badge"><i class="fa-solid fa-user-lock"></i> Только для тебя</div>
        <i class="fa-solid fa-id-badge modal-icon" style="color:var(--rust-light);"></i>
        <h3>${escapeHtml(p.name)}</h3>
        <div class="peek-list">
          <div class="peek-row">
            <div class="peek-label"><i class="fa-solid fa-briefcase"></i>Профессия</div>
            <div class="peek-value">${p.profession}</div>
          </div>
          ${ATTR_FIELDS.map((f) => `
            <div class="peek-row">
              <div class="peek-label"><i class="fa-solid ${f.icon}"></i>${f.label}</div>
              <div class="peek-value">${p[f.key]}</div>
            </div>
          `).join('')}
        </div>
        <p class="peek-hint">Эта информация видна только тебе. Остальным игрокам характеристики по-прежнему открываются через карточку по одной за раунд.</p>
        <div class="modal-actions">
          <button class="btn btn-primary" id="peek-close-btn"><i class="fa-solid fa-eye-slash"></i> Спрятать</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('peek-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // -------------------------------------------------------------------
  // РАУНДЫ И СОБЫТИЯ
  // -------------------------------------------------------------------

  async function handleNextRound() {
    state.round += 1;
    saveState();

    const badge = document.querySelector('.round-badge');
    if (badge) badge.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> Раунд ${state.round}`;

    if (state.round === VOTING_ROUND_THRESHOLD) {
      showToast('Голосование открыто', 'С этого раунда доступно голосование за исключение игрока.', 'fa-square-poll-vertical');
    }

    // Обновляем кнопку голосования и подсказку без полной перерисовки
    renderGameScreen();

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

  // -------------------------------------------------------------------
  // СИТУАЦИИ (для озвучивания вслух)
  // -------------------------------------------------------------------

  async function handleShowSituation() {
    const btn = document.getElementById('situation-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
    }
    try {
      const res = await axios.get('/api/game/situation');
      const s = res.data.situation;
      if (!state.situationsLog) state.situationsLog = [];
      state.situationsLog.push({ round: state.round, title: s.title });
      saveState();
      showSituationModal(s);
    } catch (e) {
      showToast('Ошибка', 'Не удалось загрузить ситуацию.', 'fa-triangle-exclamation');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Ситуация';
      }
    }
  }

  function showSituationModal(s) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box situation-box">
        <div class="situation-category"><i class="fa-solid ${s.icon}"></i> ${escapeHtml(s.category)}</div>
        <h3>${escapeHtml(s.title)}</h3>
        <p class="situation-text">${escapeHtml(s.text)}</p>
        <div class="setup-hint" style="margin-bottom:18px;">Озвучьте эту ситуацию вслух всем участникам и обсудите, как бункер будет действовать.</div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="situation-again-btn"><i class="fa-solid fa-rotate"></i> Другая ситуация</button>
          <button class="btn btn-primary" id="situation-close-btn"><i class="fa-solid fa-check"></i> Обсудили</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('situation-close-btn').addEventListener('click', () => overlay.remove());
    document.getElementById('situation-again-btn').addEventListener('click', async () => {
      const res = await axios.get('/api/game/situation');
      overlay.remove();
      showSituationModal(res.data.situation);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // -------------------------------------------------------------------
  // ГОЛОСОВАНИЕ (доступно с 3-го раунда)
  // -------------------------------------------------------------------

  function handleOpenVoting(unlocked) {
    if (!unlocked) {
      showToast('Голосование закрыто', `Голосование откроется начиная с ${VOTING_ROUND_THRESHOLD}-го раунда. Сейчас раунд ${state.round}.`, 'fa-lock');
      return;
    }
    openVotingModal();
  }

  function openVotingModal() {
    const alive = state.players.filter((p) => !p.excluded);
    const votes = {};
    alive.forEach((p) => { votes[p.id] = 0; });

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box voting-box">
        <i class="fa-solid fa-square-poll-vertical modal-icon" style="color:var(--danger-light);"></i>
        <h3>Голосование — раунд ${state.round}</h3>
        <p>Отмечайте голоса за каждого выжившего. Кандидат с наибольшим числом голосов будет исключён из бункера.</p>
        <div class="voting-list" id="voting-list">
          ${alive.map((p) => `
            <div class="voting-row" id="voting-row-${p.id}">
              <div class="voting-name"><i class="fa-solid fa-user"></i> ${escapeHtml(p.name)} <span class="voting-prof">— ${p.profession}</span></div>
              <div class="voting-controls">
                <button class="vote-btn vote-minus" data-id="${p.id}"><i class="fa-solid fa-minus"></i></button>
                <span class="vote-count" id="vote-count-${p.id}">0</span>
                <button class="vote-btn vote-plus" data-id="${p.id}"><i class="fa-solid fa-plus"></i></button>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="voting-cancel-btn">Отмена</button>
          <button class="btn btn-danger" id="voting-confirm-btn"><i class="fa-solid fa-user-slash"></i> Исключить лидера голосования</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('.vote-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        votes[id] += 1;
        document.getElementById(`vote-count-${id}`).textContent = votes[id];
      });
    });
    overlay.querySelectorAll('.vote-minus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        votes[id] = Math.max(0, votes[id] - 1);
        document.getElementById(`vote-count-${id}`).textContent = votes[id];
      });
    });

    document.getElementById('voting-cancel-btn').addEventListener('click', () => overlay.remove());

    document.getElementById('voting-confirm-btn').addEventListener('click', () => {
      const entries = Object.entries(votes);
      const maxVotes = Math.max(...entries.map(([, v]) => v));
      if (maxVotes <= 0) {
        showToast('Нет голосов', 'Отметьте хотя бы один голос перед завершением голосования.', 'fa-triangle-exclamation');
        return;
      }
      const leaders = entries.filter(([, v]) => v === maxVotes).map(([id]) => Number(id));

      overlay.remove();

      if (leaders.length > 1) {
        showTieModal(leaders, votes);
      } else {
        excludePlayer(leaders[0]);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function showTieModal(leaderIds, votes) {
    const candidates = state.players.filter((p) => leaderIds.includes(p.id));
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="panel modal-box">
        <i class="fa-solid fa-scale-balanced modal-icon" style="color:var(--warning);"></i>
        <h3>Ничья в голосовании!</h3>
        <p>Несколько игроков набрали одинаковое максимальное число голосов (${votes[leaderIds[0]]}). Выберите, кто покидает бункер, по итогам дополнительного обсуждения или переголосования.</p>
        <div class="voting-list">
          ${candidates.map((p) => `
            <div class="voting-row">
              <div class="voting-name"><i class="fa-solid fa-user"></i> ${escapeHtml(p.name)} <span class="voting-prof">— ${p.profession}</span></div>
              <button class="btn btn-danger" data-tie-id="${p.id}" style="padding:8px 16px;font-size:12px;">Исключить</button>
            </div>
          `).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="tie-cancel-btn">Никого не исключать</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-tie-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.tieId);
        overlay.remove();
        excludePlayer(id);
      });
    });
    document.getElementById('tie-cancel-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function excludePlayer(playerId) {
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return;
    p.excluded = true;
    saveState();
    renderGameScreen();
    showToast('Голосование завершено', `${p.name} исключён(а) из бункера по итогам голосования.`, 'fa-user-slash');
  }

  // -------------------------------------------------------------------
  // НОВАЯ ИГРА
  // -------------------------------------------------------------------

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
