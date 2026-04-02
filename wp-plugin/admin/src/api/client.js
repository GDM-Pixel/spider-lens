/**
 * Client API pour Spider-Lens WP.
 * Utilise window.spiderLens.apiBase (injecté par wp_localize_script)
 * et window.spiderLens.nonce pour l'authentification WP REST.
 */

const config = window.spiderLens || {
  apiBase: '/wp-json/spider-lens/v1',
  nonce:   '',
}

async function request(method, path, { params, body } = {}) {
  let url = config.apiBase + path

  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString()
    if (qs) url += '?' + qs
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-WP-Nonce': config.nonce,
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    const error = new Error(err.message || 'Erreur API')
    error.status = res.status
    error.response = { status: res.status, data: err }
    throw error
  }

  // Certains endpoints (export) redirigent — pas de JSON
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return { data: await res.json() }
  }
  return { data: await res.text() }
}

const api = {
  get:    (path, opts = {}) => request('GET',    path, opts),
  post:   (path, body, opts = {}) => request('POST',   path, { ...opts, body }),
  delete: (path, opts = {}) => request('DELETE', path, opts),
}

export default api
