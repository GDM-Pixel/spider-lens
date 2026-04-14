-- Spider-Lens — Migration V0.9 : URL re-check
-- Appliquée automatiquement au démarrage si la table "url_rechecks" n'existe pas encore

-- ─────────────────────────────────────────────────────────
-- Champ site_url optionnel sur la table sites
-- (permet d'ouvrir les URLs en lien absolu depuis le dashboard)
-- ─────────────────────────────────────────────────────────
ALTER TABLE sites ADD COLUMN site_url TEXT;

-- ─────────────────────────────────────────────────────────
-- Table url_rechecks
-- Stocke le dernier résultat de re-vérification d'une URL 404
-- UNIQUE(site_id, url) → UPSERT : on ne garde que le dernier check
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS url_rechecks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id      INTEGER NOT NULL REFERENCES sites(id),
  url          TEXT NOT NULL,
  status_code  INTEGER NOT NULL,
  final_url    TEXT,
  checked_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, url)
);

CREATE INDEX IF NOT EXISTS idx_url_rechecks_site_url ON url_rechecks(site_id, url);
