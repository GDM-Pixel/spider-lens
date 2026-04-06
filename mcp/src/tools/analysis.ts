import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiFetch, resolveSiteIdOrThrow } from '../client.js'

interface Problem {
  id: string
  title: string
  detail: string
  impact: 'critique' | 'warning' | 'info'
}

interface Recommendation {
  id: string
  title: string
  action: string
  why: string
}

interface Highlight {
  key: string
  value: string
  trend: 'up' | 'down' | 'neutral'
}

interface SeoAnalysis {
  score: number
  scoreLabel: string
  scoreColor: string
  summary: string
  problems: Problem[]
  recommendations: Recommendation[]
  highlights: Highlight[]
}

export function registerRunSeoAnalysis(server: McpServer) {
  server.registerTool(
    'run_seo_analysis',
    {
      title: 'Run SEO Analysis',
      description:
        'Run a full AI-powered SEO health analysis for a Spider-Lens site. Returns a score (0-100), detected problems with severity, and prioritized recommendations. Powered by Google Gemini. Results are cached for 5 minutes.',
      inputSchema: z.object({
        site_name: z.string().describe('Site name (required, partial match accepted)'),
        language: z.string().optional().describe('Language for the report (e.g. "fr", "en", "es"). Default: "en"'),
      }),
    },
    async ({ site_name, language = 'en' }) => {
      const siteId = await resolveSiteIdOrThrow(site_name)

      const data = await apiFetch<SeoAnalysis>('/api/assistant/analyze-structured', {
        method: 'POST',
        body: { siteId, language },
      })

      const scoreEmoji = data.score >= 80 ? '🟢' : data.score >= 60 ? '🟡' : data.score >= 40 ? '🟠' : '🔴'
      const impactEmoji = (impact: string) => impact === 'critique' ? '🔴' : impact === 'warning' ? '🟡' : 'ℹ️'

      const lines = [
        `## SEO Analysis — ${site_name}`,
        '',
        `${scoreEmoji} **Score: ${data.score}/100 — ${data.scoreLabel}**`,
        '',
        `> ${data.summary}`,
        '',
      ]

      if (data.highlights?.length > 0) {
        lines.push('### Key Metrics', '')
        data.highlights.forEach(h => {
          const arrow = h.trend === 'up' ? '↑' : h.trend === 'down' ? '↓' : '→'
          lines.push(`- **${h.key}**: ${h.value} ${arrow}`)
        })
        lines.push('')
      }

      if (data.problems?.length > 0) {
        lines.push(`### Problems (${data.problems.length})`, '')
        data.problems.forEach(p => {
          lines.push(`${impactEmoji(p.impact)} **${p.title}** *(${p.impact})*`)
          lines.push(`  ${p.detail}`)
          lines.push('')
        })
      }

      if (data.recommendations?.length > 0) {
        lines.push(`### Recommendations (${data.recommendations.length})`, '')
        data.recommendations.forEach((r, i) => {
          lines.push(`**${i + 1}. ${r.title}**`)
          lines.push(`  → ${r.action}`)
          lines.push(`  *Why: ${r.why}*`)
          lines.push('')
        })
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    }
  )
}
