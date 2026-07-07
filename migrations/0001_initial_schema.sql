-- Комнаты игры
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'lobby',            -- lobby | catastrophe | game | ended
  player_count INTEGER NOT NULL,
  host_player_id INTEGER,
  catastrophe_json TEXT,
  bunker_json TEXT,
  round INTEGER NOT NULL DEFAULT 0,
  voting_threshold INTEGER NOT NULL DEFAULT 3,
  event_json TEXT,
  situation_json TEXT,
  timer_json TEXT,                                  -- активный таймер: обсуждение или голосование
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Места/игроки в комнате
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  slot INTEGER NOT NULL,
  name TEXT,
  token TEXT,
  claimed INTEGER NOT NULL DEFAULT 0,
  profession TEXT,
  age_gender TEXT,
  health TEXT,
  hobby TEXT,
  phobia TEXT,
  trait_positive TEXT,
  trait_negative TEXT,
  inventory TEXT,
  extra_info TEXT,
  revealed_json TEXT NOT NULL DEFAULT '{}',
  excluded INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  UNIQUE(room_code, slot)
);

-- Сообщения чата
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  player_id INTEGER,
  player_name TEXT,
  type TEXT NOT NULL DEFAULT 'chat',                -- chat | system
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Сессии голосования
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  round INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',            -- active | finished | cancelled
  ends_at TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Индивидуальные бюллетени голосования
CREATE TABLE IF NOT EXISTS vote_ballots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vote_id INTEGER NOT NULL,
  voter_player_id INTEGER NOT NULL,
  target_player_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(vote_id, voter_player_id)
);

CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_code);
CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_code, id);
CREATE INDEX IF NOT EXISTS idx_votes_room ON votes(room_code, id);
CREATE INDEX IF NOT EXISTS idx_ballots_vote ON vote_ballots(vote_id);
