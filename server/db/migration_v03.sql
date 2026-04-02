-- Spider-Lens — Migration V0.3 : filtres IP/UA + détection anomalies

-- Index IP pour les queries GROUP BY ip
CREATE INDEX IF NOT EXISTS idx_log_ip      ON log_entries(ip);
CREATE INDEX IF NOT EXISTS idx_log_site_ip ON log_entries(site_id, ip);
CREATE INDEX IF NOT EXISTS idx_log_ua      ON log_entries(user_agent);

-- Table anomalies détectées automatiquement
CREATE TABLE IF NOT EXISTS anomalies (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id          INTEGER REFERENCES sites(id),
  type             TEXT NOT NULL,
  severity         TEXT NOT NULL DEFAULT 'warning',
  value_observed   REAL NOT NULL,
  baseline_mean    REAL,
  baseline_stddev  REAL,
  metadata         TEXT,
  detected_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  notified         INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_anomalies_site ON anomalies(site_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(site_id, type, detected_at);
