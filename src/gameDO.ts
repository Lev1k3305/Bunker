import { DurableObject } from "cloudflare:workers";
import {
  PROFESSIONS, AGE_GENDER, HEALTH, HOBBIES, PHOBIAS,
  TRAITS_POSITIVE, TRAITS_NEGATIVE, INVENTORY, EXTRA_INFO,
  pick, pickUnique, randomCatastrophe, randomBunkerParams,
  randomEvent, randomSituation
} from "./data";

interface Player {
  id: number;
  slot: number;
  name: string;
  token: string;
  claimed: boolean;
  excluded: boolean;
  profession?: string;
  ageGender?: string;
  health?: string;
  hobby?: string;
  phobia?: string;
  traitPositive?: string;
  traitNegative?: string;
  inventory?: string;
  extraInfo?: string;
  revealed: Record<string, boolean>;
  isHost: boolean;
  online: boolean;
}

interface GameState {
  code: string;
  status: 'lobby' | 'catastrophe' | 'game' | 'ended';
  playerCount: number;
  round: number;
  catastrophe: any;
  bunker: any;
  event: string | null;
  situation: any | null;
  timer: { type: string; label?: string; endsAt: number; seconds: number } | null;
  players: Player[];
  chat: any[];
  voting: any | null;
}

export class GameRoom extends DurableObject {
  state: GameState;
  sessions: Map<WebSocket, { playerId: number | null }>;
  env: any;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.env = env;
    this.sessions = new Map();
    // Инициализация пустого состояния, оно будет заполнено при создании комнаты
    this.state = {
      code: "",
      status: 'lobby',
      playerCount: 8,
      round: 0,
      catastrophe: null,
      bunker: null,
      event: null,
      situation: null,
      timer: null,
      players: [],
      chat: [],
      voting: null
    };

    // Восстановление состояния из хранилища
    this.ctx.blockConcurrencyWhile(async () => {
      let stored = await this.ctx.storage.get<GameState>("state");
      if (stored) {
        this.state = stored;
      }
    });
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      await this.handleSession(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // Обработка HTTP запросов (например, инициализация комнаты)
    const body: any = await request.json().catch(() => ({}));

    if (url.pathname === "/init") {
      this.state.code = body.code;
      this.state.playerCount = body.playerCount;
      this.state.players = Array.from({ length: body.playerCount }, (_, i) => ({
        id: i + 1,
        slot: i + 1,
        name: `Игрок ${i + 1}`,
        token: "",
        claimed: false,
        excluded: false,
        revealed: {},
        isHost: false,
        online: false
      }));
      await this.ctx.storage.put("state", this.state);
      return new Response(JSON.stringify({ ok: true }));
    }

    return new Response("Not found", { status: 404 });
  }

