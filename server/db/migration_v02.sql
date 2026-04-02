-- Spider-Lens — Migration V0.2 : support multi-sites
-- Appliquée automatiquement au démarrage si la table "sites" n'existe pas encore

-- ─────────────────────────────────────────────────────────
-- Table sites
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  log_file_path TEXT NOT NULL UNIQUE,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────
-- Ajout site_id aux tables existantes
-- ALTER TABLE … ADD COLUMN est idempotent via IF NOT EXISTS (SQLite 3.37+)
-- On utilise un guard via la présence de la colonne
-- ─────────────────────────────────────────────────────────
-- log_entries
ALTER TABLE log_entries ADD COLUMN site_id INTEGER REFERENCES sites(id);

-- parse_state
ALTER TABLE parse_state ADD COLUMN site_id INTEGER REFERENCES sites(id);

-- alert_config
ALTER TABLE alert_config ADD COLUMN site_id INTEGER REFERENCES sites(id);

-- alert_history
ALTER TABLE alert_history ADD COLUMN site_id INTEGER REFERENCES sites(id);

-- ─────────────────────────────────────────────────────────
-- Index supplémentaires
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_log_site       ON log_entries(site_id);
CREATE INDEX IF NOT EXISTS idx_log_site_ts    ON log_entries(site_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_cfg_site ON alert_config(site_id);
