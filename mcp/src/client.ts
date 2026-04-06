/**
 * Spider-Lens API client
 * Handles JWT auth (auto-login or static token) and HTTP requests.
 */

const SPIDER_LENS_URL = process.env.SPIDER_LENS_URL?.replace(/\/$/, '') || 'http://localhost:3001'
const SPIDER_LENS_USER = process.env.SPIDER_LENS_USER
const SPIDER_LENS_PASS = process.env.SPIDER_LENS_PASS
const SPIDER_LENS_TOKEN = process.env.SPIDER_LENS_TOKEN

let cachedToken: string | null = SPIDER_LENS_TOKEN || null
let sitesCache: { id: number; name: string; active: number }[] | null = null

// ── Auth ──────────────────────────────────────────────────

async function login(): Promise<string> {
  if (!SPIDER_LENS_USER || !SPIDER_LENS_PASS) {
    throw new Error(
      'Spider-Lens credentials not configured. Set SPIDER_LENS_USER + SPIDER_LENS_PASS (or SPIDER_LENS_TOKEN) env vars.'
    )
  }
  const res = await fetch(`${SPIDER_LENS_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: SPIDER_LENS_USER, password: SPIDER_LENS_PASS }),
  })
  if (!res.ok) throw new Error(`Login failed: HTTP ${res.status}`)
  const data = await res.json() as { token: string }
  return data.token
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken
  cachedToken = await login()
  return cachedToken
}

// ── HTTP helper ───────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; params?: Record<string, string | number | undefined> } = {}
): Promise<T> {
  const token = await getToken()

  let url = `${SPIDER_LENS_URL}${path}`
  if (opts.params) {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null) q.set(k, String(v))
    }
    const qs = q.toString()
    if (qs) url += `?${qs}`
  }

  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401) {
    // Token expired — retry once with fresh login
    cachedToken = null
    const newToken = await getToken()
    const retry = await fetch(url, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })
    if (!retry.ok) throw new Error(`API error ${retry.status}: ${await retry.text()}`)
    return retry.json() as Promise<T>
  }

  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

// ── Site name resolver ────────────────────────────────────

export type Site = { id: number; name: string; active: number }

export async function getSites(): Promise<Site[]> {
  if (sitesCache) return sitesCache
  const sites = await apiFetch<Site[]>('/api/sites')
  sitesCache = sites
  return sites
}

export async function resolveSiteId(siteName: string): Promise<number | undefined> {
  const sites = await getSites()
  const lower = siteName.toLowerCase()
  const match = sites.find(
    s => s.name.toLowerCase() === lower || s.name.toLowerCase().includes(lower)
  )
  return match?.id
}

export async function resolveSiteIdOrThrow(siteName: string): Promise<number> {
  const id = await resolveSiteId(siteName)
  if (!id) {
    const sites = await getSites()
    const names = sites.map(s => s.name).join(', ')
    throw new Error(`Site "${siteName}" not found. Available sites: ${names}`)
  }
  return id
}

// ── Default date range (last 30 days) ─────────────────────

export function defaultRange(from?: string, to?: string) {
  const now = new Date()
  const d30 = new Date(Date.now() - 30 * 86400000)
  return {
    from: from || d30.toISOString().slice(0, 10),
    to: to || now.toISOString().slice(0, 10),
  }
}