  async handleSession(ws: WebSocket) {
    this.ctx.acceptWebSocket(ws);
    this.sessions.set(ws, { playerId: null });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const session = this.sessions.get(ws);
    if (!session) return;

    let data: any;
    try {
      data = JSON.parse(message as string);
    } catch (e) {
      return;
    }

    const type = data.type;
    const payload = data.payload;

    switch (type) {
      case "join":
        await this.handleJoin(ws, session, payload);
        break;
      case "start":
        await this.handleStart(ws, session);
        break;
      case "reveal":
        await this.handleReveal(ws, session, payload);
        break;
      case "vote":
        await this.handleVote(ws, session, payload);
        break;
      case "chat":
        await this.handleChat(ws, session, payload);
        break;
      case "next_round":
        await this.handleNextRound(ws, session, payload);
        break;
      case "situation":
        await this.handleSituation(ws, session);
        break;
      case "reroll":
        await this.handleReroll(ws, session, payload);
        break;
      case "exclude":
        await this.handleExclude(ws, session, payload);
        break;
      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const session = this.sessions.get(ws);
    if (session && session.playerId) {
      const player = this.state.players.find(p => p.id === session.playerId);
      if (player) {
        player.online = false;
        this.broadcastState();
      }
    }
    this.sessions.delete(ws);
  }

  async webSocketError(ws: WebSocket, error: any) {
    this.sessions.delete(ws);
  }

  // Логика игры

  async handleJoin(ws: WebSocket, session: { playerId: number | null }, payload: any) {
    const { token, slot, name } = payload;

    // 1. Попытка восстановить сессию по токену
    let player = token ? this.state.players.find(p => p.token === token) : null;

    // 2. Если токена нет или он невалидный — ищем указанный слот
    if (!player && slot) {
        player = this.state.players.find(p => p.slot === slot && !p.claimed);
    }

    // 3. Если слот не указан — ищем первый свободный слот
    if (!player && !token) {
        player = this.state.players.find(p => !p.claimed);
    }

    if (!player) {
      ws.send(JSON.stringify({ type: "error", payload: "Нет свободных мест или неверный токен" }));
      return;
    }

    if (!player.claimed) {
      player.claimed = true;
      player.token = token || Math.random().toString(36).substring(2);
      player.name = name || player.name;
      if (!this.state.players.some(p => p.isHost)) {
        player.isHost = true;
      }
      this.addSystemMessage(`${player.name} присоединился к игре.`);
    }

    player.online = true;
    session.playerId = player.id;

    ws.send(JSON.stringify({ type: "welcome", payload: { playerId: player.id, token: player.token } }));
    this.broadcastState();
    await this.ctx.storage.put("state", this.state);
  }

  async handleStart(ws: WebSocket, session: { playerId: number | null }) {
    const player = this.state.players.find(p => p.id === session.playerId);
    if (!player?.isHost) return;

    const n = this.state.players.length;
    const professions = pickUnique(PROFESSIONS, n);
    const ageGenders = pickUnique(AGE_GENDER, n);
    const healths = pickUnique(HEALTH, n);
    const hobbies = pickUnique(HOBBIES, n);
    const phobias = pickUnique(PHOBIAS, n);
    const traitsPos = pickUnique(TRAITS_POSITIVE, n);
    const traitsNeg = pickUnique(TRAITS_NEGATIVE, n);
    const inventories = pickUnique(INVENTORY, n);
    const extras = pickUnique(EXTRA_INFO, n);

    this.state.players.forEach((p, i) => {
      p.profession = professions[i];
      p.ageGender = ageGenders[i];
      p.health = healths[i];
      p.hobby = hobbies[i];
      p.phobia = phobias[i];
      p.traitPositive = traitsPos[i];
      p.traitNegative = traitsNeg[i];
      p.inventory = inventories[i];
      p.extraInfo = extras[i];
      p.revealed = { profession: true };
      p.excluded = false;
    });

    this.state.catastrophe = randomCatastrophe();
    this.state.bunker = randomBunkerParams();
    this.state.status = 'catastrophe';
    this.state.round = 0;

    this.addSystemMessage(`Игра началась! Катастрофа: ${this.state.catastrophe.title}`);
    this.broadcastState();
    await this.ctx.storage.put("state", this.state);
  }

  async handleReveal(ws: WebSocket, session: { playerId: number | null }, payload: any) {
    const player = this.state.players.find(p => p.id === session.playerId);
    if (!player) return;

    const field = payload.field;
    player.revealed[field] = !player.revealed[field];

    if (player.revealed[field]) {
      this.addSystemMessage(`${player.name} раскрыл характеристику: ${this.getFieldLabel(field)}`);
    }

    this.broadcastState();
    await this.ctx.storage.put("state", this.state);
  }

  async handleChat(ws: WebSocket, session: { playerId: number | null }, payload: any) {
    const player = this.state.players.find(p => p.id === session.playerId);
    if (!player) return;

    const msg = {
      id: Date.now(),
      playerId: player.id,
      playerName: player.name,
      type: 'chat',
      text: payload.text,
      createdAt: new Date().toISOString()
    };

    this.state.chat.push(msg);
    if (this.state.chat.length > 50) this.state.chat.shift();

    this.broadcastState();
    await this.ctx.storage.put("state", this.state);
  }

  async handleNextRound(ws: WebSocket, session: { playerId: number | null }, payload: any) {
    const player = this.state.players.find(p => p.id === session.playerId);
    if (!player?.isHost) return;

    if (this.state.status === 'catastrophe') {
      this.state.status = 'game';
    }

    this.state.round++;
    this.state.event = randomEvent();

    const seconds = payload.seconds || 180;
    this.state.timer = {
      type: 'discussion',
      label: `Раунд ${this.state.round}`,
      endsAt: Date.now() + seconds * 1000,
      seconds
    };

    this.addSystemMessage(`Начался раунд ${this.state.round}. Событие: ${this.state.event}`);
    this.broadcastState();
    await this.ctx.storage.put("state", this.state);
  }

  async handleSituation(ws: WebSocket, session: { playerId: number | null }) {
    const player = this.state.players.find(p => p.id === session.playerId);
    if (!player?.isHost) return;

    this.state.situation = randomSituation();
    this.addSystemMessage(`📢 Новая ситуация: ${this.state.situation.title}`);
    this.broadcastState();
    await this.ctx.storage.put("state", this.state);
  }

  async handleVote(ws: WebSocket, session: { playerId: number | null }, payload: any) {
    const player = this.state.players.find(p => p.id === session.playerId);
    if (!player || player.excluded) return;

    if (payload.action === 'start') {
        if (!player.isHost) return;
        const seconds = payload.seconds || 60;
        this.state.voting = {
            id: Date.now(),
            round: this.state.round,
            status: 'active',
            endsAt: Date.now() + seconds * 1000,
            ballots: {} // playerId -> targetPlayerId
        };
        this.state.timer = {
            type: 'voting',
            label: 'Голосование',
            endsAt: this.state.voting.endsAt,
            seconds
        };
        this.addSystemMessage(`Началось голосование!`);
    } else if (payload.action === 'cast') {
        if (!this.state.voting || this.state.voting.status !== 'active') return;
        this.state.voting.ballots[player.id] = payload.targetId;
    } else if (payload.action === 'finalize') {
        if (!player.isHost && Date.now() < this.state.voting?.endsAt) return;
        this.finalizeVote();
    }

    this.broadcastState();
    await this.ctx.storage.put("state", this.state);
  }

  async finalizeVote() {
    if (!this.state.voting) return;
    const ballots = Object.values(this.state.voting.ballots) as number[];
    const tally: Record<number, number> = {};
    ballots.forEach(targetId => {
        tally[targetId] = (tally[targetId] || 0) + 1;
    });

    const entries = Object.entries(tally);
    let excludedPlayer: Player | undefined;
    if (entries.length > 0) {
        const maxVotes = Math.max(...entries.map(([, v]) => v));
        const leaders = entries.filter(([, v]) => v === maxVotes).map(([id]) => Number(id));

        if (leaders.length === 1) {
            const excludedId = leaders[0];
            excludedPlayer = this.state.players.find(p => p.id === excludedId);
            if (excludedPlayer) {
                excludedPlayer.excluded = true;
                this.addSystemMessage(`По результатам голосования ${excludedPlayer.name} исключен из бункера.`);
            }
        } else {
            this.addSystemMessage(`Голосование завершилось ничьей. Никто не исключен.`);
        }
    } else {
        this.addSystemMessage(`Никто не проголосовал. Никто не исключен.`);
    }

    this.state.voting.status = 'finished';
    this.state.voting.tally = tally;
    this.state.timer = null;

    // Проверка на окончание игры
    const survivors = this.state.players.filter(p => !p.excluded && p.claimed);
    // В бункере обычно мест на половину игроков или около того. Допустим игра заканчивается когда выживших <= playerCount / 2
    if (survivors.length <= Math.ceil(this.state.playerCount / 2)) {
        this.state.status = 'ended';
        this.addSystemMessage(`Игра окончена! Выжившие: ${survivors.map(p => p.name).join(', ')}`);
        await this.saveStatsToD1();
    }
  }

  async saveStatsToD1() {
    if (!this.env.DB) return;
    try {
        const survivors = this.state.players.filter(p => !p.excluded && p.claimed);
        await this.env.DB.prepare(
            'INSERT INTO game_stats (room_code, catastrophe_title, total_players, survivors_count, rounds_played) VALUES (?, ?, ?, ?, ?)'
        ).bind(
            this.state.code,
            this.state.catastrophe?.title || 'Unknown',
            this.state.players.filter(p => p.claimed).length,
            survivors.length,
            this.state.round
        ).run();

        for (const p of this.state.players.filter(p => p.claimed)) {
            const isWinner = !p.excluded;
            await this.env.DB.prepare(`
                INSERT INTO player_stats (nickname, games_played, games_won, last_played)
                VALUES (?, 1, ?, datetime('now'))
                ON CONFLICT(nickname) DO UPDATE SET
                    games_played = games_played + 1,
                    games_won = games_won + ?,
                    last_played = datetime('now')
            `).bind(p.name, isWinner ? 1 : 0, isWinner ? 1 : 0).run();

            if (p.profession) {
                await this.env.DB.prepare(`
                    INSERT INTO profession_stats (profession, times_picked, times_survived)
                    VALUES (?, 1, ?)
                    ON CONFLICT(profession) DO UPDATE SET
                        times_picked = times_picked + 1,
                        times_survived = times_survived + ?
                `).bind(p.profession, isWinner ? 1 : 0, isWinner ? 1 : 0).run();
            }
        }
    } catch (e) {
        console.error('Error saving stats:', e);
    }
  }

  async handleReroll(ws: WebSocket, session: { playerId: number | null }, payload: any) {
    const player = this.state.players.find(p => p.id === session.playerId);
    if (!player) return;

    const field = payload.field;
    if (player.revealed[field]) return; // Нельзя перебрасывать уже раскрытое (по правилам обычно так)

    const poolMap: any = {
        profession: PROFESSIONS,
        ageGender: AGE_GENDER,
        health: HEALTH,
        hobby: HOBBIES,
        phobia: PHOBIAS,
        traitPositive: TRAITS_POSITIVE,
        traitNegative: TRAITS_NEGATIVE,
        inventory: INVENTORY,
        extraInfo: EXTRA_INFO
    };

    if (poolMap[field]) {
        (player as any)[field] = pick(poolMap[field]);
        this.addSystemMessage(`${player.name} перебросил характеристику.`);
    }

    this.broadcastState();
    await this.ctx.storage.put("state", this.state);
  }

  async handleExclude(ws: WebSocket, session: { playerId: number | null }, payload: any) {
    const player = this.state.players.find(p => p.id === session.playerId);
    if (!player?.isHost) return;

    const target = this.state.players.find(p => p.id === payload.playerId);
    if (target) {
        target.excluded = !target.excluded;
        this.addSystemMessage(`${target.name} был ${target.excluded ? 'исключен из бункера' : 'возвращен в бункер'} ведущим.`);
    }

    this.broadcastState();
    await this.ctx.storage.put("state", this.state);
  }

  addSystemMessage(text: string) {
    this.state.chat.push({
      id: Date.now(),
      playerId: null,
      playerName: 'Система',
      type: 'system',
      text,
      createdAt: new Date().toISOString()
    });
    if (this.state.chat.length > 50) this.state.chat.shift();
  }

  broadcastState() {
    for (const [ws, session] of this.sessions.entries()) {
      const playerState = this.getPlayerState(session.playerId);
      try {
        ws.send(JSON.stringify({ type: "state", payload: playerState }));
      } catch (e) {
        this.sessions.delete(ws);
      }
    }
  }

  getPlayerState(playerId: number | null) {
    // Маскировка данных для других игроков
    const me = this.state.players.find(p => p.id === playerId);

    const players = this.state.players.map(p => {
      const isMe = p.id === playerId;
      const publicPlayer: any = {
        id: p.id,
        slot: p.slot,
        name: p.name,
        claimed: p.claimed,
        excluded: p.excluded,
        isHost: p.isHost,
        online: p.online,
        revealed: p.revealed
      };

      // Всегда публичные поля
      publicPlayer.profession = p.profession;

      // Поля, видимые если раскрыты или если это "я"
      const fields = ['ageGender', 'health', 'hobby', 'phobia', 'traitPositive', 'traitNegative', 'inventory', 'extraInfo'];
      fields.forEach(f => {
        if (isMe || p.revealed[f]) {
          publicPlayer[f] = (p as any)[f];
        }
      });

      return publicPlayer;
    });

    return {
      ...this.state,
      players,
      me: me ? { id: me.id, slot: me.slot, isHost: me.isHost } : null
    };
  }

  getFieldLabel(field: string): string {
    const map: Record<string, string> = {
      ageGender: 'Возраст / пол',
      health: 'Здоровье',
      hobby: 'Хобби',
      phobia: 'Фобия',
      traitPositive: 'Черта характера (+)',
      traitNegative: 'Черта характера (−)',
      inventory: 'Инвентарь',
      extraInfo: 'Доп. информация',
    };
    return map[field] || field;
  }
}
