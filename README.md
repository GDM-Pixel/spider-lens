<div align="center">
  <img src="client/src/assets/spider-lens-logo.png" alt="Spider-Lens" width="180" />

  # Spider-Lens

  **SEO-focused server log analyzer — open-source, self-hosted**

  [![Version](https://img.shields.io/badge/version-1.2.0-blue)](#)
  [![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](#)
  [![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)
  [![i18n](https://img.shields.io/badge/i18n-16%20languages-orange)](#)
  [![WordPress](https://img.shields.io/badge/WordPress-plugin-blue?logo=wordpress)](#)

</div>

---

Spider-Lens reads your Apache/Nginx log files and gives you a comprehensive dashboard to monitor traffic, HTTP errors, crawl bots, and server performance (TTFB). Powered by **Nova** — an AI assistant built on Gemini that analyzes your SEO data, scores your site health, and answers questions in real time. Available as a standalone Node.js app **and** as a native WordPress plugin.

---

## 📸 Screenshots

<table>
  <tr>
    <td><img src="https://raw.githubusercontent.com/GDM-Pixel/Spider-lens/main/.github/screenshots/dashboard.png" alt="Dashboard" /></td>
    <td><img src="https://raw.githubusercontent.com/GDM-Pixel/Spider-lens/main/.github/screenshots/http-codes.png" alt="HTTP Codes" /></td>
  </tr>
  <tr>
    <td align="center"><b>Dashboard</b> — KPIs, charts, bot distribution</td>
    <td align="center"><b>HTTP Codes</b> — Daily evolution + filterable table</td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/GDM-Pixel/Spider-lens/main/.github/screenshots/bots.png" alt="Bots & Crawlers" /></td>
    <td><img src="https://raw.githubusercontent.com/GDM-Pixel/Spider-lens/main/.github/screenshots/load-time.png" alt="Load Time (TTFB)" /></td>
  </tr>
  <tr>
    <td align="center"><b>Bots & Crawlers</b> — Crawl budget visualization</td>
    <td align="center"><b>Load Time (TTFB)</b> — Per-URL performance breakdown</td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/GDM-Pixel/Spider-lens/main/.github/screenshots/network.png" alt="Network" /></td>
    <td><img src="https://raw.githubusercontent.com/GDM-Pixel/Spider-lens/main/.github/screenshots/ai-analysis.png" alt="AI Analysis" /></td>
  </tr>
  <tr>
    <td align="center"><b>Network</b> — IP addresses, countries, HTTP codes</td>
    <td align="center"><b>AI Analysis</b> — SEO score, problems, recommendations</td>
  </tr>
</table>

---

## ✨ Features

| View | Description |
|------|-------------|
| **Dashboard** | Summary KPIs: total requests, human visits, bots, error rate — HTTP evolution chart, bot distribution pie chart, 12-week trends |
| **HTTP Codes** | Full breakdown by status code (2xx/3xx/4xx/5xx) — filterable by code, user-agent, humans/bots — CSV & Excel export |
| **Top Pages** | Most visited pages (top 200) + 404 list with Googlebot exposure — sortable columns |
| **Bots & Crawlers** | Detection of 16+ bots (Googlebot, AhrefsBot, SemrushBot, ClaudeBot…) — crawl budget pie chart + volume bar chart |
| **Load Time (TTFB)** | Time To First Byte per URL — configurable slow threshold — fast/acceptable/slow breakdown — CSV & Excel export |
| **Network** | IP and user-agent analysis — countries, bot/human split, HTTP code badges, one-click block action |
| **Anomalies** | Automatic detection: traffic spikes, high error rates, missing Googlebot, unknown bot surges — email alerts on critical events |
| **Blocklist** | Block suspicious IPs directly from the interface — export nginx or Apache deny rules |
| **AI Analysis** | Nova-powered SEO audit: global health score, detected problems with severity, actionable recommendations |
| **Settings** | SMTP alerts, webhook notifications, retention policy, database management, password & username change |

### Additional highlights

- 🤖 **Nova AI assistant** — Floating chat bubble on every page. Nova receives the current page context automatically, enabling targeted answers without copy-pasting. SSE streaming, conversation history, animated Nova avatar. Powered by **Gemini 3 Flash Preview**.
- 🎯 **AI SEO Analysis** — One-click full audit: global health score (0–100), categorized problems (Critical / Warning / Info), priority recommendations. Animated Nova loader during generation. Cached per-site per-language.
- 🌍 **16 languages** — FR, EN, ES, DE, IT, NL, PT, JA, PL, SV, KO, TR, RU, CS, DA, UK — persisted via localStorage, auto-detected from browser.
- 🔒 **JWT authentication** — 7-day token, secure session
- 📧 **Email alerts** — 404 spikes, 5xx errors, missing Googlebot (configurable SMTP + optional webhook for Discord/Slack)
- 📊 **Incremental parsing** — Resume from offset, log rotation detection
- 🌱 **Beginner mode** — Contextual help banners and tooltips, dismissible
- 🌐 **Multi-site** — Monitor multiple sites from a single interface
- 🗄️ **Database management** — Real-time stats (size, rows, date range), configurable retention policy, manual purge + VACUUM
- 🎨 **Polished UI** — Framer Motion animations, custom dark tooltip on all Recharts charts, consistent micro-interactions, dark prussian theme
- 📋 **Weekly report** — Automated summary every Monday by email and/or webhook

---

## 🛠️ Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js 18+ · Express 4 · ES Modules |
| Database | SQLite via better-sqlite3 (WAL) |
| Auth | JWT + bcryptjs |
| Scheduled tasks | node-cron |
| Emails | Nodemailer (SMTP) |
| AI | Google Gemini 3 Flash Preview · SSE streaming |
| Frontend | React 18 · Vite 5 |
| Animations | Framer Motion |
| Charts | Recharts + custom dark tooltip |
| Icons | Phosphor Icons + custom FA Pro via @iconify/react |
| Styles | Tailwind CSS 3 |
| i18n | react-i18next · i18next-browser-languagedetector |
| Tests | Jest 29 · Supertest |
| WordPress | PHP 7.4+ · WP REST API · wp-element |

---

## 🚀 Installation — Node.js app

### Requirements

- Node.js ≥ 18
- npm ≥ 9
- Access to your Apache or Nginx log file

### 1. Clone the repository

```bash
git clone https://github.com/gdm-pixel/spider-lens.git
cd spider-lens
```

### 2. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 3. Configure environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=change-this-secret-in-production
ADMIN_USER=admin
ADMIN_PASS=change-this-password
LOG_FILE_PATH=/var/log/apache2/access.log
DB_PATH=./spider-lens.db
SITE_NAME=My Site

# Optional — required for Nova AI assistant and AI Analysis
GEMINI_API_KEY=your-gemini-api-key

# Optional — override the Gemini model (default: gemini-3-flash-preview)
# GEMINI_MODEL=gemini-3-flash-preview
```

> ⚠️ **Security**: Change `JWT_SECRET` and `ADMIN_PASS` before going live!

### 4. Build the frontend

```bash
cd client && npm run build
```

### 5. Start the server

```bash
cd server && npm start
```

The dashboard is available at `http://localhost:3000`.

---

## 🔄 Production deployment (Nginx + PM2)

### PM2

```bash
npm install -g pm2
cd server && pm2 start index.js --name spider-lens
pm2 save && pm2 startup
```

### Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name spider-lens.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name spider-lens.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/spider-lens.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spider-lens.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSL with Certbot

```bash
sudo certbot --nginx -d spider-lens.your-domain.com
```

### Security hardening (recommended)

**Trusted IPs for `X-Forwarded-For`** — If Spider-Lens is behind a reverse proxy:

```nginx
set_real_ip_from 127.0.0.1;
real_ip_header X-Real-IP;
```

**Restrict access by IP** — For internal use only:

```nginx
location / {
    allow 1.2.3.4;   # your IP
    deny all;
    proxy_pass http://127.0.0.1:3000;
}
```

---

## 🔌 Installation — WordPress plugin

The WordPress plugin integrates Spider-Lens directly into your WP admin, without needing Node.js on your server.

### 1. Download the plugin

Download `spider-lens.zip` from the [GitHub releases page](../../releases).

### 2. Install via WordPress admin

`Plugins → Add New → Upload Plugin → spider-lens.zip → Install Now → Activate`

### 3. Configure

Go to **Spider-Lens** in the admin menu. The database and settings are configurable directly from the interface.

> The plugin uses `wp-element` (React bundled with WordPress) — no external dependencies required.

---

## 🤖 Nova AI assistant

Nova is a floating chat assistant available on every page. She automatically receives the context of the current view (page name, active filters, key metrics) so you can ask targeted questions without copy-pasting data.

### Configuration

Add your Gemini API key to `server/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key
```

Without this key, the **AI Analysis** page and Nova chat display a friendly configuration prompt. The rest of the application works normally.

### How it works

- **AI Analysis page** — One-click full SEO audit. Nova analyzes your last 30 days of log data and returns a structured report: health score (0–100), categorized problems (Critical / Warning / Info), and priority recommendations. Results are cached per site and per language.
- **Chat bubble** — Ask any question in natural language: *"Why isn't Googlebot crawling /contact?"*, *"Which pages have the most 4xx errors?"*, *"Is my TTFB acceptable?"*. Nova streams the answer progressively via SSE.
- **Privacy** — Nova never sends raw log data to Google. Only a compact JSON summary (~500 tokens) is transmitted per request.
- **Language-aware** — Nova responds in the language selected in the UI.

---

## 📊 Supported log formats

Spider-Lens parses the **Apache/Nginx Combined Log Format**, with an optional `$request_time` field at the end for TTFB data.

### Basic format (no TTFB)

Works out of the box with the default Nginx or Apache `combined` log format:

```
127.0.0.1 - - [10/Oct/2023:13:55:36 +0000] "GET /page HTTP/1.1" 200 1234 "https://ref" "Mozilla/5.0"
```

### With TTFB (recommended)

Append `$request_time` (seconds, float) to the log line. Spider-Lens automatically converts it to milliseconds.

**Nginx** — add a custom `log_format` in `/etc/nginx/nginx.conf` (inside the `http {}` block):

```nginx
log_format spider_lens '$remote_addr - $remote_user [$time_local] '
                       '"$request" $status $body_bytes_sent '
                       '"$http_referer" "$http_user_agent" $request_time';
```

Then use it in each virtual host you want to monitor:

```nginx
access_log /var/log/nginx/your-site.access.log spider_lens;
```

**Apache** — enable `%D` (microseconds) or `%T` (seconds) in your `LogFormat`:

```apache
LogFormat "%h - %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-Agent}i\" %D" spider_lens
CustomLog /var/log/apache2/access.log spider_lens
```

> **Note:** Apache's `%D` is in **microseconds** — Spider-Lens handles both formats automatically.

### What gets parsed

| Field | Source |
|-------|--------|
| IP address | `$remote_addr` |
| Timestamp | `[$time_local]` |
| HTTP method | `"$request"` |
| URL | `"$request"` |
| Status code | `$status` |
| Response size | `$body_bytes_sent` |
| Referrer | `"$http_referer"` |
| User-Agent | `"$http_user_agent"` |
| TTFB (ms) | `$request_time` (optional) |

---

## ⚙️ Email & webhook alerts

Configure alerts from the **Settings** view:

| Field | Description |
|-------|-------------|
| SMTP host | e.g. `smtp.gmail.com` |
| Port | 587 (TLS) or 465 (SSL) |
| Destination email | Address that receives alerts |
| 404 threshold | Number of 404s/hour triggering an alert |
| 5xx threshold | Number of server errors/hour |
| Missing Googlebot | Days without a Googlebot visit |
| Webhook URL | Discord, Slack, or any HTTP POST JSON endpoint |
| Weekly report | Automated summary every Monday at 8am |

---

## 🧪 Tests

```bash
cd server && npm test
```

27 tests covering:
- Bot detection (Googlebot, AhrefsBot, SemrushBot, ClaudeBot…)
- Apache Combined and Nginx log parsing
- URL normalization
- Auth API (login, invalid token, missing fields)
- Stats routes (JWT protection, counter consistency)

---

## 💻 Local development

```bash
# Backend with hot-reload (port 3000)
cd server && npm run dev

# Frontend Vite (port 5173)
cd client && npm run dev
```

---

## 🗺️ Roadmap

### v1.2.0 ✅
- [x] 16-language i18n — PT, JA, PL, SV, KO, TR, RU, CS, DA, UK added
- [x] Nova AI assistant — conversational mode, language-aware responses
- [x] AI Analysis — Nova loader animation, fully i18n'd report titles and steps
- [x] Custom dark ChartTooltip with series-colored values on all Recharts charts
- [x] KPI cards redesign — icon + colored label side-by-side, value below
- [x] Font Awesome Pro custom icons (gauge-low, etc.)
- [x] Lightflux animated gradient border on Nova chat panel

### v1.1.0 ✅
- [x] Nova — floating AI assistant, page-aware context, SSE streaming
- [x] AI Analysis — global score, detected problems, actionable recommendations
- [x] Database management — stats, retention policy, manual purge + VACUUM
- [x] User-Agent filter on HTTP Codes view
- [x] Sortable columns on all tables
- [x] Username change from Settings
- [x] UI polish — harmonized micro-interactions across all views
- [x] i18n — all labels and filter buttons translated in all 6 languages

### v1.0.0 ✅
- [x] Dashboard, HTTP Codes, Top Pages, Bots, TTFB, Network, Anomalies, Blocklist
- [x] Native WordPress plugin
- [x] i18n: FR / EN / ES / DE / IT / NL
- [x] CSV & Excel export
- [x] Email alerts
- [x] Multi-site support
- [x] Beginner mode
- [x] Jest tests (27)

### v1.3.0 (planned)
- [ ] Advanced filters by IP and user-agent
- [ ] Webhook API for external integrations
- [ ] Customizable dashboard (widgets)

---

## 🤝 Contributing

Contributions are welcome! Open an issue or a pull request.

---

## 📄 License

MIT — [GDM-Pixel](https://www.gdm-pixel.com) · Caen, France

---

<div align="center">
  <sub>Made with ❤️ in Caen, Normandy</sub>
</div>
