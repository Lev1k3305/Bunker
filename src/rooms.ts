// =====================================================================
// БУНКЕР — Multiplayer API (комнаты, реальные игроки, голосование, чат)
// =====================================================================

import { Hono } from 'hono'
import {
  PROFESSIONS, AGE_GENDER, HEALTH, HOBBIES, PHOBIAS,
  TRAITS_POSITIVE, TRAITS_NEGATIVE, INVENTORY, EXTRA_INFO,
  pick, pickUnique,
  randomCatastrophe, randomBunkerParams, randomEvent, randomSituation,
} from './data'

type Bindings = { DB: D1Database }

const ATTR_FIELDS = [
  'ageGender', 'health', 'hobby', 'phobia',
  'traitPositive', 'traitNegative', 'inventory', 'extraInfo',
] as const

const FIELD_COLUMN: Record<string, string> = {
  profession: 'profession',
  ageGender: 'age_gender',
  health: 'health',
  hobby: 'hobby',
  phobia: 'phobia',
  traitPositive: 'trait_positive',
  traitNegative: 'trait_negative',
  inventory: 'inventory',
  extraInfo: 'extra_info',
}

const FIELD_POOL: Record<string, string[]> = {
  profession: PROFESSIONS,
  ageGender: AGE_GENDER,
  health: HEALTH,
  hobby: HOBBIES,
  phobia: PHOBIAS,
  traitPositive: TRAITS_POSITIVE,
  traitNegative: TRAITS_NEGATIVE,
  inventory: INVENTORY,
  extraInfo: EXTRA_INFO,
}

const DISCUSSION_SECONDS_DEFAULT = 180;
const VOTING_SECONDS_DEFAULT = 90;

export const rooms = new Hono<{ Bindings: Bindings }>()

// ---------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------

function genRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих символов
  let out = '';
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function genToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function rowToPlayerPublic(row: any) {
  const revealed = JSON.parse(row.revealed_json || '{}');
  const pub: any = {
    id: row.id,
    slot: row.slot,
    name: row.name || `Игрок ${row.slot}`,
    claimed: !!row.claimed,
    excluded: !!row.excluded,
    profession: row.profession, // профессия всегда видна всем сразу
    revealed: {},
  };
  for (const f of ATTR_FIELDS) {
    if (revealed[f]) {
      pub[f] = row[FIELD_COLUMN[f]];
      pub.revealed[f] = true;
    } else {
      pub.revealed[f] = false;
    }
  }
  return pub;
}

function rowToPlayerPrivate(row: any) {
  const revealed = JSON.parse(row.revealed_json || '{}');
  return {
    id: row.id,
    slot: row.slot,
    name: row.name || `Игрок ${row.slot}`,
    claimed: !!row.claimed,
    excluded: !!row.excluded,
    profession: row.profession,
    ageGender: row.age_gender,
    health: row.health,
    hobby: row.hobby,
    phobia: row.phobia,
    traitPositive: row.trait_positive,
    traitNegative: row.trait_negative,
    inventory: row.inventory,
    extraInfo: row.extra_info,
    revealed,
  };
}

async function getRoom(db: D1Database, code: string) {
  return await db.prepare('SELECT * FROM rooms WHERE code = ?').bind(code).first();
}

async function getPlayers(db: D1Database, code: string) {
  const res = await db.prepare('SELECT * FROM players WHERE room_code = ? ORDER BY slot ASC').bind(code).all();
  return res.results || [];
}

async function getActiveVote(db: D1Database, code: string) {
  return await db.prepare(
    `SELECT * FROM votes WHERE room_code = ? AND status = 'active' ORDER BY id DESC LIMIT 1`
  ).bind(code).first();
}

async function getLastFinishedVote(db: D1Database, code: string) {
  return await db.prepare(
    `SELECT * FROM votes WHERE room_code = ? AND status = 'finished' ORDER BY id DESC LIMIT 1`
  ).bind(code).first();
}

function parseTimer(room: any): { type: string; endsAt: number } | null {
  if (!room?.timer_json) return null;
  try {
    return JSON.parse(room.timer_json);
  } catch {
    return null;
  }
}

