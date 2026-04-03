# Changelog

Toutes les modifications notables de Spider-Lens sont documentées ici.

Format : [Semantic Versioning](https://semver.org/lang/fr/)

---

## [1.0.0] — 2026-04-03

### Ajouts
- **Internationalisation complète (i18n)** — Support de 6 langues : Français, Anglais, Espagnol, Allemand, Italien, Néerlandais
- **Sélecteur de langue** — Composant `LanguageSwitcher` dans le header avec drapeaux, persistance via `localStorage`
- **Plugin WordPress** — Intégration native dans l'admin WP (IIFE build, React externalisé via `wp-element`)
- **Logo officiel** — Remplacement du placeholder par le logo Spider-Lens dans la sidebar et l'icône WP admin
- **Signature GDM-Pixel** — Affichée en bas de la sidebar (version desktop)
- **ErrorBoundary** — Capture des erreurs React silencieuses en développement

### Corrections
- **Navigation entre les vues** — Correction d'un deadlock entre `AnimatePresence (framer-motion)` et `Suspense` qui empêchait le chargement du contenu lors des changements de route (sans rechargement forcé)
- **Boucle de redirection login** — L'intercepteur axios émet désormais un événement `spider:unauthorized` au lieu d'un `window.location.href` brutal, évitant la boucle `/login` ↔ `/dashboard`
- **Plugin WP — PHP fatal errors** — Correction du mot-clé réservé `NAMESPACE` → `API_NAMESPACE`, suppression des typed properties PHP 7.4 incompatibles, remplacement du spread operator dans `$wpdb->prepare()`
- **Plugin WP — Build manquant** — Détection du build Vite via le manifest au lieu de chercher `index.js`
- **Plugin WP — Tracking backend** — Le Collector n'enregistre plus les pages d'administration WordPress
- **Version** — Badge header mis à jour : `v0.3` → `v1.0.0`

### Améliorations
- **Transitions de routes** — Suppression de `AnimatePresence` au profit de `Suspense` simple pour une navigation fiable
- **Authentification** — Token JWT supprimé proprement du `localStorage` en cas de 401 avant la navigation

---

## [0.7.0] — 2026-03-XX

### Ajouts
- Dashboard, Codes HTTP, Top Pages, Bots & Crawlers, TTFB, Réseau, Anomalies, Blocklist, Paramètres
- Parsing incrémental Apache/Nginx avec détection de rotation de logs
- Export CSV & Excel sur les vues Codes HTTP et Top Pages
- Alertes email (404, 5xx, absence Googlebot) via SMTP configurable
- Mode débutant avec bandeaux d'aide et infobulles contextuelles
- Authentification JWT (7 jours), changement de mot de passe
- Détection de 16+ bots (Googlebot, AhrefsBot, SemrushBot, ClaudeBot...)
- Support multi-sites
- 27 tests Jest (parsing, auth, API stats)
