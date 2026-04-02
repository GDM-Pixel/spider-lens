import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
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
    if (err.response?.status === 401) {
      localStorage.removeItem('spider_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
