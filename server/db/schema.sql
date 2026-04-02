-- Spider-Lens — Schema SQLite V0.1
-- Créé automatiquement par database.js au premier démarrage

-- ─────────────────────────────────────────────────────────
-- Entrées de logs (une ligne par requête HTTP)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS log_entries (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp        DATETIME NOT NULL,
  ip               TEXT,
  method           TEXT,
  url              TEXT NOT NULL,
  status_code      INTEGER NOT NULL,
  response_size    INTEGER,
  referrer         TEXT,
  user_agent       TEXT,
  response_time_ms REAL,
  is_bot           INTEGER DEFAULT 0,  -- 0/1 (SQLite n'a pas BOOLEAN)
  bot_name         TEXT,               -- ex: "Googlebot", "AhrefsBot"
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────
-- État du parsing (offset pour lecture incrémentale)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parse_state (
  id              INTEGER PRIMARY KEY,
  log_file_path   TEXT NOT NULL UNIQUE,
  last_offset     INTEGER DEFAULT 0,
  last_inode      INTEGER DEFAULT 0,  -- détection de rotation de logs
  last_parsed_at  DATETIME
);

-- ─────────────────────────────────────────────────────────
-- Configuration alertes email
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_config (
  id                      INTEGER PRIMARY KEY,
  smtp_host               TEXT,
  smtp_port               INTEGER DEFAULT 587,
  smtp_secure             INTEGER DEFAULT 0,
  smtp_user               TEXT,
  smtp_pass               TEXT,
  alert_email             TEXT,
  site_name               TEXT DEFAULT 'Mon Site',
  alert_404_enabled       INTEGER DEFAULT 1,
  alert_5xx_enabled       INTEGER DEFAULT 1,
  alert_googlebot_enabled INTEGER DEFAULT 1,
  alert_404_threshold     INTEGER DEFAULT 10,
  alert_5xx_threshold     INTEGER DEFAULT 5,
  alert_googlebot_days    INTEGER DEFAULT 7,
  updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ligne de config par défaut (singleton)
INSERT OR IGNORE INTO alert_config (id) VALUES (1);

-- ─────────────────────────────────────────────────────────
-- Historique des alertes envoyées (déduplication)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type  TEXT NOT NULL,  -- '404_spike' | '5xx' | 'googlebot_absent'
  detail      TEXT,
  sent_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────
-- Utilisateur admin (auth dashboard)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────
-- Index pour performances des requêtes fréquentes
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_log_timestamp   ON log_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_log_status      ON log_entries(status_code);
CREATE INDEX IF NOT EXISTS idx_log_url         ON log_entries(url);
CREATE INDEX IF NOT EXISTS idx_log_bot         ON log_entries(is_bot);
CREATE INDEX IF NOT EXISTS idx_log_ts_status   ON log_entries(timestamp, status_code);
CREATE INDEX IF NOT EXISTS idx_alert_sent_at   ON alert_history(alert_type, sent_at);