async function buildState(db: D1Database, code: string, requesterToken?: string) {
  const room = await getRoom(db, code);
  if (!room) return null;

  const playerRows = await getPlayers(db, code);
  const me = requesterToken ? (playerRows as any[]).find((p) => p.token === requesterToken) : null;

  const players = (playerRows as any[]).map((row) => {
    const isMe = me && row.id === me.id;
    return isMe ? { ...rowToPlayerPrivate(row), isMe: true } : { ...rowToPlayerPublic(row), isMe: false };
  });

  const chatRes = await db.prepare(
    'SELECT * FROM chat_messages WHERE room_code = ? ORDER BY id DESC LIMIT 100'
  ).bind(code).all();
  const chat = ((chatRes.results || []) as any[]).reverse().map((m) => ({
    id: m.id,
    playerId: m.player_id,
    playerName: m.player_name,
    type: m.type,
    text: m.text,
    createdAt: m.created_at,
  }));

  const activeVote = await getActiveVote(db, code);
  let voting: any = null;
  if (activeVote) {
    const ballotsRes = await db.prepare('SELECT * FROM vote_ballots WHERE vote_id = ?').bind(activeVote.id).all();
    const ballots = (ballotsRes.results || []) as any[];
    const tally: Record<number, number> = {};
    for (const b of ballots) {
      tally[b.target_player_id] = (tally[b.target_player_id] || 0) + 1;
    }
    voting = {
      id: activeVote.id,
      round: activeVote.round,
      status: activeVote.status,
      endsAt: activeVote.ends_at,
      totalVoters: (playerRows as any[]).filter((p) => !p.excluded && p.claimed).length,
      votesCast: ballots.length,
      myVoteTargetId: me ? (ballots.find((b) => b.voter_player_id === me.id)?.target_player_id || null) : null,
      tally,
    };
  } else {
    const lastVote = await getLastFinishedVote(db, code);
    if (lastVote && lastVote.result_json) {
      voting = { status: 'finished', round: lastVote.round, result: JSON.parse(lastVote.result_json) };
    }
  }

  return {
    room: {
      code: room.code,
      status: room.status,
      playerCount: room.player_count,
      hostPlayerId: room.host_player_id,
      catastrophe: room.catastrophe_json ? JSON.parse(room.catastrophe_json) : null,
      bunker: room.bunker_json ? JSON.parse(room.bunker_json) : null,
      round: room.round,
      votingThreshold: room.voting_threshold,
      event: room.event_json ? JSON.parse(room.event_json) : null,
      situation: room.situation_json ? JSON.parse(room.situation_json) : null,
      timer: parseTimer(room),
    },
    players,
    chat,
    voting,
    me: me ? { id: me.id, slot: me.slot, token: me.token } : null,
  };
}

async function addSystemMessage(db: D1Database, code: string, text: string) {
  await db.prepare(
    `INSERT INTO chat_messages (room_code, player_id, player_name, type, text) VALUES (?, NULL, 'Система', 'system', ?)`
  ).bind(code, text).run();
}

async function touchRoom(db: D1Database, code: string) {
  await db.prepare(`UPDATE rooms SET updated_at = datetime('now') WHERE code = ?`).bind(code).run();
}

// ---------------------------------------------------------------------
// Создание комнаты
// ---------------------------------------------------------------------

rooms.post('/create', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  const playerCount = Math.min(Math.max(Number(body?.playerCount) || 8, 4), 16);

  let code = genRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getRoom(db, code);
    if (!existing) break;
    code = genRoomCode();
  }

  await db.prepare(
    `INSERT INTO rooms (code, status, player_count, voting_threshold, round) VALUES (?, 'lobby', ?, 3, 0)`
  ).bind(code, playerCount).run();

  const stmt = db.prepare(
    `INSERT INTO players (room_code, slot, claimed, revealed_json) VALUES (?, ?, 0, '{}')`
  );
  const batch = [];
  for (let i = 1; i <= playerCount; i++) {
    batch.push(stmt.bind(code, i));
  }
  await db.batch(batch);

  await addSystemMessage(db, code, `Комната ${code} создана. Мест: ${playerCount}.`);

  return c.json({ code });
});

// ---------------------------------------------------------------------
// Присоединение к комнате / занятие места
// ---------------------------------------------------------------------

