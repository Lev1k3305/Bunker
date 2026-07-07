-- Статистика завершённых партий
CREATE TABLE IF NOT EXISTS game_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  catastrophe_title TEXT,
  total_players INTEGER,
  survivors_count INTEGER,
  rounds_played INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Статистика по игрокам/никам
CREATE TABLE IF NOT EXISTS player_stats (
  nickname TEXT PRIMARY KEY,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  last_played TEXT
);

-- Статистика по профессиям (популярность/выживаемость)
CREATE TABLE IF NOT EXISTS profession_stats (
  profession TEXT PRIMARY KEY,
  times_picked INTEGER DEFAULT 0,
  times_survived INTEGER DEFAULT 0
);
