import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiFetch, resolveSiteId, defaultRange, getSites } from '../client.js'

interface BotRow {
  name: string
  hits: number
  is_bot: number
}

export function registerGetBotStats(server: McpServer) {
  server.registerTool(
    'get_bot_stats',
    {
      title: 'Get Bot Stats',
      description:
        'Get crawl bot statistics for a Spider-Lens site: Googlebot, AhrefsBot, SemrushBot, and all other detected bots. Useful to check if Googlebot is actively crawling the site.',
      inputSchema: z.object({
        site_name: z.string().optional().describe('Site name (partial match). Leave empty for all sites.'),
        from: z.string().optional().describe('Start date YYYY-MM-DD (default: 30 days ago)'),
        to: z.string().optional().describe('End date YYYY-MM-DD (default: today)'),
      }),
    },
    async ({ site_name, from, to }) => {
      const range = defaultRange(from, to)
      let siteId: number | undefined

      if (site_name) {
        siteId = await resolveSiteId(site_name)
        if (!siteId) {
          const sites = await getSites()
          return {
            content: [{
              type: 'text' as const,
              text: `Site "${site_name}" not found. Available: ${sites.map(s => s.name).join(', ')}`,
            }],
          }
        }
      }

      const data = await apiFetch<BotRow[]>('/api/stats/bots', {
        params: { ...range, siteId },
      })

      const bots = data.filter(r => r.is_bot === 1).sort((a, b) => b.hits - a.hits)
      const totalBotHits = bots.reduce((s, r) => s + r.hits, 0)
      const googlebot = bots.find(r => r.name === 'Googlebot')

      const lines = [
        `## Bot Statistics — ${site_name || 'All sites'} (${range.from} → ${range.to})`,
        '',
        `**Total bot hits**: ${totalBotHits.toLocaleString()}`,
        `**Googlebot**: ${googlebot ? `${googlebot.hits.toLocaleString()} hits` : '⚠️ Not detected in this period'}`,
        '',
        `| Bot | Hits |`,
        `|-----|------|`,
        ...bots.slice(0, 15).map(r => `| ${r.name} | ${r.hits.toLocaleString()} |`),
      ]

      if (!googlebot) {
        lines.push('', '⚠️ **Googlebot absent** — If this persists over several days, check your robots.txt, sitemap, and server accessibility.')
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    }
  )
}
