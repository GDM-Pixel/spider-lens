-- V0.6 — Politique de rétention des données
CREATE TABLE IF NOT EXISTS retention_policy (
  id            INTEGER PRIMARY KEY,
  logs_days     INTEGER DEFAULT 90,
  anomalies_days INTEGER DEFAULT 90,
  alerts_days   INTEGER DEFAULT 90,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO retention_policy (id) VALUES (1)
