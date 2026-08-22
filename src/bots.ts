// =====================================================================
// SHELTER — Логика ИИ-ботов (авто-раскрытие характеристик, авто-голосование,
// генерация реплик в чате через Groq LLM API)
//
// Важное архитектурное ограничение: Cloudflare Workers не поддерживают
// фоновые/persistent-процессы. Поэтому "ход" бота никогда не выполняется
// сам по себе — он всегда триггерится синхронно как побочный эффект
// реального запроса игрока (next-round, vote/start, chat, poll состояния).
// Любая ошибка LLM-вызова (таймаут/сеть/лимит) гасится try/catch —
// бот просто промолчит, игра никогда не блокируется из-за ботов.
// =====================================================================

import { BOT_NAMES, randomBotName, randomBotPersona, type BotPersona, pick } from './data'

export type BotEnv = {
  DB: D1Database;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
}

const ATTR_FIELDS = [
  'ageGender', 'health', 'hobby', 'phobia',
  'traitPositive', 'traitNegative', 'inventory', 'extraInfo',
] as const;

const FIELD_COLUMN: Record<string, string> = {
  ageGender: 'age_gender',
  health: 'health',
  hobby: 'hobby',
  phobia: 'phobia',
  traitPositive: 'trait_positive',
  traitNegative: 'trait_negative',
  inventory: 'inventory',
  extraInfo: 'extra_info',
}

const FIELD_LABEL: Record<string, string> = {
  ageGender: 'Возраст / пол',
  health: 'Здоровье',
  hobby: 'Хобби',
  phobia: 'Фобия',
  traitPositive: 'Черта характера (+)',
  traitNegative: 'Черта характера (−)',
  inventory: 'Инвентарь',
  extraInfo: 'Доп. информация',
}

const BOT_PERSONA_BY_KEY: Record<string, BotPersona> = {};
// заполняется лениво при первом обращении (см. getPersonaByKey)

async function addSystemMessage(db: D1Database, code: string, text: string) {
  await db.prepare(
    `INSERT INTO chat_messages (room_code, player_id, player_name, type, text) VALUES (?, NULL, 'Система', 'system', ?)`
  ).bind(code, text).run();
}

async function addBotChatMessage(db: D1Database, code: string, botId: number, botName: string, text: string) {
  await db.prepare(
    `INSERT INTO chat_messages (room_code, player_id, player_name, type, text) VALUES (?, ?, ?, 'chat', ?)`
  ).bind(code, botId, botName, text).run();
}

function getPersonaByKey(key: string | null | undefined): BotPersona {
  if (key && BOT_PERSONA_BY_KEY[key]) return BOT_PERSONA_BY_KEY[key];
  const p = randomBotPersona();
  return p;
}

// ---------------------------------------------------------------------
// Добавление бота на свободное место (только в лобби — атрибуты бот
// получит вместе со всеми при /start, как обычный игрок)
// ---------------------------------------------------------------------

export async function addBotToRoom(db: D1Database, code: string, requestedSlot?: number) {
  const playersRes = await db.prepare('SELECT * FROM players WHERE room_code = ? ORDER BY slot ASC').bind(code).all();
  const playerRows = (playersRes.results || []) as any[];

  let target: any = null;
  if (requestedSlot) {
    target = playerRows.find((p) => p.slot === requestedSlot && !p.claimed) || null;
  } else {
    target = playerRows.find((p) => !p.claimed) || null;
  }
  if (!target) return { error: 'no_empty_slot' as const };

  const existingNames = playerRows.map((p) => p.name).filter(Boolean);
  const botName = randomBotName(existingNames);
  const persona = randomBotPersona();

  await db.prepare(
    `UPDATE players SET claimed = 1, is_bot = 1, bot_persona = ?, name = ?, token = NULL, last_seen = datetime('now') WHERE id = ?`
  ).bind(persona.key, botName, target.id).run();

  await addSystemMessage(db, code, `🤖 ${botName} (бот) присоединился(лась) к бункеру (место ${target.slot}).`);

  return { ok: true as const, botId: target.id, botName, slot: target.slot, persona: persona.key };
}

