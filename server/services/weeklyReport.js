import nodemailer from 'nodemailer'
import geoip from 'geoip-lite'
import { getDb } from '../db/database.js'
import { sendWebhook } from './webhook.js'

// ── Helpers ───────────────────────────────────────────────

function getAlertConfig() {
  return getDb().prepare('SELECT * FROM alert_config WHERE id = 1').get()
}

function fmt(n) {
  return (n ?? 0).toLocaleString('fr-FR')
}

function pct(value, total) {
  if (!total) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

function trend(current, previous) {
  if (!previous) return null
  const delta = ((current - previous) / previous) * 100
  if (Math.abs(delta) < 1) return null
  return { delta: Math.round(delta), up: delta > 0 }
}

function trendStr(current, previous) {
  const t = trend(current, previous)
  if (!t) return ''
  return t.up ? ` (+${t.delta}%)` : ` (${t.delta}%)`
}

// ── Collecte des données ──────────────────────────────────

function collectWeekData(siteId, weekStart, weekEnd) {
  const db = getDb()
  const sc = siteId != null ? 'AND site_id = ?' : ''
  const sp = siteId != null ? [siteId] : []

  const overview = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS humans,
      SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bots,
      SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS s2xx,
      SUM(CASE WHEN status_code BETWEEN 400 AND 499 THEN 1 ELSE 0 END) AS s4xx,
      SUM(CASE WHEN status_code BETWEEN 500 AND 599 THEN 1 ELSE 0 END) AS s5xx,
      AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END) AS avg_ttfb
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? ${sc}
  `).get(weekStart, weekEnd, ...sp)

  const top5pages = db.prepare(`
    SELECT url, COUNT(*) AS hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND is_bot = 0 AND status_code = 200 ${sc}
    GROUP BY url ORDER BY hits DESC LIMIT 5
  `).all(weekStart, weekEnd, ...sp)

  const top3_404 = db.prepare(`
    SELECT url, COUNT(*) AS hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND status_code = 404 ${sc}
    GROUP BY url ORDER BY hits DESC LIMIT 3
  `).all(weekStart, weekEnd, ...sp)

  const topBots = db.prepare(`
    SELECT bot_name, COUNT(*) AS hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? AND is_bot = 1 AND bot_name IS NOT NULL ${sc}
    GROUP BY bot_name ORDER BY hits DESC LIMIT 5
  `).all(weekStart, weekEnd, ...sp)

  const anomalyCount = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical
    FROM anomalies
    WHERE detected_at BETWEEN ? AND ? ${siteId != null ? 'AND site_id = ?' : ''}
  `).get(weekStart, weekEnd, ...(siteId != null ? [siteId] : []))

  // Top pays via geoip-lite (agrégation JS sur top 2000 IPs)
  const topIps = db.prepare(`
    SELECT ip, COUNT(*) AS hits
    FROM log_entries
    WHERE timestamp BETWEEN ? AND ? ${sc}
    GROUP BY ip ORDER BY hits DESC LIMIT 2000
  `).all(weekStart, weekEnd, ...sp)

  const countryCounts = {}
  for (const row of topIps) {
    if (!row.ip) continue
    const geo = geoip.lookup(row.ip)
    const code = geo?.country || 'XX'
    countryCounts[code] = (countryCounts[code] || 0) + row.hits
  }
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, hits]) => ({ code, hits }))

  return { overview, top5pages, top3_404, topBots, anomalyCount, topCountries }
}

// ── Rendu HTML ────────────────────────────────────────────

