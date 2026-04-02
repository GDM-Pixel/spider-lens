-- V0.5 — Blocklist IPs
CREATE TABLE IF NOT EXISTS ip_blocklist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT    NOT NULL UNIQUE,
  reason     TEXT,
  site_id    INTEGER REFERENCES sites(id) ON DELETE SET NULL,
  blocked_at TEXT    NOT NULL DEFAULT (datetime('now')),
  blocked_by TEXT    NOT NULL DEFAULT 'admin'
);

CREATE INDEX IF NOT EXISTS idx_blocklist_ip ON ip_blocklist(ip);
