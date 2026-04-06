# Spider-Lens MCP Server

Expose Spider-Lens data as MCP tools for Claude Code (or any MCP-compatible client).

## Available Tools

| Tool | Description |
|------|-------------|
| `list_sites` | List all configured sites |
| `get_seo_overview` | Traffic breakdown (humans, bots, HTTP codes) |
| `get_404_errors` | Top 404 URLs with hit counts |
| `get_bot_stats` | Bot crawl activity (Googlebot, Ahrefs, Semrush…) |
| `get_ttfb_stats` | Server response time (avg, slow pages, top slowest URLs) |
| `get_crawler_data` | On-page SEO data (missing title/H1, noindex, thin content) |
| `run_seo_analysis` | Full AI-powered SEO analysis (score 0-100 + recommendations) |

## Installation

```bash
cd mcp
npm install
npm run build
```

## Configuration

Add to your `~/.claude/settings.json` (Claude Code) or equivalent MCP config:

```json
{
  "mcpServers": {
    "spider-lens": {
      "command": "node",
      "args": ["C:/path/to/spider-lens/mcp/dist/index.js"],
      "env": {
        "SPIDER_LENS_URL": "https://spider-lens.your-domain.com",
        "SPIDER_LENS_USER": "admin",
        "SPIDER_LENS_PASS": "your-password"
      }
    }
  }
}
```

### Alternative: static token

If you prefer to use a pre-generated JWT token instead of login credentials:

```json
{
  "env": {
    "SPIDER_LENS_URL": "https://spider-lens.your-domain.com",
    "SPIDER_LENS_TOKEN": "eyJhbGci..."
  }
}
```

## Usage examples

Once configured, you can ask Claude:

- *"List all sites in Spider-Lens"*
- *"Show me the SEO overview for gdm-pixel.com this week"*
- *"Which pages return 404 on my site?"*
- *"Is Googlebot actively crawling my site?"*
- *"What's the average TTFB? Which pages are slowest?"*
- *"Which pages are missing an H1 tag?"*
- *"Run a full SEO analysis for gdm-pixel.com and tell me what to fix"*