rooms.post('/:code/join', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const body = await c.req.json().catch(() => ({}));
  const slot = Number(body?.slot);
  const name = String(body?.name || '').trim().slice(0, 24);

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);

  const target = await db.prepare('SELECT * FROM players WHERE room_code = ? AND slot = ?').bind(code, slot).first();
  if (!target) return c.json({ error: 'slot_not_found' }, 404);
  if ((target as any).claimed) return c.json({ error: 'slot_taken' }, 409);

  const token = genToken();
  await db.prepare(
    `UPDATE players SET claimed = 1, token = ?, name = ?, last_seen = datetime('now') WHERE id = ?`
  ).bind(token, name || `Игрок ${slot}`, (target as any).id).run();

  const isHost = !room.host_player_id;
  if (isHost) {
    await db.prepare(`UPDATE rooms SET host_player_id = ? WHERE code = ?`).bind((target as any).id, code).run();
  }

  await addSystemMessage(db, code, `${name || `Игрок ${slot}`} присоединился(лась) к бункеру (место ${slot}).`);

  const state = await buildState(db, code, token);
  return c.json({ token, isHost, ...state });
});

// ---------------------------------------------------------------------
// Получение состояния (для polling)
// ---------------------------------------------------------------------

rooms.get('/:code/state', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || undefined;

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);

  if (token) {
    const p = await db.prepare('SELECT id FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
    if (p) {
      await db.prepare(`UPDATE players SET last_seen = datetime('now') WHERE id = ?`).bind((p as any).id).run();
    }
  }

  const state = await buildState(db, code, token);
  return c.json(state);
});

// ---------------------------------------------------------------------
// Старт игры (хост генерирует катастрофу + бункер + характеристики)
// ---------------------------------------------------------------------

rooms.post('/:code/start', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);

  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) {
    return c.json({ error: 'only_host_can_start' }, 403);
  }

  const playerRows = (await getPlayers(db, code)) as any[];
  const claimedCount = playerRows.filter((p) => p.claimed).length;
  if (claimedCount < 2) {
    return c.json({ error: 'not_enough_players' }, 400);
  }

  const n = playerRows.length;
  const professions = pickUnique(PROFESSIONS, n);
  const ageGenders = pickUnique(AGE_GENDER, n);
  const healths = pickUnique(HEALTH, n);
  const hobbies = pickUnique(HOBBIES, n);
  const phobias = pickUnique(PHOBIAS, n);
  const traitsPos = pickUnique(TRAITS_POSITIVE, n);
  const traitsNeg = pickUnique(TRAITS_NEGATIVE, n);
  const inventories = pickUnique(INVENTORY, n);
  const extras = pickUnique(EXTRA_INFO, n);

  const catastrophe = randomCatastrophe();
  const bunker = randomBunkerParams();

  const batch = [];
  for (let i = 0; i < n; i++) {
    const row = playerRows[i];
    batch.push(
      db.prepare(
        `UPDATE players SET profession=?, age_gender=?, health=?, hobby=?, phobia=?, trait_positive=?, trait_negative=?, inventory=?, extra_info=?, revealed_json='{}', excluded=0 WHERE id=?`
      ).bind(
        professions[i], ageGenders[i], healths[i], hobbies[i], phobias[i],
        traitsPos[i], traitsNeg[i], inventories[i], extras[i], row.id
      )
    );
  }
  await db.batch(batch);

  await db.prepare(
    `UPDATE rooms SET status='catastrophe', catastrophe_json=?, bunker_json=?, round=0, timer_json=NULL WHERE code=?`
  ).bind(JSON.stringify(catastrophe), JSON.stringify(bunker), code).run();

  await addSystemMessage(db, code, `☢ Катастрофа: «${catastrophe.title}». Досье выживших сгенерированы.`);

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------
// Перегенерация катастрофы / бункера (только хост, пока статус = catastrophe)
// ---------------------------------------------------------------------

rooms.post('/:code/reroll-catastrophe', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  const catastrophe = randomCatastrophe();
  await db.prepare(`UPDATE rooms SET catastrophe_json=? WHERE code=?`).bind(JSON.stringify(catastrophe), code).run();
  return c.json({ catastrophe });
});

