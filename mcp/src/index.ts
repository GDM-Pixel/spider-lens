import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerListSites } from './tools/sites.js'
import { registerGetSeoOverview } from './tools/overview.js'
import { registerGet404Errors } from './tools/errors.js'
import { registerGetBotStats } from './tools/bots.js'
import { registerGetTtfbStats } from './tools/ttfb.js'
import { registerGetCrawlerData } from './tools/crawler.js'
import { registerRunSeoAnalysis } from './tools/analysis.js'

const server = new McpServer({
  name: 'spider-lens',
  version: '1.3.0',
})

registerListSites(server)
registerGetSeoOverview(server)
registerGet404Errors(server)
registerGetBotStats(server)
registerGetTtfbStats(server)
registerGetCrawlerData(server)
registerRunSeoAnalysis(server)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('Spider-Lens MCP server running on stdio')
