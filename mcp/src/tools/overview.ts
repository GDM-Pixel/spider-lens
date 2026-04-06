import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiFetch, resolveSiteId, defaultRange, getSites } from '../client.js'

interface Overview {
  total: number
  humans: number
  bots: number
  s2xx: number
  s3xx: number
  s4xx: number
  s5xx: number
  unique404: number
  errorRate: string
}

export function registerGetSeoOverview(server: McpServer) {
  server.registerTool(
    'get_seo_overview',
    {
      title: 'Get SEO Overview',
      description:
        'Get traffic overview for a Spider-Lens site: total requests, human visits, bots, HTTP status breakdown (2xx/3xx/4xx/5xx), and error rate. Useful for a quick health check.',
      inputSchema: z.object({
        site_name: z.string().optional().describe('Site name (partial match). Leave empty for all sites combined.'),
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

      const data = await apiFetch<Overview>('/api/stats/overview', {
        params: { ...range, siteId },
      })

      const lines = [
        `## Traffic Overview — ${site_name || 'All sites'} (${range.from} → ${range.to})`,
        '',
        `**Total requests**: ${data.total.toLocaleString()}`,
        `**Human visits**: ${data.humans.toLocaleString()} (${Math.round((data.humans / data.total) * 100)}%)`,
        `**Bot requests**: ${data.bots.toLocaleString()} (${Math.round((data.bots / data.total) * 100)}%)`,
        '',
        `**2xx Success**: ${data.s2xx.toLocaleString()}`,
        `**3xx Redirects**: ${data.s3xx.toLocaleString()}`,
        `**4xx Client errors**: ${data.s4xx.toLocaleString()}`,
        `**5xx Server errors**: ${data.s5xx.toLocaleString()}`,
        `**Unique 404 URLs**: ${data.unique404}`,
        `**Error rate**: ${data.errorRate}`,
      ]

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    }
  )
}