rooms.post('/:code/reroll-bunker', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  const bunker = randomBunkerParams();
  await db.prepare(`UPDATE rooms SET bunker_json=? WHERE code=?`).bind(JSON.stringify(bunker), code).run();
  return c.json({ bunker });
});

// ---------------------------------------------------------------------
// Вход в бункер (переход catastrophe -> game), только хост
// ---------------------------------------------------------------------

rooms.post('/:code/enter-bunker', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  await db.prepare(`UPDATE rooms SET status='game', round=1 WHERE code=?`).bind(code).run();
  await addSystemMessage(db, code, `🚪 Все спустились в бункер. Начинается раунд 1.`);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------
// Раскрытие / скрытие своей характеристики (сам игрок управляет собой)
// ---------------------------------------------------------------------

rooms.post('/:code/reveal', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const body = await c.req.json().catch(() => ({}));
  const field = String(body?.field || '');

  if (!ATTR_FIELDS.includes(field as any)) return c.json({ error: 'bad_field' }, 400);

  const me = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!me) return c.json({ error: 'not_joined' }, 403);

  const revealed = JSON.parse((me as any).revealed_json || '{}');
  revealed[field] = !revealed[field];
  await db.prepare('UPDATE players SET revealed_json = ? WHERE id = ?').bind(JSON.stringify(revealed), (me as any).id).run();

  if (revealed[field]) {
    await addSystemMessage(db, code, `${(me as any).name} раскрыл(а) характеристику «${fieldLabel(field)}».`);
  }

  return c.json({ ok: true, revealed });
});

// ---------------------------------------------------------------------
// Переброс своей скрытой характеристики
// ---------------------------------------------------------------------

rooms.post('/:code/reroll-attr', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const body = await c.req.json().catch(() => ({}));
  const field = String(body?.field || '');

  if (!(field in FIELD_COLUMN)) return c.json({ error: 'bad_field' }, 400);

  const me = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!me) return c.json({ error: 'not_joined' }, 403);

  const revealed = JSON.parse((me as any).revealed_json || '{}');
  if (field !== 'profession' && revealed[field]) {
    return c.json({ error: 'already_revealed' }, 400);
  }

  const pool = FIELD_POOL[field];
  const value = pick(pool);
  const column = FIELD_COLUMN[field];
  await db.prepare(`UPDATE players SET ${column} = ? WHERE id = ?`).bind(value, (me as any).id).run();

  return c.json({ ok: true, value });
});

// ---------------------------------------------------------------------
// Исключение / восстановление игрока (доступно любому — обычно после голосования; хост может вручную)
// ---------------------------------------------------------------------

rooms.post('/:code/exclude', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const body = await c.req.json().catch(() => ({}));
  const targetId = Number(body?.playerId);

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  const target = await db.prepare('SELECT * FROM players WHERE id = ? AND room_code = ?').bind(targetId, code).first();
  if (!target) return c.json({ error: 'player_not_found' }, 404);

  const newExcluded = (target as any).excluded ? 0 : 1;
  await db.prepare('UPDATE players SET excluded = ? WHERE id = ?').bind(newExcluded, targetId).run();

  await addSystemMessage(db, code, newExcluded
    ? `❌ ${(target as any).name} исключён(а) из бункера.`
    : `✅ ${(target as any).name} возвращён(а) в бункер.`);

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------
// Следующий раунд + короткое событие + таймер обсуждения
// ---------------------------------------------------------------------

rooms.post('/:code/next-round', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const body = await c.req.json().catch(() => ({}));
  const discussionSeconds = Math.min(Math.max(Number(body?.seconds) || DISCUSSION_SECONDS_DEFAULT, 30), 900);

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  const newRound = (room.round as number) + 1;
  const event = randomEvent();
  const endsAt = Date.now() + discussionSeconds * 1000;
  const timer = { type: 'discussion', endsAt, round: newRound, seconds: discussionSeconds };

  await db.prepare(
    `UPDATE rooms SET round=?, event_json=?, timer_json=? WHERE code=?`
  ).bind(newRound, JSON.stringify(event), JSON.stringify(timer), code).run();

  await addSystemMessage(db, code, `⏱ Раунд ${newRound} начался. Событие: ${event}`);

  return c.json({ ok: true, round: newRound, event, timer });
});