export async function removeBotFromRoom(db: D1Database, code: string, playerId: number) {
  const target = await db.prepare('SELECT * FROM players WHERE id = ? AND room_code = ?').bind(playerId, code).first();
  if (!target) return { error: 'player_not_found' as const };
  if (!(target as any).is_bot) return { error: 'not_a_bot' as const };

  await db.prepare(
    `UPDATE players SET claimed = 0, is_bot = 0, bot_persona = NULL, name = NULL, token = NULL,
       profession=NULL, age_gender=NULL, health=NULL, hobby=NULL, phobia=NULL, trait_positive=NULL,
       trait_negative=NULL, inventory=NULL, extra_info=NULL, revealed_json='{}', excluded=0,
       bot_last_round_acted=0, bot_last_vote_id=0
     WHERE id = ?`
  ).bind(playerId).run();

  await addSystemMessage(db, code, `🤖 Бот ${(target as any).name || ''} удалён из бункера.`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------
// Groq LLM — генерация короткой реплики бота в чат
// ---------------------------------------------------------------------

interface BotChatContext {
  botName: string;
  persona: BotPersona;
  selfInfo: Record<string, string | undefined>; // все атрибуты бота (он знает себя полностью)
  catastropheTitle?: string;
  bunkerSummary?: string;
  round: number;
  phase: 'discussion' | 'voting';
  recentChat: { name: string; text: string }[];
  aliveOthers: string[];
}

async function callGroq(env: BotEnv, systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey) return null;
  const model = env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        // gpt-oss модели на Groq по умолчанию тратят токены на скрытое "рассуждение" —
        // без reasoning_effort=low весь лимит max_tokens может уйти туда, а content останется пустым.
        reasoning_effort: 'low',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.95,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) return null;
    const data: any = await resp.json();
    let text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') return null;
    // На случай если модель всё же просочит служебные теги рассуждения в content
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!text) return null;
    return text.replace(/^["«]|["»]$/g, '').slice(0, 400);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateBotChatMessage(env: BotEnv, ctx: BotChatContext): Promise<string | null> {
  const systemPrompt =
    `Ты играешь роль бота-персонажа по имени "${ctx.botName}" в социальной игре "Бункер" ` +
    `(российский аналог "Мафии/Бункера" — выжившие после катастрофы спорят, кого оставить в бункере). ` +
    `Твой характер: ${ctx.persona.label}. Манера речи: ${ctx.persona.style}. ` +
    `Правила ответа: пиши ТОЛЬКО на русском языке, 1-2 короткими предложениями, разговорным тоном, ` +
    `без кавычек, без markdown, без упоминания что ты ИИ/бот/языковая модель. ` +
    `Ты полноценный участник обсуждения и обязан звучать как живой человек в стрессовой ситуации выживания.`;

  const selfLines = Object.entries(ctx.selfInfo)
    .filter(([, v]) => !!v)
    .map(([k, v]) => `${FIELD_LABEL[k] || k}: ${v}`)
    .join('; ');

  const chatLines = ctx.recentChat.slice(-8).map((m) => `${m.name}: ${m.text}`).join('\n') || '(сообщений пока нет)';

  const userPrompt =
    `Катастрофа: ${ctx.catastropheTitle || 'неизвестна'}.\n` +
    `Бункер: ${ctx.bunkerSummary || 'параметры неизвестны'}.\n` +
    `Раунд: ${ctx.round}. Фаза: ${ctx.phase === 'voting' ? 'идёт голосование за исключение' : 'обсуждение'}.\n` +
    `Твоя полная карточка персонажа (знаешь только ты): ${selfLines || 'нет данных'}.\n` +
    `Живые участники: ${ctx.aliveOthers.join(', ') || 'нет данных'}.\n` +
    `Последние сообщения чата:\n${chatLines}\n\n` +
    `Напиши свою следующую реплику в общий чат — либо аргумент в свою защиту, либо реакцию на чужие слова, ` +
    `в соответствии со своим характером. Не повторяй чужие фразы дословно.`;

  return await callGroq(env, systemPrompt, userPrompt);
}

// ---------------------------------------------------------------------
// Ход бота в раунде: авто-раскрытие одной характеристики + (с вероятностью) реплика в чат
// Вызывается синхронно из POST /:code/next-round сразу после смены раунда.
// ---------------------------------------------------------------------

