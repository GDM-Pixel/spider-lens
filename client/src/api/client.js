import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30s — les requêtes d'agrégation peuvent être lentes sur gros datasets
})

// Injecter le token JWT + siteId actif sur chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('spider_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Injecter siteId sur les routes stats (sauf si déjà présent)
  const siteId = localStorage.getItem('spider_activeSiteId')
  if (siteId && config.url?.startsWith('/stats') && !config.params?.siteId) {
    config.params = { ...config.params, siteId }
  }

  return config
})

// Rediriger vers login si 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('spider_token')
      localStorage.removeItem('spider_username')
      window.dispatchEvent(new Event('spider:unauthorized'))
    }
    return Promise.reject(err)
  }
)

export default api

/**
 * GET avec support du flag `fresh` (bypass cache serveur via ?fresh=1)
 * et AbortController pour annulation.
 *
 * Usage :
 *   const ctrl = new AbortController()
 *   apiGet('/stats/bots', { params: { from, to }, signal: ctrl.signal })
 *   // cleanup: ctrl.abort()
 *
 * @param {string} path
 * @param {{ params?: object, fresh?: boolean, signal?: AbortSignal }} opts
 */
export function apiGet(path, { params, fresh, signal } = {}) {
  return api.get(path, {
    params: fresh ? { ...params, fresh: '1' } : params,
    signal,
  })
}