// ---------------------------------------------------------------------
// Ситуация — озвучивается в любой момент, без ограничений по раунду
// ---------------------------------------------------------------------

rooms.post('/:code/situation', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  const situation = randomSituation();
  await db.prepare(`UPDATE rooms SET situation_json=? WHERE code=?`).bind(JSON.stringify(situation), code).run();
  await addSystemMessage(db, code, `📢 Ситуация озвучена: «${situation.title}» — обсудите вслух!`);

  return c.json({ situation });
});

// ---------------------------------------------------------------------
// Установить произвольный таймер обсуждения (без смены раунда) — например, для чата
// ---------------------------------------------------------------------

rooms.post('/:code/timer/start', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const body = await c.req.json().catch(() => ({}));
  const seconds = Math.min(Math.max(Number(body?.seconds) || DISCUSSION_SECONDS_DEFAULT, 15), 1800);
  const label = String(body?.label || 'Обсуждение');

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  const endsAt = Date.now() + seconds * 1000;
  const timer = { type: 'discussion', label, endsAt, seconds };
  await db.prepare(`UPDATE rooms SET timer_json=? WHERE code=?`).bind(JSON.stringify(timer), code).run();
  await addSystemMessage(db, code, `⏱ Запущен таймер «${label}» на ${seconds} сек.`);

  return c.json({ ok: true, timer });
});

rooms.post('/:code/timer/cancel', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  await db.prepare(`UPDATE rooms SET timer_json=NULL WHERE code=?`).bind(code).run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------
// Голосование: старт (хост, только с порогового раунда), голос, финализация
// ---------------------------------------------------------------------

rooms.post('/:code/vote/start', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const body = await c.req.json().catch(() => ({}));
  const seconds = Math.min(Math.max(Number(body?.seconds) || VOTING_SECONDS_DEFAULT, 15), 900);

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  if ((room.round as number) < (room.voting_threshold as number)) {
    return c.json({ error: 'voting_locked', threshold: room.voting_threshold }, 400);
  }

  const existingActive = await getActiveVote(db, code);
  if (existingActive) return c.json({ error: 'vote_already_active' }, 400);

  const endsAt = Date.now() + seconds * 1000;
  const result = await db.prepare(
    `INSERT INTO votes (room_code, round, status, ends_at) VALUES (?, ?, 'active', ?)`
  ).bind(code, room.round, String(endsAt)).run();

  const timer = { type: 'voting', endsAt, seconds, round: room.round };
  await db.prepare(`UPDATE rooms SET timer_json=? WHERE code=?`).bind(JSON.stringify(timer), code).run();
  await addSystemMessage(db, code, `🗳 Голосование за исключение открыто! У вас ${seconds} сек.`);

  return c.json({ ok: true, voteId: (result.meta as any).last_row_id, timer });
});

rooms.post('/:code/vote/cast', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const body = await c.req.json().catch(() => ({}));
  const targetPlayerId = Number(body?.targetPlayerId);

  const me = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!me) return c.json({ error: 'not_joined' }, 403);
  if ((me as any).excluded) return c.json({ error: 'excluded_cannot_vote' }, 403);

  const activeVote = await getActiveVote(db, code);
  if (!activeVote) return c.json({ error: 'no_active_vote' }, 400);
  if (Date.now() > Number(activeVote.ends_at)) return c.json({ error: 'vote_expired' }, 400);

  const target = await db.prepare('SELECT * FROM players WHERE id = ? AND room_code = ?').bind(targetPlayerId, code).first();
  if (!target) return c.json({ error: 'target_not_found' }, 404);

  await db.prepare(
    `INSERT INTO vote_ballots (vote_id, voter_player_id, target_player_id) VALUES (?, ?, ?)
     ON CONFLICT(vote_id, voter_player_id) DO UPDATE SET target_player_id = excluded.target_player_id`
  ).bind(activeVote.id, (me as any).id, targetPlayerId).run();

  return c.json({ ok: true });
});

