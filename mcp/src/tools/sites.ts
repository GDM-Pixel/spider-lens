import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSites } from '../client.js'

export function registerListSites(server: McpServer) {
  server.registerTool(
    'list_sites',
    {
      title: 'List Sites',
      description: 'List all sites configured in Spider-Lens with their id, name, and active status.',
      inputSchema: z.object({}),
    },
    async () => {
      const sites = await getSites()
      const text = sites.length === 0
        ? 'No sites configured in Spider-Lens.'
        : sites.map(s => `- ${s.name} (id: ${s.id}, ${s.active ? 'active' : 'inactive'})`).join('\n')
      return { content: [{ type: 'text' as const, text: `Spider-Lens sites:\n${text}` }] }
    }
  )
}
