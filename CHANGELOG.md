# Changelog

All notable changes to Spider-Lens are documented here.

Format: [Semantic Versioning](https://semver.org/)

---

## [1.4.0] — 2026-04-14

### Added
- **URL clickable + ouverture nouvel onglet** — Sur les vues HTTP Codes et Top Pages (client SaaS + wp-plugin), chaque URL est désormais un lien cliquable avec icône `↗` pour ouvrir la page cible dans un nouvel onglet (composant `UrlCell`).
- **Re-check 404 avec persistance** — Bouton `↻` à droite de chaque code 404 pour relancer une vérification HTTP live de l'URL. Le résultat s'affiche inline à côté du code (vert si 200, bleu si 301/302, rouge si toujours cassé) et **persiste après refresh** grâce à une nouvelle table `url_rechecks` (Node) / `spiderlens_url_rechecks` (WP).
- **Composant `RecheckButton`** — Réutilisable, gère les 3 états (idle / loading / checked) avec tooltips i18n et badges couleur.
- **Route `POST /api/crawler/recheck-url`** (Node + WP REST) — Authentifiée (JWT côté Node, `manage_options` côté WP), UPSERT par `(site_id, url)` pour ne garder que le dernier check. Cache in-memory invalidé automatiquement après chaque recheck pour garantir la persistance immédiate.
- **Migration DB V0.9** — Table `url_rechecks` + colonne `sites.site_url` (Node) ; table `spiderlens_url_rechecks` avec `url_hash` SHA2 pour l'unicité (WP, contournement limite index MySQL sur VARCHAR(2048)).
- **i18n** — Clés `common.openInNewTab` + section `recheck.*` (button / loading / fixed200 / redirected / stillBroken / error / columnHeader) ajoutées dans **les 32 fichiers locales** (16 langues × 2 stacks).

### Fixed
- **Colonnes ambiguës après LEFT JOIN** — Préfixage de toutes les colonnes (`site_id`, `status_code`, `is_bot`, `url`, `ip`, `user_agent`) avec l'alias `l.` dans les routes `GET /stats/top-404` et `GET /stats/url-detail` pour éviter les erreurs SQLite `ambiguous column name`.
- **Mono-site : `site_url` null** — Backfill auto du champ `site_url` depuis la variable d'environnement `SITE_URL` au démarrage, pour que les installations mono-site (via `.env`) aient des URLs cliquables sans passer par l'UI de gestion des sites.
- **Mono-site : `activeSiteId` null** — Fallback `effectiveSiteId` → `sites[0].id` quand un seul site est présent, pour que le bouton recheck envoie toujours un `siteId` valide au backend.
- **Persistance recheck après refresh** — Appel de `flushSite(siteId)` après UPSERT dans la route recheck pour invalider le cache `node-cache` qui servait des données stale au rechargement de page.

### Improved
- **Responsive HTTP Codes** — URL truncate + colonne contrainte à `max-w-[280px]` pour éviter le débordement horizontal sur écrans étroits. Bouton recheck déplacé inline dans la cellule du code HTTP (plus de colonne séparée).

---

## [1.1.1] — 2026-04-07

### Added
- **Bot detection** : ajout de 3 crawlers SEO dans la liste de détection (WP plugin + app Node)
  - `Barkrowler` — crawler SEO de [Babbar.tech](https://babbar.tech)
  - `IbouBot` — crawler du moteur de recherche [Ibou.io](https://ibou.io) (Sylvain & Nicolas Peyronnet)
  - `HaloBot` — crawler de [Haloscan.com](https://haloscan.com) — un grand merci à l'équipe Haloscan pour leur bot proprement identifié dans le User-Agent !

### Fixed
- **Collector WP** : les requêtes `/wp-json/*`, `/wp-admin/*` et `/wp-login.php` ne remontent plus dans les stats Top-Pages
- **BotDetector WP** : double filtre URL avant et après bootstrap WP pour garantir l'exclusion des URLs internes dans tous les contextes serveur

---

## [1.1.0] — 2026-04-04

### Added
- **Analyse IA (Nova)** — Page d'analyse SEO structurée propulsée par Gemini 3 Flash Preview : score global, problèmes détectés, recommandations actionnables, highlights clés (composants `ScoreGauge`, `ProblemCard`, `RecommendationCard`, `HighlightBadge`, `AnalysisSection`)
- **Nova chat bubble** — Chatbot assistant flottant accessible sur toutes les pages, avec streaming SSE, contexte de page dynamique (envoyé uniquement lors d'un message utilisateur), badge de messages non lus et avatar Nova
- **Contexte de page** — Chaque vue (Dashboard, HTTP Codes, Anomalies, TTFB, Network, Top Pages) injecte automatiquement un résumé compact au chatbot lors d'une question
- **Gestion base de données** — Section dans les Paramètres : stats en temps réel (taille, lignes par table, plage de dates), politique de rétention configurable (7/30/90/180/365 jours ou illimité) avec avertissement, purge manuelle + VACUUM avec feedback inline
- **Tri sur toutes les colonnes** — Tables triables sur toutes les vues avec micro-animations sur les en-têtes de colonnes
- **Filtre User-Agent** — Sélecteur UA sur la vue HTTP Codes, synchronisé avec les KPIs, graphiques et tableau de drill-down
- **Changement de nom d'utilisateur** — Depuis les Paramètres, en plus du changement de mot de passe
- **Logo SVG** — Logo Spider-Lens affiché sur la page de connexion

### Improved
- **UI polish — micro-interactions** — Hover harmonisés sur toutes les vues : KPI cards (border + shadow), table rows (opacité unifiée), anomaly cards (border dynamique critique/normal), filter toggles (background au hover), tab switchers, boutons cancel
- **btn-red / btn-blue** — Effet `brightness(1.1)` au hover en plus du shadow existant
- **Toggle switch** — Border visible + `hover:opacity-80`
- **Select rétention** — `hover:border-prussian-300 + cursor-pointer` sur les selects natifs
- **Scroll résistant** — Le changement de filtre UA ne réinitialise plus le scroll de la page
- **Settings layout** — Grille 2 colonnes sur desktop (`lg:grid-cols-2`)

### Fixed
- **Anomalies — traductions filtres** — Les labels des sélecteurs de type (Traffic spike, Error rate...) n'étaient pas traduits : mapping snake_case → clés i18n camelCase ajouté dans `TYPE_CONFIG`
- **UA filter drill-down** — Filtre UA utilise maintenant un `exact match` et corrige la sous-requête `top_ua`

---

## [1.0.0] — 2026-04-03

### Added
- **Full i18n support** — 6 languages: French, English, Spanish, German, Italian, Dutch
- **Language switcher** — `LanguageSwitcher` component in the header with flags, persisted via `localStorage`
- **WordPress plugin** — Native WP admin integration (IIFE build, React externalized via `wp-element`)
- **Official logo** — Replaced placeholder with Spider-Lens logo in sidebar and WP admin icon
- **GDM-Pixel signature** — Displayed at the bottom of the sidebar (desktop view)
- **ErrorBoundary** — Catches silent React crashes in development

### Fixed
- **View navigation** — Fixed a deadlock between `AnimatePresence (framer-motion)` and `Suspense` that prevented content from loading on route changes without a forced reload
- **Login redirect loop** — The axios interceptor now dispatches a `spider:unauthorized` event instead of a hard `window.location.href` redirect, eliminating the `/login` ↔ `/dashboard` loop
- **WP plugin — PHP fatal errors** — Fixed reserved keyword `NAMESPACE` → `API_NAMESPACE`, removed PHP 7.4 incompatible typed properties, replaced spread operator in `$wpdb->prepare()`
- **WP plugin — Missing build** — Build detection now reads the Vite manifest instead of looking for a hardcoded `index.js`
- **WP plugin — Backend tracking** — Collector no longer records WordPress admin page visits
- **Version badge** — Header version updated from `v0.3` to `v1.0.0`

### Improved
- **Route transitions** — Removed `AnimatePresence` in favor of plain `Suspense` for reliable navigation
- **Authentication** — JWT token is now cleanly removed from `localStorage` on 401 before navigation

---

## [0.7.0] — 2026-03-XX

### Added
- Dashboard, HTTP Codes, Top Pages, Bots & Crawlers, TTFB, Network, Anomalies, Blocklist, Settings
- Incremental Apache/Nginx log parsing with log rotation detection
- CSV & Excel export on HTTP Codes and Top Pages views
- Email alerts (404 spikes, 5xx errors, missing Googlebot) via configurable SMTP
- Beginner mode with help banners and contextual tooltips
- JWT authentication (7-day token), password change from settings
- Detection of 16+ bots (Googlebot, AhrefsBot, SemrushBot, ClaudeBot...)
- Multi-site support
- 27 Jest tests (parsing, auth, stats API)