rooms.post('/:code/vote/finalize', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  const isHost = requester && (requester as any).id === room.host_player_id;

  const activeVote = await getActiveVote(db, code);
  if (!activeVote) return c.json({ error: 'no_active_vote' }, 400);

  // Разрешаем финализацию хосту в любой момент, либо любому — если время истекло
  if (!isHost && Date.now() < Number(activeVote.ends_at)) {
    return c.json({ error: 'only_host_or_expired' }, 403);
  }

  const ballotsRes = await db.prepare('SELECT * FROM vote_ballots WHERE vote_id = ?').bind(activeVote.id).all();
  const ballots = (ballotsRes.results || []) as any[];
  const tally: Record<number, number> = {};
  for (const b of ballots) tally[b.target_player_id] = (tally[b.target_player_id] || 0) + 1;

  const entries = Object.entries(tally);
  let excludedPlayerId: number | null = null;
  let tie = false;
  let leaders: number[] = [];

  if (entries.length > 0) {
    const maxVotes = Math.max(...entries.map(([, v]) => v));
    leaders = entries.filter(([, v]) => v === maxVotes).map(([id]) => Number(id));
    if (leaders.length === 1) {
      excludedPlayerId = leaders[0];
    } else {
      tie = true;
    }
  }

  const result = { tally, excludedPlayerId, tie, leaders };

  await db.prepare(`UPDATE votes SET status='finished', result_json=? WHERE id=?`).bind(JSON.stringify(result), activeVote.id).run();
  await db.prepare(`UPDATE rooms SET timer_json=NULL WHERE code=?`).bind(code).run();

  if (excludedPlayerId) {
    const target = await db.prepare('SELECT * FROM players WHERE id = ?').bind(excludedPlayerId).first();
    await db.prepare('UPDATE players SET excluded = 1 WHERE id = ?').bind(excludedPlayerId).run();
    await addSystemMessage(db, code, `🗳 Голосование завершено: ${target ? (target as any).name : 'игрок'} исключён(а) из бункера (${tally[excludedPlayerId]} голос(ов)).`);
  } else if (tie) {
    await addSystemMessage(db, code, `🗳 Голосование завершено ничьей — никто не исключён. Требуется обсуждение или повторное голосование.`);
  } else {
    await addSystemMessage(db, code, `🗳 Голосование завершено — голосов не было подано, никто не исключён.`);
  }

  return c.json({ ok: true, result });
});

// ---------------------------------------------------------------------
// Чат
// ---------------------------------------------------------------------

rooms.post('/:code/chat', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';
  const body = await c.req.json().catch(() => ({}));
  const text = String(body?.text || '').trim().slice(0, 500);
  if (!text) return c.json({ error: 'empty_message' }, 400);

  const me = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!me) return c.json({ error: 'not_joined' }, 403);

  await db.prepare(
    `INSERT INTO chat_messages (room_code, player_id, player_name, type, text) VALUES (?, ?, ?, 'chat', ?)`
  ).bind(code, (me as any).id, (me as any).name, text).run();

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------
// Новая игра (сброс комнаты в лобби, хост)
// ---------------------------------------------------------------------

rooms.post('/:code/reset', async (c) => {
  const db = c.env.DB;
  const code = c.req.param('code').toUpperCase();
  const token = c.req.header('X-Player-Token') || '';

  const room = await getRoom(db, code);
  if (!room) return c.json({ error: 'room_not_found' }, 404);
  const requester = await db.prepare('SELECT * FROM players WHERE room_code = ? AND token = ?').bind(code, token).first();
  if (!requester || (requester as any).id !== room.host_player_id) return c.json({ error: 'only_host' }, 403);

  await db.prepare(
    `UPDATE rooms SET status='lobby', catastrophe_json=NULL, bunker_json=NULL, round=0, event_json=NULL, situation_json=NULL, timer_json=NULL WHERE code=?`
  ).bind(code).run();

  await db.prepare(
    `UPDATE players SET profession=NULL, age_gender=NULL, health=NULL, hobby=NULL, phobia=NULL, trait_positive=NULL, trait_negative=NULL, inventory=NULL, extra_info=NULL, revealed_json='{}', excluded=0 WHERE room_code=?`
  ).bind(code).run();

  await db.prepare(`DELETE FROM votes WHERE room_code=?`).bind(code).run();
  await addSystemMessage(db, code, `🔄 Игра сброшена. Возврат в лобби.`);

  return c.json({ ok: true });
});

function fieldLabel(field: string): string {
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