function buildHtmlReport(siteName, weekLabel, current, previous) {
  const o = current.overview
  const p = previous?.overview

  const errorRate = o.total > 0 ? Math.round(((o.s4xx + o.s5xx) / o.total) * 100) : 0

  const kpiBlock = (label, value, sub) => `
    <td style="text-align:center;padding:12px 16px;">
      <div style="font-size:22px;font-weight:800;color:#ffffff;">${value}</div>
      <div style="font-size:11px;color:#898989;margin-top:2px;">${label}</div>
      ${sub ? `<div style="font-size:11px;color:#00c6e0;margin-top:1px;">${sub}</div>` : ''}
    </td>`

  const tableRow = (label, hits, total) => `
    <tr>
      <td style="padding:6px 0;font-size:12px;color:#d1d1d1;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</td>
      <td style="padding:6px 0;font-size:12px;color:#ffffff;font-weight:700;text-align:right;">${fmt(hits)}</td>
      ${total ? `<td style="padding:6px 0;font-size:12px;color:#898989;text-align:right;padding-left:8px;">${pct(hits, total)}</td>` : ''}
    </tr>`

  const anomalySection = current.anomalyCount?.total > 0
    ? `<p style="margin:0;font-size:13px;color:#d1d1d1;">
        ${current.anomalyCount.total} anomalie(s) détectée(s) dont
        <strong style="color:${current.anomalyCount.critical > 0 ? '#d62246' : '#f59e0b'};">
          ${current.anomalyCount.critical} critique(s)
        </strong>.
       </p>`
    : `<p style="margin:0;font-size:13px;color:#10b981;">✓ Aucune anomalie détectée cette semaine.</p>`

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#171c27;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#171c27;padding:32px 16px;">
    <tr><td>
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#1e2533;border-radius:16px 16px 0 0;padding:28px 32px;border-bottom:1px solid #273043;">
            <table width="100%"><tr>
              <td>
                <div style="font-size:20px;font-weight:800;color:#ffffff;">🕷️ Spider-Lens</div>
                <div style="font-size:13px;color:#00c6e0;margin-top:2px;">Rapport hebdomadaire</div>
              </td>
              <td style="text-align:right;">
                <div style="font-size:12px;color:#898989;">${siteName}</div>
                <div style="font-size:12px;color:#898989;margin-top:2px;">${weekLabel}</div>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- KPIs -->
        <tr>
          <td style="background:#1e2533;padding:24px 32px 16px;">
            <div style="font-size:13px;font-weight:700;color:#898989;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">Trafic de la semaine</div>
            <table width="100%" style="background:#262e40;border-radius:12px;">
              <tr>
                ${kpiBlock('Requêtes totales', fmt(o.total), trendStr(o.total, p?.total) || null)}
                ${kpiBlock('Visiteurs humains', fmt(o.humans), trendStr(o.humans, p?.humans) || null)}
                ${kpiBlock('Bots', fmt(o.bots), trendStr(o.bots, p?.bots) || null)}
                ${kpiBlock('Taux erreurs', errorRate + '%', null)}
              </tr>
            </table>
          </td>
        </tr>

        <!-- TTFB -->
        ${o.avg_ttfb != null ? `
        <tr>
          <td style="background:#1e2533;padding:4px 32px 16px;">
            <div style="background:#262e40;border-radius:12px;padding:12px 16px;display:inline-block;">
              <span style="font-size:12px;color:#898989;">TTFB moyen : </span>
              <span style="font-size:14px;font-weight:700;color:${o.avg_ttfb > 800 ? '#d62246' : o.avg_ttfb > 200 ? '#f59e0b' : '#10b981'};">
                ${Math.round(o.avg_ttfb)} ms
              </span>
            </div>
          </td>
        </tr>` : ''}

        <!-- Top pages -->
        ${current.top5pages.length > 0 ? `
        <tr>
          <td style="background:#1e2533;padding:8px 32px 16px;">
            <div style="font-size:13px;font-weight:700;color:#898989;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Top 5 pages visitées</div>
            <table width="100%">
              ${current.top5pages.map(r => tableRow(r.url, r.hits, o.humans)).join('')}
            </table>
          </td>
        </tr>` : ''}

        <!-- Top 404 -->
        ${current.top3_404.length > 0 ? `
        <tr>
          <td style="background:#1e2533;padding:8px 32px 16px;">
            <div style="font-size:13px;font-weight:700;color:#898989;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Top 3 erreurs 404</div>
            <table width="100%">
              ${current.top3_404.map(r => tableRow(r.url, r.hits, null)).join('')}
            </table>
          </td>
        </tr>` : ''}

        <!-- Bots -->
        ${current.topBots.length > 0 ? `
        <tr>
          <td style="background:#1e2533;padding:8px 32px 16px;">
            <div style="font-size:13px;font-weight:700;color:#898989;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Bots détectés</div>
            <table width="100%">
              ${current.topBots.map(r => tableRow(r.bot_name, r.hits, o.bots)).join('')}
            </table>
          </td>
        </tr>` : ''}

        <!-- Top pays -->
        ${current.topCountries?.length > 0 ? `
        <tr>
          <td style="background:#1e2533;padding:8px 32px 16px;">
            <div style="font-size:13px;font-weight:700;color:#898989;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Top pays visiteurs</div>
            <table width="100%">
              ${current.topCountries.map(r => {
                const flagOffset = r.code.split('').reduce((acc, c) => acc + String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)), '')
                return tableRow(`${flagOffset} ${r.code}`, r.hits, null)
              }).join('')}
            </table>
          </td>
        </tr>` : ''}

        <!-- Anomalies -->
        <tr>
          <td style="background:#1e2533;padding:8px 32px 24px;">
            <div style="font-size:13px;font-weight:700;color:#898989;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Anomalies détectées</div>
            <div style="background:#262e40;border-radius:10px;padding:12px 16px;">
              ${anomalySection}
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#171c27;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
            <div style="font-size:11px;color:#898989;">
              Spider-Lens v0.7.0 — Rapport généré automatiquement chaque lundi matin
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Webhook Discord ────────────────────────────────────────

function buildWeeklyWebhookPayload(siteName, weekLabel, current, previous) {
  const o = current.overview
  const p = previous?.overview
  const errorRate = o.total > 0 ? Math.round(((o.s4xx + o.s5xx) / o.total) * 100) : 0

  const trendEmoji = (curr, prev) => {
    const t = trend(curr, prev)
    if (!t) return ''
    return t.up ? ` ↑${t.delta}%` : ` ↓${Math.abs(t.delta)}%`
  }

  const anomalyText = current.anomalyCount?.total > 0
    ? `⚠️ ${current.anomalyCount.total} anomalie(s) dont ${current.anomalyCount.critical} critique(s)`
    : '✅ Aucune anomalie'

  const top5 = current.top5pages.slice(0, 3).map((r, i) => `${i + 1}. \`${r.url}\` — ${fmt(r.hits)} hits`).join('\n') || 'Aucune donnée'

  return {
    embeds: [{
      title: `📊 Rapport hebdomadaire — ${siteName}`,
      color: 0x00c6e0,
      description: `**${weekLabel}**`,
      fields: [
        {
          name: '📈 Trafic',
          value: [
            `Requêtes : **${fmt(o.total)}**${trendEmoji(o.total, p?.total)}`,
            `Humains : **${fmt(o.humans)}**${trendEmoji(o.humans, p?.humans)}`,
            `Bots : **${fmt(o.bots)}**${trendEmoji(o.bots, p?.bots)}`,
            `Taux erreurs : **${errorRate}%**`,
            o.avg_ttfb != null ? `TTFB moyen : **${Math.round(o.avg_ttfb)} ms**` : '',
          ].filter(Boolean).join('\n'),
          inline: false,
        },
        {
          name: '🔝 Top pages (humains)',
          value: top5,
          inline: false,
        },
        {
          name: '🔍 Anomalies',
          value: anomalyText,
          inline: false,
        },
        ...(current.topCountries?.length > 0 ? [{
          name: '🌍 Top pays',
          value: current.topCountries.map(r => {
            const flag = r.code.split('').reduce((acc, c) => acc + String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)), '')
            return `${flag} ${r.code} — ${fmt(r.hits)}`
          }).join('\n'),
          inline: false,
        }] : []),
      ],
      footer: { text: 'Spider-Lens — Rapport hebdomadaire automatique' },
      timestamp: new Date().toISOString(),
    }],
  }
}

