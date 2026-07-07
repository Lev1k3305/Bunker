// =====================================================================
// БУНКЕР — клиентское приложение (Multiplayer)
// =====================================================================

(function () {
  'use strict';

  const STORAGE_KEY = 'bunker_user_settings';
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

  let state = {
    screen: 'main',
    room: null,
    me: null,
    settings: {
      nickname: localStorage.getItem('bunker_nickname') || '',
      sound: true,
      theme: 'dark'
    }
  };

  let ws = null;
  const appEl = document.getElementById('app');

  // -------------------------------------------------------------------
  // Инициализация
  // -------------------------------------------------------------------

  function init() {
    renderCurrentScreen();
    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      if (loader) loader.classList.add('hidden');
    }, 500);
  }

  function renderCurrentScreen() {
    if (state.screen === 'main') renderMainScreen();
    else if (state.screen === 'lobby') renderLobbyScreen();
    else if (state.screen === 'catastrophe') renderCatastropheScreen();
    else if (state.screen === 'game') renderGameScreen();
  }

  // -------------------------------------------------------------------
  // ЭКРАН ГЛАВНОГО МЕНЮ
  // -------------------------------------------------------------------

  function renderMainScreen() {
    appEl.innerHTML = `
      <div class="screen centered">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-radiation"></i>
            <h1>БУНКЕР</h1>
          </div>
          <div class="subtitle">онлайн-игра на выживание</div>

          <div class="panel main-panel">
            <div class="setup-field">
              <label>Ваш никнейм</label>
              <input type="text" id="nickname" value="${escapeHtml(state.settings.nickname)}" placeholder="Введите имя..." maxlength="20" />
            </div>

            <div class="main-actions">
              <button class="btn btn-primary" id="create-room-btn">
                <i class="fa-solid fa-plus"></i> Создать игру
              </button>
              <div class="join-box">
                <input type="text" id="room-code" placeholder="КОД" maxlength="5" />
                <button class="btn btn-secondary" id="join-room-btn">
                  <i class="fa-solid fa-right-to-bracket"></i> Войти
                </button>
              </div>
            </div>

            <div class="extra-actions">
                <button class="btn btn-ghost" id="rules-btn"><i class="fa-solid fa-book"></i> Правила</button>
                <button class="btn btn-ghost" id="stats-btn"><i class="fa-solid fa-chart-simple"></i> Статистика</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('nickname').addEventListener('input', (e) => {
        state.settings.nickname = e.target.value;
        localStorage.setItem('bunker_nickname', e.target.value);
    });

    document.getElementById('create-room-btn').addEventListener('click', createRoom);
    document.getElementById('join-room-btn').addEventListener('click', () => {
        const code = document.getElementById('room-code').value.toUpperCase();
        if (code) joinRoom(code);
    });
    document.getElementById('rules-btn').addEventListener('click', showRulesModal);
    document.getElementById('stats-btn').addEventListener('click', showStatsModal);
  }

  async function createRoom() {
    try {
        const res = await axios.post('/api/room/create', { playerCount: 8 });
        joinRoom(res.data.code);
    } catch (e) {
        alert('Ошибка при создании комнаты');
    }
  }

  function joinRoom(code) {
    if (!state.settings.nickname) {
        alert('Введите никнейм');
        return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/api/room/${code}/ws`);

    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: 'join',
            payload: {
                name: state.settings.nickname,
                token: localStorage.getItem(`bunker_token_${code}`)
            }
        }));
    };

    ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'welcome') {
            localStorage.setItem(`bunker_token_${code}`, data.payload.token);
            state.me = { id: data.payload.playerId, token: data.payload.token };
            if (state.screen === 'main') {
                state.screen = 'lobby';
                renderCurrentScreen();
            }
        } else if (data.type === 'state') {
            const oldStatus = state.room?.status;
            state.room = data.payload;

            if (state.room.status === 'lobby') state.screen = 'lobby';
            else if (state.room.status === 'catastrophe') state.screen = 'catastrophe';
            else state.screen = 'game';

            if (oldStatus !== state.room.status) {
                renderCurrentScreen();
            } else {
                updateUI();
            }
        } else if (data.type === 'error') {
            alert(data.payload);
            state.screen = 'main';
            renderMainScreen();
        }
    };

    ws.onclose = () => {
        if (state.screen !== 'main') {
            showToast('Связь потеряна', 'Попытка переподключения...', 'fa-plug-circle-xmark');
            setTimeout(() => joinRoom(code), 3000);
        }
    };
  }

  // -------------------------------------------------------------------
  // ЭКРАН ЛОББИ
  // -------------------------------------------------------------------

  function renderLobbyScreen() {
    const isHost = state.room.players.find(p => p.id === state.me.id)?.isHost;
    appEl.innerHTML = `
      <div class="screen">
        <div class="container">
          <div class="top-title">
            <i class="fa-solid fa-people-roof"></i>
            <h1>ЛОББИ: ${state.room.code}</h1>
          </div>
          <div class="subtitle">Ожидание игроков...</div>

          <div class="panel lobby-panel">
            <div class="player-list" id="player-list">
                ${state.room.players.map(p => `
                    <div class="lobby-player ${p.claimed ? 'claimed' : 'empty'}">
                        <div class="p-info">
                            <span class="p-slot">${p.slot}</span>
                            <span class="p-name">${p.claimed ? escapeHtml(p.name) : 'Свободно'}</span>
                            ${p.isHost ? '<i class="fa-solid fa-crown host-icon"></i>' : ''}
                        </div>
                        <div class="p-status">
                            ${p.online ? '<span class="online">В сети</span>' : (p.claimed ? '<span class="offline">Офлайн</span>' : '')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="lobby-actions">
              ${isHost ? '<button class="btn btn-primary" id="start-game-btn">Начать игру</button>' : '<p>Ждем, пока хост начнет игру...</p>'}
              <button class="btn btn-ghost" id="exit-btn">Выйти</button>
            </div>
          </div>
        </div>
      </div>
    `;

    if (isHost) {
        document.getElementById('start-game-btn').addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'start' }));
        });
    }
    document.getElementById('exit-btn').addEventListener('click', () => {
        ws.close();
        state.screen = 'main';
        state.room = null;
        renderMainScreen();
    });
  }

  // -------------------------------------------------------------------
  // ЭКРАН КАТАСТРОФЫ
  // -------------------------------------------------------------------

  function renderCatastropheScreen() {
    const { catastrophe, bunker } = state.room;
    const isHost = state.room.me?.isHost;
    appEl.innerHTML = `
      <div class="catastrophe-screen">
        <div class="catastrophe-alert"><i class="fa-solid fa-triangle-exclamation"></i> ВНИМАНИЕ — КАТАСТРОФА <i class="fa-solid fa-triangle-exclamation"></i></div>
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
              <div class="label"><i class="fa-solid fa-hourglass-half"></i>Срок</div>
              <div class="value">${bunker.duration}</div>
            </div>
            <div class="bunker-param">
              <div class="label"><i class="fa-solid fa-layer-group"></i>Этажи</div>
              <div class="value">${bunker.floors}</div>
            </div>
            <div class="bunker-param">
              <div class="label"><i class="fa-solid fa-door-open"></i>Доп. комната</div>
              <div class="value">${bunker.extraRoom}</div>
            </div>
            <div class="bunker-param">
              <div class="label"><i class="fa-solid fa-drumstick-bite"></i>Провизия</div>
              <div class="value">${bunker.foodSupply}</div>
            </div>
          </div>

          <div class="catastrophe-actions">
            ${isHost ? '<button class="btn btn-primary" id="enter-bunker-btn">Спуститься в бункер</button>' : '<p>Ждем приказа ведущего спускаться...</p>'}
          </div>
        </div>
      </div>
    `;

    if (isHost) {
        document.getElementById('enter-bunker-btn').addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'next_round', payload: { seconds: 180 } }));
        });
    }
  }

  // -------------------------------------------------------------------
  // ЭКРАН ИГРЫ
  // -------------------------------------------------------------------

  function renderGameScreen() {
    const { players, round, catastrophe, bunker, timer, status } = state.room;
    const isHost = state.room.me?.isHost;
    const mePlayer = players.find(p => p.id === state.me.id);

    appEl.innerHTML = `
      <div class="screen game-screen ${status === 'ended' ? 'game-ended' : ''}">
        <div class="game-topbar">
          <div class="brand"><i class="fa-solid fa-radiation"></i> ${state.room.code}</div>
          <div class="round-badge">РАУНД ${round}</div>
          <div id="timer-display" class="timer-display"></div>
          <div class="topbar-actions">
            ${isHost ? `
                <button class="btn btn-secondary btn-sm" id="next-round-btn">След. раунд</button>
                <button class="btn btn-secondary btn-sm" id="situation-btn">Ситуация</button>
                <button class="btn btn-danger btn-sm" id="vote-start-btn">Голосование</button>
            ` : ''}
          </div>
        </div>

        <div class="game-layout">
            <div class="players-grid" id="players-grid">
                ${players.map(renderPlayerCard).join('')}
            </div>

            <div class="game-sidebar">
                <div class="panel info-panel">
                    <h3><i class="fa-solid ${catastrophe.icon}"></i> ${catastrophe.title}</h3>
                    <p style="font-size: 0.8em">${catastrophe.description.substring(0, 100)}...</p>
                    <div class="mini-bunker">
                        <span><i class="fa-solid fa-hourglass-half"></i> ${bunker.duration}</span>
                        <span><i class="fa-solid fa-drumstick-bite"></i> ${bunker.foodSupply}</span>
                    </div>
                </div>

                ${status === 'ended' ? `
                <div class="panel results-panel">
                    <h3>ИТОГИ ИГРЫ</h3>
                    <div class="survivors-list">
                        <h4>ВЫЖИЛИ:</h4>
                        ${players.filter(p => !p.excluded && p.claimed).map(p => `<div><i class="fa-solid fa-check"></i> ${escapeHtml(p.name)}</div>`).join('')}
                    </div>
                    <button class="btn btn-primary" id="return-main-btn">В главное меню</button>
                </div>
                ` : ''}

                <div class="panel chat-panel">
                    <div class="chat-messages" id="chat-messages">
                        ${state.room.chat.map(renderChatMessage).join('')}
                    </div>
                    <div class="chat-input">
                        <input type="text" id="chat-msg-input" placeholder="Сообщение..." />
                        <button id="chat-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
            </div>
        </div>
      </div>
      <div class="toast-container" id="toast-container"></div>
    `;

    startTimer(timer);

    if (status === 'ended') {
        document.getElementById('return-main-btn').addEventListener('click', () => {
            ws.close();
            state.screen = 'main';
            state.room = null;
            renderMainScreen();
        });
    }

    if (isHost && status !== 'ended') {
        document.getElementById('next-round-btn').addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'next_round', payload: { seconds: 180 } }));
        });
        document.getElementById('situation-btn').addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'situation' }));
        });
        document.getElementById('vote-start-btn').addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'vote', payload: { action: 'start', seconds: 90 } }));
        });
    }

    document.getElementById('chat-send-btn').addEventListener('click', sendChatMessage);
    document.getElementById('chat-msg-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Реакция на раскрытие
    players.forEach(p => {
        if (p.id === state.me.id) {
            ATTR_FIELDS.forEach(f => {
                const el = document.getElementById(`attr-${p.id}-${f.key}`);
                if (el) el.addEventListener('click', () => {
                    ws.send(JSON.stringify({ type: 'reveal', payload: { field: f.key } }));
                });
                const reroll = document.getElementById(`reroll-${p.id}-${f.key}`);
                if (reroll) reroll.addEventListener('click', (e) => {
                    e.stopPropagation();
                    ws.send(JSON.stringify({ type: 'reroll', payload: { field: f.key } }));
                });
            });
        }

        if (isHost) {
            const excl = document.getElementById(`exclude-${p.id}`);
            if (excl) excl.addEventListener('click', () => {
                ws.send(JSON.stringify({ type: 'exclude', payload: { playerId: p.id } }));
            });
        }
    });

    // Модал голосования если активно
    if (state.room.voting && state.room.voting.status === 'active') {
        renderVotingModal();
    }
  }

  function renderPlayerCard(p) {
    const isMe = p.id === state.me.id;
    return `
        <div class="player-card ${p.excluded ? 'excluded' : ''} ${p.online ? 'online' : 'offline'}" id="card-${p.id}">
            <div class="card-header">
                <span class="p-name">${escapeHtml(p.name)} ${isMe ? '(ВЫ)' : ''}</span>
                ${state.room.me.isHost ? `<button class="exclude-btn" id="exclude-${p.id}"><i class="fa-solid fa-user-slash"></i></button>` : ''}
            </div>
            <div class="card-body">
                <div class="attr profession">
                    <i class="fa-solid fa-briefcase"></i>
                    <span class="label">Профессия:</span>
                    <span class="val">${p.profession || '???'}</span>
                </div>
                ${ATTR_FIELDS.map(f => {
                    const revealed = p.revealed[f.key] || isMe;
                    return `
                        <div class="attr ${revealed ? 'revealed' : 'hidden'}" id="attr-${p.id}-${f.key}">
                            <i class="fa-solid ${f.icon}"></i>
                            <span class="label">${f.label}:</span>
                            <span class="val">${p[f.key] || '???'}</span>
                            ${isMe && !p.revealed[f.key] ? `<button class="reroll-btn" id="reroll-${p.id}-${f.key}"><i class="fa-solid fa-dice"></i></button>` : ''}
                            ${!revealed ? '<i class="fa-solid fa-lock"></i>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
  }

  function renderChatMessage(m) {
    return `
        <div class="chat-msg ${m.type}">
            <span class="author">${escapeHtml(m.playerName)}:</span>
            <span class="text">${escapeHtml(m.text)}</span>
        </div>
    `;
  }

  function sendChatMessage() {
    const input = document.getElementById('chat-msg-input');
    const text = input.value.trim();
    if (text) {
        ws.send(JSON.stringify({ type: 'chat', payload: { text } }));
        input.value = '';
    }
  }

  function updateUI() {
    if (state.screen === 'lobby') {
        const list = document.getElementById('player-list');
        if (list) {
            list.innerHTML = state.room.players.map(p => `
                <div class="lobby-player ${p.claimed ? 'claimed' : 'empty'}">
                    <div class="p-info">
                        <span class="p-slot">${p.slot}</span>
                        <span class="p-name">${p.claimed ? escapeHtml(p.name) : 'Свободно'}</span>
                        ${p.isHost ? '<i class="fa-solid fa-crown host-icon"></i>' : ''}
                    </div>
                    <div class="p-status">
                        ${p.online ? '<span class="online">В сети</span>' : (p.claimed ? '<span class="offline">Офлайн</span>' : '')}
                    </div>
                </div>
            `).join('');
        }
    } else if (state.screen === 'game') {
        // Умное обновление сетки игроков и чата
        const grid = document.getElementById('players-grid');
        if (grid) grid.innerHTML = state.room.players.map(renderPlayerCard).join('');

        const chat = document.getElementById('chat-messages');
        if (chat) {
            chat.innerHTML = state.room.chat.map(renderChatMessage).join('');
            chat.scrollTop = chat.scrollHeight;
        }

        const timer = state.room.timer;
        startTimer(timer);

        if (state.room.voting && state.room.voting.status === 'active') {
            if (!document.getElementById('voting-modal')) {
                renderVotingModal();
            } else {
                updateVotingModal();
            }
        } else {
            const modal = document.getElementById('voting-modal');
            if (modal) modal.remove();
        }

        if (state.room.situation) {
            showSituationModal(state.room.situation);
        }
    }
  }

  let timerInterval = null;
  function startTimer(timer) {
    const display = document.getElementById('timer-display');
    if (!display) return;
    if (timerInterval) clearInterval(timerInterval);

    if (!timer) {
        display.innerHTML = '';
        return;
    }

    const update = () => {
        const remaining = Math.max(0, Math.floor((timer.endsAt - Date.now()) / 1000));
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        display.innerHTML = `<i class="fa-solid fa-clock"></i> ${timer.label || ''}: ${mins}:${secs.toString().padStart(2, '0')}`;

        if (remaining <= 0) {
            clearInterval(timerInterval);
            display.classList.add('expired');
        } else {
            display.classList.remove('expired');
        }
    };

    update();
    timerInterval = setInterval(update, 1000);
  }

  function renderVotingModal() {
    const modal = document.createElement('div');
    modal.id = 'voting-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="panel modal-box voting-box">
            <h3>Голосование</h3>
            <p>Выберите, кого исключить из бункера</p>
            <div class="voting-candidates" id="voting-candidates">
                ${state.room.players.filter(p => !p.excluded).map(p => `
                    <button class="btn btn-secondary vote-target ${state.room.voting.ballots[state.me.id] === p.id ? 'active' : ''}" data-id="${p.id}">
                        ${escapeHtml(p.name)}
                    </button>
                `).join('')}
            </div>
            ${state.room.me.isHost ? '<button class="btn btn-danger" id="finalize-vote-btn">Завершить голосование</button>' : ''}
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.vote-target').forEach(btn => {
        btn.addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'vote', payload: { action: 'cast', targetId: Number(btn.dataset.id) } }));
        });
    });

    if (state.room.me.isHost) {
        document.getElementById('finalize-vote-btn').addEventListener('click', () => {
            ws.send(JSON.stringify({ type: 'vote', payload: { action: 'finalize' } }));
        });
    }
  }

  function updateVotingModal() {
    const candidates = document.getElementById('voting-candidates');
    if (candidates) {
        candidates.querySelectorAll('.vote-target').forEach(btn => {
            if (state.room.voting.ballots[state.me.id] === Number(btn.dataset.id)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
  }

  function showSituationModal(s) {
    if (document.getElementById('situation-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'situation-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="panel modal-box situation-box">
            <div class="situation-category">${escapeHtml(s.category)}</div>
            <h3>${escapeHtml(s.title)}</h3>
            <p>${escapeHtml(s.text)}</p>
            <button class="btn btn-primary" id="close-situation-btn">Понятно</button>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('close-situation-btn').addEventListener('click', () => {
        modal.remove();
        state.room.situation = null;
    });
  }

  function showRulesModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="panel modal-box rules-modal">
            <h3>Правила игры</h3>
            <div class="rules-content">
                <p>1. <b>Цель игры</b>: остаться в бункере после всех раундов голосования.</p>
                <p>2. <b>Персонаж</b>: у вас есть уникальный набор характеристик. Некоторые полезны, другие — нет.</p>
                <p>3. <b>Раунды</b>: в каждом раунде вы раскрываете одну свою характеристику и убеждаете остальных, почему вы важны.</p>
                <p>4. <b>Голосование</b>: игроки решают, кто меньше всего полезен сообществу и должен покинуть бункер.</p>
            </div>
            <button class="btn btn-primary" id="close-rules-btn">Закрыть</button>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('close-rules-btn').addEventListener('click', () => modal.remove());
  }

  async function showStatsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="panel modal-box">Загрузка статистики...</div>`;
    document.body.appendChild(modal);

    try {
        const res = await axios.get('/api/room/stats/global');
        const stats = res.data;
        modal.innerHTML = `
            <div class="panel modal-box stats-modal">
                <h3>История игр</h3>
                <div class="stats-list">
                    ${stats.map(s => `
                        <div class="stats-item">
                            <span>${s.catastrophe_title}</span>
                            <span>Раундов: ${s.rounds_played}</span>
                            <span>${new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-primary" id="close-stats-btn">Закрыть</button>
            </div>
        `;
    } catch (e) {
        modal.innerHTML = `<div class="panel modal-box">Ошибка загрузки<br><button class="btn btn-primary" id="close-stats-btn">Закрыть</button></div>`;
    }
    document.getElementById('close-stats-btn').addEventListener('click', () => modal.remove());
  }

  function showToast(title, message, icon) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <div class="toast-title"><i class="fa-solid ${icon || 'fa-info-circle'}"></i> ${title}</div>
      <div>${message}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 320);
    }, 3600);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
