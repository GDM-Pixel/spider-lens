-- Spider-Lens — Migration V1.0 : paramètres d'URL
-- Appliquée automatiquement au démarrage si la colonne log_entries.query n'existe pas encore.
-- url garde le chemin seul (statistiques de pages groupées), query garde ce qui suit le « ? »
-- (NULL sans paramètres), pour montrer l'adresse exacte dans les listes d'erreurs.
ALTER TABLE log_entries ADD COLUMN query TEXT;
