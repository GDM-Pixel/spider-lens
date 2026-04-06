import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiFetch, resolveSiteId, defaultRange, getSites } from '../client.js'

interface TtfbOverview {
  avg_ms: number | null
  min_ms: number | null
  max_ms: number | null
  total: number
  slow_count: number
  fast_count: number
  slow_pct: string
}

interface TtfbUrl {
  url: string
  avg_ms: number
  max_ms: number
  hits: number
}

export function registerGetTtfbStats(server: McpServer) {
  server.registerTool(
    'get_ttfb_stats',
    {
      title: 'Get TTFB Stats',
      description:
        'Get Time To First Byte (server response time) stats for a Spider-Lens site. Returns average TTFB, slow page count, and the top slowest URLs. Requires nginx $request_time in log format.',
      inputSchema: z.object({
        site_name: z.string().optional().describe('Site name (partial match). Leave empty for all sites.'),
        from: z.string().optional().describe('Start date YYYY-MM-DD (default: 30 days ago)'),
        to: z.string().optional().describe('End date YYYY-MM-DD (default: today)'),
        threshold_ms: z.number().optional().describe('Slow threshold in ms (default: 800)'),
      }),
    },
    async ({ site_name, from, to, threshold_ms = 800 }) => {
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

      const [overview, byUrl] = await Promise.all([
        apiFetch<TtfbOverview>('/api/stats/ttfb/overview', { params: { ...range, siteId, threshold: threshold_ms } }),
        apiFetch<TtfbUrl[]>('/api/stats/ttfb/by-url', { params: { ...range, siteId, threshold: threshold_ms, limit: 10, sort: 'avg' } }),
      ])

      if (!overview.avg_ms && overview.total === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No TTFB data available. Make sure nginx is configured with $request_time in the log format (see Spider-Lens README).',
          }],
        }
      }

      const rating = (ms: number | null) => {
        if (!ms) return '—'
        if (ms <= 200) return `${ms}ms ✅ Excellent`
        if (ms <= 800) return `${ms}ms ⚠️ Acceptable`
        return `${ms}ms ❌ Slow`
      }

      const lines = [
        `## TTFB Stats — ${site_name || 'All sites'} (${range.from} → ${range.to})`,
        '',
        `**Average TTFB**: ${rating(overview.avg_ms)}`,
        `**Min**: ${overview.min_ms ?? '—'}ms | **Max**: ${overview.max_ms ?? '—'}ms`,
        `**Slow pages (>${threshold_ms}ms)**: ${overview.slow_count} (${overview.slow_pct})`,
        `**Fast pages (≤200ms)**: ${overview.fast_count}`,
        `**Total requests measured**: ${overview.total.toLocaleString()}`,
      ]

      if (byUrl.length > 0) {
        lines.push('', `### Top ${byUrl.length} Slowest URLs`, '')
        lines.push('| URL | Avg (ms) | Max (ms) | Hits |')
        lines.push('|-----|----------|----------|------|')
        byUrl.forEach(r => {
          lines.push(`| \`${r.url}\` | ${r.avg_ms} | ${r.max_ms} | ${r.hits} |`)
        })
      }

      if (overview.avg_ms && overview.avg_ms > 800) {
        lines.push('', '❌ **TTFB above 800ms** — This impacts Google Core Web Vitals and crawl efficiency. Investigate slow database queries, missing cache, or server resources.')
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    }
  )
}
