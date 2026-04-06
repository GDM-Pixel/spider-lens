import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { apiFetch, resolveSiteIdOrThrow } from '../client.js'

interface CrawlerSummary {
  total: number
  missingTitle: number
  missingH1: number
  noindex: number
  errors: number
  avgWordCount: number
  thinContent: number
  lastCrawl: string | null
}

interface CrawlerPage {
  url: string
  status_code: number | null
  title: string | null
  h1: string | null
  word_count: number
  depth: number
  source: string
  error: string | null
}

interface CrawlerPagesResponse {
  total: number
  rows: CrawlerPage[]
}

export function registerGetCrawlerData(server: McpServer) {
  server.registerTool(
    'get_crawler_data',
    {
      title: 'Get Crawler Data',
      description:
        'Get on-page SEO data from the Spider-Lens crawler for a specific site. Returns a summary of issues (missing title, H1, noindex, thin content) and optionally a filtered list of pages.',
      inputSchema: z.object({
        site_name: z.string().describe('Site name (required, partial match accepted)'),
        filter: z.enum(['missing_title', 'missing_h1', 'noindex', 'error']).optional()
          .describe('Filter pages by issue type: missing_title, missing_h1, noindex, error'),
        limit: z.number().optional().describe('Max pages to return in the list (default: 20)'),
      }),
    },
    async ({ site_name, filter, limit = 20 }) => {
      const siteId = await resolveSiteIdOrThrow(site_name)

      const [summary, pages] = await Promise.all([
        apiFetch<CrawlerSummary>(`/api/crawler/${siteId}/summary`),
        apiFetch<CrawlerPagesResponse>(`/api/crawler/${siteId}/pages`, {
          params: { page: 1, limit, ...(filter ? { filter } : {}) },
        }),
      ])

      if (summary.total === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: `No crawl data for "${site_name}". Launch a crawl from Spider-Lens Settings → Sites first.`,
          }],
        }
      }

      const thinPct = summary.total > 0 ? Math.round((summary.thinContent / summary.total) * 100) : 0
      const lastCrawl = summary.lastCrawl ? summary.lastCrawl.slice(0, 10) : 'never'

      const lines = [
        `## Crawler Data — ${site_name} (last crawl: ${lastCrawl})`,
        '',
        `**Total pages crawled**: ${summary.total}`,
        `**Missing \`<title>\`**: ${summary.missingTitle} ${summary.missingTitle > 0 ? '❌' : '✅'}`,
        `**Missing \`<h1>\`**: ${summary.missingH1} ${summary.missingH1 > 0 ? '⚠️' : '✅'}`,
        `**Noindex pages**: ${summary.noindex}`,
        `**Thin content (<300 words)**: ${summary.thinContent} (${thinPct}%) ${thinPct > 10 ? '⚠️' : '✅'}`,
        `**Crawl errors**: ${summary.errors} ${summary.errors > 0 ? '❌' : '✅'}`,
        `**Avg word count**: ${summary.avgWordCount}`,
      ]

      if (pages.rows.length > 0) {
        const filterLabel = filter ? ` — filter: ${filter}` : ''
        lines.push('', `### Pages (${pages.total} total${filterLabel}, showing ${pages.rows.length})`, '')
        lines.push('| URL | Status | Title | H1 | Words | Depth |')
        lines.push('|-----|--------|-------|----|-------|-------|')
        pages.rows.forEach(p => {
          const title = p.title ? (p.title.length > 40 ? p.title.slice(0, 40) + '…' : p.title) : '❌ absent'
          const h1 = p.h1 ? (p.h1.length > 30 ? p.h1.slice(0, 30) + '…' : p.h1) : '⚠️ absent'
          lines.push(`| \`${p.url}\` | ${p.status_code || '—'} | ${title} | ${h1} | ${p.word_count || '—'} | ${p.depth} |`)
        })
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    }
  )
}
