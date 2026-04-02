# 🕷️ Spider-Lens
### Analyseur de logs serveur orienté SEO — Specs V0.1
> *Démocratiser l'analyse de logs pour tous les niveaux, du débutant à l'expert SEO.*

---

## 1. Vision du projet

Spider-Lens est un dashboard web open source, déployable en quelques minutes sur un serveur dédié, permettant d'analyser les logs Apache et Nginx avec une orientation SEO forte. L'objectif est de rendre accessible à tous (agences, freelances, débutants) une information aujourd'hui réservée aux experts techniques.

---

## 2. Compatibilité

| Serveur | Formats supportés |
|---|---|
| **Apache** | access.log (Combined Log Format) |
| **Nginx** | access.log (format par défaut + combined) |

Parsing automatique du format détecté. Support des logs compressés (.gz) prévu en V2.

---

## 3. Stack technique recommandée

- **Backend** : Node.js (Express) ou Python (FastAPI) — à trancher
- **Frontend** : React + Vite (cohérent avec Nova-Mind)
- **Base de données** : SQLite (légère, zéro config) ou PostgreSQL pour volumes importants
- **Graphiques** : Recharts ou Chart.js
- **Alertes email** : Nodemailer (SMTP) ou Resend API
- **Déploiement** : Script bash d'install automatisé + Docker en option

---

## 4. Installation (objectif plug & play)

```bash
curl -sSL https://install.spider-lens.io | bash
```

Le script doit :
1. Détecter Apache ou Nginx automatiquement
2. Configurer le path des logs
3. Installer les dépendances
4. Lancer le dashboard sur le port choisi (défaut : 3000)
5. Optionnel : générer un reverse proxy Nginx pour accès via sous-domaine

Temps cible d'installation : **< 5 minutes**.

---

## 5. Monitoring — Données trackées

### 5.1 Codes HTTP
- **2xx** : Succès (200, 201...)
- **3xx** : Redirections (301 permanent, 302 temporaire)
- **4xx** : Erreurs client (404 Not Found, 403 Forbidden, 410 Gone...)
- **5xx** : Erreurs serveur (500, 502, 503...)

Vue par URL, par date, par user-agent.

### 5.2 Bots & Crawlers
Identification automatique des principaux bots :
- Googlebot / Googlebot-Image / Googlebot-Mobile
- Bingbot
- AhrefsBot, Semrushbot, Majestic (bots SEO tiers)
- ChatGPT-User, ClaudeBot (bots IA)
- Bots inconnus / suspects

Dashboard dédié bots : fréquence de passage, pages crawlées, codes HTTP rencontrés, budget de crawl estimé.

### 5.3 TTFB (Time To First Byte)
- Temps de réponse par URL
- Identification des pages lentes (seuil configurable, défaut : > 1s)
- Évolution temporelle (graphe)

### 5.4 Top pages
- Pages les plus visitées (humains vs bots)
- Pages en 404 les plus touchées
- Pages avec redirections en chaîne (301 → 301 → 200)
- Pages jamais crawlées par Google

---

## 6. Features

### 6.1 Alertes email
| Déclencheur | Comportement |
|---|---|
| Nouvelle URL en 404 détectée | Email immédiat (ou digest quotidien) |
| Spike de 404 (> seuil) | Alerte critique |
| Site KO (5xx massifs) | Alerte immédiate |
| TTFB dégradé sur page clé | Alerte configurable |
| Googlebot absent depuis N jours | Alerte crawl |

Configuration SMTP simple dans l'interface (ou fichier .env).

### 6.2 Dashboard & Graphiques
- **Vue globale** : KPIs principaux (nb requêtes, % erreurs, bots vs humains)
- **Graphe codes HTTP** : évolution dans le temps (line chart + bar chart)
- **Heatmap** : activité par heure / jour de la semaine
- **Top 10 URLs** : en 404, en 301, les plus lentes
- **Camembert bots** : répartition des crawlers
- **Budget de crawl** : ratio pages crawlées / total, tendance Googlebot

### 6.3 Bulles d'explication (mode débutant)
Chaque métrique dispose d'un bouton ℹ️ avec :
- Explication simple en français (et anglais)
- Impact SEO concret
- Conseil actionnable

