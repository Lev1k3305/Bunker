import { Hono } from 'hono'
import { GameRoom } from './gameDO'

type Bindings = {
  DB: D1Database,
  ROOMS: DurableObjectNamespace<GameRoom>
}

export const rooms = new Hono<{ Bindings: Bindings }>()

function genRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

rooms.post('/create', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const playerCount = Math.min(Math.max(Number(body?.playerCount) || 8, 4), 16);
  const code = genRoomCode();

  const id = c.env.ROOMS.idFromName(code);
  const room = c.env.ROOMS.get(id);

  await room.fetch('http://room/init', {
    method: 'POST',
    body: JSON.stringify({ code, playerCount })
  });

  return c.json({ code });
});

rooms.get('/:code/ws', async (c) => {
  const code = c.req.param('code').toUpperCase();
  const id = c.env.ROOMS.idFromName(code);
  const room = c.env.ROOMS.get(id);

  return room.fetch(c.req.raw);
});

// Статистика
rooms.get('/stats/global', async (c) => {
    const db = c.env.DB;
    const stats = await db.prepare('SELECT * FROM game_stats ORDER BY id DESC LIMIT 10').all();
    return c.json(stats.results);
});

rooms.get('/stats/player/:nickname', async (c) => {
    const db = c.env.DB;
    const nickname = c.req.param('nickname');
    const stats = await db.prepare('SELECT * FROM player_stats WHERE nickname = ?').bind(nickname).first();
    return c.json(stats || { nickname, games_played: 0, games_won: 0 });
});