export async function runBotRoundActions(db: D1Database, env: BotEnv, code: string) {
  const room = await db.prepare('SELECT * FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return;

  const playersRes = await db.prepare('SELECT * FROM players WHERE room_code = ? ORDER BY slot ASC').bind(code).all();
  const playerRows = (playersRes.results || []) as any[];

  const bots = playerRows.filter((p) => p.is_bot && p.claimed && !p.excluded && p.bot_last_round_acted < (room as any).round);
  if (bots.length === 0) return;

  const catastrophe = (room as any).catastrophe_json ? JSON.parse((room as any).catastrophe_json) : null;
  const bunker = (room as any).bunker_json ? JSON.parse((room as any).bunker_json) : null;
  const bunkerSummary = bunker
    ? `вместимость ${bunker.capacity}, запасы на ${bunker.durationLabel || bunker.duration || '?'}`
    : undefined;

  const chatRes = await db.prepare('SELECT * FROM chat_messages WHERE room_code = ? ORDER BY id DESC LIMIT 10').bind(code).all();
  const recentChat = ((chatRes.results || []) as any[]).reverse()
    .filter((m) => m.type === 'chat')
    .map((m) => ({ name: m.player_name, text: m.text }));

  const aliveOthersAll = playerRows.filter((p) => p.claimed && !p.excluded).map((p) => p.name);

  for (const bot of bots) {
    try {
      // 1. Авто-раскрытие одной случайной нераскрытой характеристики
      const revealed = JSON.parse(bot.revealed_json || '{}');
      const unrevealed = ATTR_FIELDS.filter((f) => !revealed[f]);
      let revealedField: string | null = null;
      if (unrevealed.length > 0) {
        revealedField = pick(unrevealed as unknown as string[]);
        revealed[revealedField] = true;
        await db.prepare('UPDATE players SET revealed_json = ? WHERE id = ?').bind(JSON.stringify(revealed), bot.id).run();
        await addSystemMessage(db, code, `${bot.name} раскрыл(а) характеристику «${FIELD_LABEL[revealedField]}».`);
      }

      // 2. С вероятностью ~55% бот пишет реплику в чат через LLM
      if (Math.random() < 0.55) {
        const persona = getPersonaByKey(bot.bot_persona);
        const selfInfo: Record<string, string> = {
          profession: bot.profession,
          ageGender: bot.age_gender,
          health: bot.health,
          hobby: bot.hobby,
          phobia: bot.phobia,
          traitPositive: bot.trait_positive,
          traitNegative: bot.trait_negative,
          inventory: bot.inventory,
          extraInfo: bot.extra_info,
        };
        const message = await generateBotChatMessage(env, {
          botName: bot.name,
          persona,
          selfInfo,
          catastropheTitle: catastrophe?.title,
          bunkerSummary,
          round: (room as any).round,
          phase: 'discussion',
          recentChat,
          aliveOthers: aliveOthersAll.filter((n) => n !== bot.name),
        });
        if (message) {
          await addBotChatMessage(db, code, bot.id, bot.name, message);
          recentChat.push({ name: bot.name, text: message });
        }
      }

      await db.prepare('UPDATE players SET bot_last_round_acted = ? WHERE id = ?').bind((room as any).round, bot.id).run();
    } catch {
      // Любая ошибка по конкретному боту не должна ломать ход раунда для остальных
    }
  }
}

// ---------------------------------------------------------------------
// Авто-голосование ботов: вызывается синхронно из POST /:code/vote/start
// сразу после создания голосования. Эвристика: бот с большей вероятностью
// голосует против тех, у кого раскрыто больше "негативных" характеристик
// (фобия, отрицательная черта), плюс случайный шум, чтобы не быть предсказуемым.
// ---------------------------------------------------------------------

export async function runBotVoteActions(db: D1Database, env: BotEnv, code: string, voteId: number) {
  const playersRes = await db.prepare('SELECT * FROM players WHERE room_code = ? ORDER BY slot ASC').bind(code).all();
  const playerRows = (playersRes.results || []) as any[];

  const alive = playerRows.filter((p) => p.claimed && !p.excluded);
  const bots = alive.filter((p) => p.is_bot && p.bot_last_vote_id !== voteId);
  if (bots.length === 0) return;

  for (const bot of bots) {
    try {
      const candidates = alive.filter((p) => p.id !== bot.id);
      if (candidates.length === 0) continue;

      const weighted = candidates.map((p) => {
        const revealed = JSON.parse(p.revealed_json || '{}');
        let weight = 1;
        if (revealed.phobia) weight += 2;
        if (revealed.traitNegative) weight += 2;
        if (revealed.health) weight += 0.5; // раскрытое здоровье часто говорит о слабости
        if (revealed.traitPositive) weight -= 0.5;
        if (revealed.inventory) weight -= 0.3; // полезный инвентарь снижает шанс на исключение
        weight = Math.max(0.2, weight) * (0.6 + Math.random() * 0.8);
        return { id: p.id, weight };
      });

      const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
      let roll = Math.random() * totalWeight;
      let targetId = weighted[0].id;
      for (const w of weighted) {
        roll -= w.weight;
        if (roll <= 0) { targetId = w.id; break; }
      }

      await db.prepare(
        `INSERT INTO vote_ballots (vote_id, voter_player_id, target_player_id) VALUES (?, ?, ?)
         ON CONFLICT(vote_id, voter_player_id) DO UPDATE SET target_player_id = excluded.target_player_id`
      ).bind(voteId, bot.id, targetId).run();

      await db.prepare('UPDATE players SET bot_last_vote_id = ? WHERE id = ?').bind(voteId, bot.id).run();
    } catch {
      // ошибка по одному боту не должна ломать голосование остальных
    }
  }
}

// ---------------------------------------------------------------------
// Реакция бота на сообщение живого игрока в чате (с небольшой вероятностью),
// чтобы чат не выглядел мёртвым между раундами. Вызывается синхронно
// из POST /:code/chat сразу после сохранения сообщения игрока.
// ---------------------------------------------------------------------

export async function maybeBotChatReaction(db: D1Database, env: BotEnv, code: string) {
  if (Math.random() > 0.25) return; // ~25% шанс реакции на любое сообщение игрока

  const room = await db.prepare('SELECT * FROM rooms WHERE code = ?').bind(code).first();
  if (!room || (room as any).status !== 'game') return;

  const playersRes = await db.prepare('SELECT * FROM players WHERE room_code = ? ORDER BY slot ASC').bind(code).all();
  const playerRows = (playersRes.results || []) as any[];
  const aliveBots = playerRows.filter((p) => p.is_bot && p.claimed && !p.excluded);
  if (aliveBots.length === 0) return;

  const bot = pick(aliveBots as any[]);

  try {
    const catastrophe = (room as any).catastrophe_json ? JSON.parse((room as any).catastrophe_json) : null;
    const bunker = (room as any).bunker_json ? JSON.parse((room as any).bunker_json) : null;
    const bunkerSummary = bunker ? `вместимость ${bunker.capacity}, запасы на ${bunker.durationLabel || bunker.duration || '?'}` : undefined;

    const chatRes = await db.prepare('SELECT * FROM chat_messages WHERE room_code = ? ORDER BY id DESC LIMIT 10').bind(code).all();
    const recentChat = ((chatRes.results || []) as any[]).reverse()
      .filter((m) => m.type === 'chat')
      .map((m) => ({ name: m.player_name, text: m.text }));

    const activeVote = await db.prepare(`SELECT * FROM votes WHERE room_code = ? AND status = 'active' ORDER BY id DESC LIMIT 1`).bind(code).first();

    const persona = getPersonaByKey(bot.bot_persona);
    const selfInfo: Record<string, string> = {
      profession: bot.profession,
      ageGender: bot.age_gender,
      health: bot.health,
      hobby: bot.hobby,
      phobia: bot.phobia,
      traitPositive: bot.trait_positive,
      traitNegative: bot.trait_negative,
      inventory: bot.inventory,
      extraInfo: bot.extra_info,
    };
    const aliveOthers = playerRows.filter((p) => p.claimed && !p.excluded && p.id !== bot.id).map((p) => p.name);

    const message = await generateBotChatMessage(env, {
      botName: bot.name,
      persona,
      selfInfo,
      catastropheTitle: catastrophe?.title,
      bunkerSummary,
      round: (room as any).round,
      phase: activeVote ? 'voting' : 'discussion',
      recentChat,
      aliveOthers,
    });
    if (message) {
      await addBotChatMessage(db, code, bot.id, bot.name, message);
    }
  } catch {
    // молча игнорируем — реакция необязательна
  }
}