Exemples :
> *"Un code 404 signifie que cette page n'existe plus. Si Googlebot la crawle souvent, c'est du budget de crawl gaspillé. → Créez une redirection 301 vers la page la plus pertinente."*

> *"Le TTFB est le temps que met votre serveur à répondre. Au-delà de 800ms, Google peut pénaliser votre référencement."*

Mode débutant / expert toggleable dans l'interface.

### 6.4 Intégration Google Search Console *(V2)*
**Pourquoi ?** Croiser les données logs (ce que le serveur voit) avec GSC (ce que Google indexe) est extrêmement puissant.

**Ce que ça apporte :**
- Identifier les URLs crawlées mais non indexées
- Détecter les pages avec impressions GSC mais 404 en logs (désindexation imminente)
- Comparer le budget de crawl réel vs les pages avec clics
- Alerter si une page avec trafic GSC tombe en 404 ou 500

**Comment techniquement :**
- OAuth2 avec l'API Google Search Console (Search Analytics API)
- L'utilisateur connecte son compte Google une fois via l'interface
- Spider-Lens récupère les données de clics/impressions et les croise avec les logs
- Aucune donnée stockée côté Google, tout reste sur le serveur de l'utilisateur

---

## 7. Sécurité
- Authentification basique (login/password) pour accéder au dashboard
- HTTPS recommandé (instructions Let's Encrypt fournies)
- Aucune donnée envoyée vers l'extérieur (100% self-hosted)

---

## 8. Roadmap

| Version | Contenu |
|---|---|
| **V0.1 MVP** | Parsing logs, dashboard codes HTTP, top 404, alertes email, graphs de base |
| **V0.2** | Identification bots, budget de crawl, mode débutant (bulles) |
| **V0.3** | TTFB, heatmap, redirections en chaîne |
| **V1.0** | Intégration GSC, Docker, doc complète, release publique open source |
| **V2.0** | Multi-sites, SaaS optionnel, plugin WordPress |

---

## 9. Stratégie marketing — Autorité domaine GDM-Pixel

L'open source est une machine à backlinks si bien exécuté. Voici le plan :

### 9.1 Ancrage sur gdm-pixel.com
- Landing page dédiée sur **gdm-pixel.com/spider-lens** (pas un sous-domaine séparé)
- Le repo GitHub pointe vers cette page comme "homepage officielle"
- Tous les articles/tutos renvoient vers cette landing page

### 9.2 Distribution & backlinks naturels
- **GitHub** : README soigné, badges, démo GIF → les gens linkent le repo ET la landing page
- **Product Hunt** : launch au moment de la V1.0 (catégorie SEO Tools / Developer Tools)
- **Hacker News** : post "Show HN" au lancement
- **Reddit** : r/SEO, r/webdev, r/selfhosted — partage authentique, pas de spam
- **Directories** : Awesome SEO Tools (GitHub), ToolsForSEO, AlternativeTo, Indie Hackers

### 9.3 Content marketing SEO
Articles à écrire sur gdm-pixel.com :
- *"Comment analyser ses logs serveur pour le SEO (guide complet)"*
- *"Budget de crawl Googlebot : comment l'optimiser avec ses logs"*
- *"404 et robots : comment perdre du référencement sans le savoir"*
- *"Spider-Lens : l'outil open source pour analyser ses logs Apache/Nginx"*

Ces articles ciblent des requêtes longue traîne + linkent naturellement vers l'outil.

### 9.4 Partenariats & mentions
- Contacter des blogueurs SEO francophones pour des reviews
- Proposer à des newsletters SEO (SEO Frog, Abondance...) de mentionner l'outil
- Traduire le README en anglais dès V1.0 pour toucher la communauté internationale

### 9.5 Différenciation
- 100% self-hosted = argument fort pour les agences soucieuses de la confidentialité clients
- Interface en français en premier (gap réel sur ce marché)
- Mode débutant = accessible aux clients finaux, pas seulement aux SEOs

---

## 10. Décisions techniques arrêtées

| Sujet | Décision |
|---|---|
| **Backend** | Node.js (Express) |
| **Base de données** | PostgreSQL |
| **Landing page** | gdm-pixel.com/spider-lens |
| **Licence** | MIT |
| **Parsing** | Batch (cron horaire) — à revoir en V2 |
