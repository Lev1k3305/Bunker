-- Поддержка ботов (игроков, управляемых ИИ)
ALTER TABLE players ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN bot_persona TEXT;

-- Отметка последнего раунда, в котором бот уже совершил "ход" (авто-раскрытие),
-- чтобы не дублировать действие при многократном опросе (poll) в рамках одного раунда
ALTER TABLE players ADD COLUMN bot_last_round_acted INTEGER NOT NULL DEFAULT 0;

-- Отметка, что бот уже проголосовал в рамках активного голосования (по id голосования),
-- чтобы не голосовать повторно при повторных триггерах
ALTER TABLE players ADD COLUMN bot_last_vote_id INTEGER NOT NULL DEFAULT 0;
