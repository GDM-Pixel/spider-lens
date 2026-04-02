import { getDb } from '../db/database.js'

// Couleurs Discord par sévérité (decimal)
const COLORS = {
  critical: 0xd62246, // dustyred
  warning:  0xf59e0b, // amber
}

const TYPE_LABELS = {
  traffic_spike:    '📈 Spike de trafic',
  error_rate_spike: '🚨 Taux d\'erreurs élevé',
  googlebot_absent: '🤖 Googlebot absent',
  unknown_bot_spike:'❓ Bots inconnus élevés',
}

function buildDiscordPayload(type, severity, siteName, fields) {
  return {
    embeds: [{
      title: `${severity === 'critical' ? '🔴' : '🟡'} ${TYPE_LABELS[type] || type}`,
      color: COLORS[severity] ?? COLORS.warning,
      fields: [
        { name: 'Site', value: siteName || 'Tous les sites', inline: true },
        { name: 'Sévérité', value: severity === 'critical' ? 'Critique' : 'Avertissement', inline: true },
        ...fields,
      ],
      footer: { text: 'Spider-Lens' },
      timestamp: new Date().toISOString(),
    }],
  }
}

function buildSlackPayload(type, severity, siteName, fields) {
  const emoji = severity === 'critical' ? ':red_circle:' : ':warning:'
  const label = TYPE_LABELS[type] || type
  const fieldText = fields.map(f => `*${f.name}* : ${f.value}`).join('\n')
  return {
    text: `${emoji} *[Spider-Lens] ${label}*`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `${emoji} *[Spider-Lens] ${label}*\nSite : *${siteName || 'Tous les sites'}*` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: fieldText },
      },
    ],
  }
}

function isDiscordUrl(url) {
  return url.includes('discord.com/api/webhooks') || url.includes('discordapp.com/api/webhooks')
}

export async function sendWebhook({ type, severity, siteName, observed, baselineMean, baselineStddev, metadata }) {
  const db = getDb()
  const config = db.prepare('SELECT webhook_url, webhook_enabled, webhook_on_warning FROM alert_config WHERE id = 1').get()

  if (!config?.webhook_enabled || !config?.webhook_url) return false
  if (severity === 'warning' && !config.webhook_on_warning) return false

  // Construit les champs selon le type d'anomalie
  const fields = []

  if (type === 'traffic_spike' && baselineMean != null) {
    fields.push({ name: 'Volume observé', value: `${Math.round(observed).toLocaleString()} req/h`, inline: true })
    fields.push({ name: 'Baseline habituelle', value: `${Math.round(baselineMean).toLocaleString()} ± ${Math.round(baselineStddev ?? 0).toLocaleString()} req/h`, inline: true })
  } else if (type === 'error_rate_spike' && baselineMean != null) {
    fields.push({ name: 'Taux 5xx observé', value: `${Math.round(observed * 100)}%`, inline: true })
    fields.push({ name: 'Baseline habituelle', value: `${Math.round(baselineMean * 100)}%`, inline: true })
    if (metadata?.errors5xx != null) {
      fields.push({ name: 'Détail', value: `${metadata.errors5xx} erreurs / ${metadata.total} requêtes`, inline: false })
    }
  } else if (type === 'googlebot_absent') {
    const meta = metadata || {}
    fields.push({ name: 'Absent depuis', value: `${meta.absentDays ?? '?'} jours`, inline: true })
    if (meta.lastSeen) fields.push({ name: 'Dernière visite', value: meta.lastSeen, inline: true })
  } else if (type === 'unknown_bot_spike') {
    fields.push({ name: 'Taux bots inconnus', value: `${Math.round(observed * 100)}%`, inline: true })
    if (baselineMean != null) {
      fields.push({ name: 'Baseline habituelle', value: `${Math.round(baselineMean * 100)}%`, inline: true })
    }
  }

  const url = config.webhook_url
  const payload = isDiscordUrl(url)
    ? buildDiscordPayload(type, severity, siteName, fields)
    : buildSlackPayload(type, severity, siteName, fields)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[webhook] Réponse HTTP ${res.status} :`, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[webhook] Erreur envoi :', err.message)
    return false
  }
}

export async function testWebhook(url) {
  if (!url) return { success: false, error: 'URL manquante' }

  const payload = isDiscordUrl(url)
    ? {
        embeds: [{
          title: '✅ Test Spider-Lens',
          color: 0x00c6e0,
          description: 'La connexion webhook fonctionne correctement.',
          footer: { text: 'Spider-Lens' },
          timestamp: new Date().toISOString(),
        }],
      }
    : {
        text: ':white_check_mark: *Test Spider-Lens* — La connexion webhook fonctionne correctement.',
      }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