// ── Envoi du rapport ──────────────────────────────────────

async function sendReportForSite(siteId, siteName, config) {
  const now = new Date()
  // Semaine courante : lundi 00:00 → dimanche 23:59
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // 0=lundi
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  // Semaine précédente
  const prevMonday = new Date(monday)
  prevMonday.setDate(monday.getDate() - 7)
  const prevSunday = new Date(monday)
  prevSunday.setDate(monday.getDate() - 1)
  prevSunday.setHours(23, 59, 59, 999)

  const weekStart = monday.toISOString().replace('T', ' ').slice(0, 19)
  const weekEnd   = sunday.toISOString().replace('T', ' ').slice(0, 19)
  const prevStart = prevMonday.toISOString().replace('T', ' ').slice(0, 19)
  const prevEnd   = prevSunday.toISOString().replace('T', ' ').slice(0, 19)

  const weekLabel = `${monday.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })} – ${sunday.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`

  const current  = collectWeekData(siteId, weekStart, weekEnd)
  const previous = collectWeekData(siteId, prevStart, prevEnd)

  const displayName = siteName || config?.site_name || 'Spider-Lens'

  // Email
  if (config?.smtp_host && config?.alert_email) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port || 587,
        secure: config.smtp_secure === 1,
        auth: config.smtp_user ? { user: config.smtp_user, pass: config.smtp_pass } : undefined,
      })
      await transporter.sendMail({
        from: `"Spider-Lens" <${config.smtp_user || 'noreply@spider-lens.io'}>`,
        to: config.alert_email,
        subject: `[Spider-Lens] Rapport hebdomadaire — ${displayName} — ${weekLabel}`,
        html: buildHtmlReport(displayName, weekLabel, current, previous),
      })
      console.log(`[weekly] Rapport email envoyé pour ${displayName}`)
    } catch (err) {
      console.error(`[weekly] Erreur email ${displayName}:`, err.message)
    }
  }

  // Webhook
  if (config?.webhook_enabled && config?.webhook_url) {
    try {
      const payload = buildWeeklyWebhookPayload(displayName, weekLabel, current, previous)
      await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      console.log(`[weekly] Rapport webhook envoyé pour ${displayName}`)
    } catch (err) {
      console.error(`[weekly] Erreur webhook ${displayName}:`, err.message)
    }
  }
}

// ── Point d'entrée public ─────────────────────────────────

export async function sendWeeklyReports() {
  const config = getAlertConfig()
  if (!config?.weekly_report_enabled) return

  const db = getDb()
  const sites = db.prepare('SELECT id, name FROM sites WHERE active = 1').all()

  if (sites.length === 0) {
    // Mode V0.1 sans sites en DB
    await sendReportForSite(null, config.site_name || 'Spider-Lens', config)
    return
  }

  for (const site of sites) {
    try {
      await sendReportForSite(site.id, site.name, config)
    } catch (e) {
      console.error(`[weekly] Erreur rapport ${site.name}:`, e.message)
    }
  }
}
