import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiFetch, resolveSiteId, defaultRange, getSites } from '../client.js'

interface Error404 {
  url: string
  hits: number
  bot_hits: number
  last_seen: string
}

export function registerGet404Errors(server: McpServer) {
  server.registerTool(
    'get_404_errors',
    {
      title: 'Get 404 Errors',
      description:
        'Get the top 404 error URLs for a Spider-Lens site. Shows which pages return "not found", how many times, and how many hits come from bots. Useful for finding broken links to fix or redirect.',
      inputSchema: z.object({
        site_name: z.string().optional().describe('Site name (partial match). Leave empty for all sites.'),
        from: z.string().optional().describe('Start date YYYY-MM-DD (default: 30 days ago)'),
        to: z.string().optional().describe('End date YYYY-MM-DD (default: today)'),
        limit: z.number().optional().describe('Max number of URLs to return (default: 20)'),
      }),
    },
    async ({ site_name, from, to, limit = 20 }) => {
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

      const data = await apiFetch<Error404[]>('/api/stats/top-404', {
        params: { ...range, siteId, limit },
      })

      if (data.length === 0) {
        return { content: [{ type: 'text' as const, text: `No 404 errors found for ${site_name || 'all sites'} in this period. 🎉` }] }
      }

      const lines = [
        `## Top 404 Errors — ${site_name || 'All sites'} (${range.from} → ${range.to})`,
        '',
        `| # | URL | Total hits | Bot hits | Last seen |`,
        `|---|-----|-----------|----------|-----------|`,
        ...data.map((r, i) => {
          const humanHits = r.hits - (r.bot_hits || 0)
          return `| ${i + 1} | \`${r.url}\` | ${r.hits} | ${r.bot_hits || 0} | ${r.last_seen?.slice(0, 10) || '—'} |`
        }),
        '',
        `**${data.length} URLs listed.** Human hits = total - bot hits.`,
        `Tip: URLs with many human hits and no legitimate page → add a 301 redirect.`,
      ]

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    }
  )
}
