/**
 * Couche de cache in-memory pour les endpoints /stats/* et /network/*.
 *
 * TTL dynamique :
 * - Range récente (to >= aujourd'hui - 1 jour) → 300s
 * - Range historique pur                        → 3600s
 *
 * Bypass : query param ?fresh=1 (routes protégées par requireAuth).
 * Invalidation : flushSite(siteId) appelé après chaque ingestion de logs.
 */

import NodeCache from 'node-cache'

const store = new NodeCache({
  stdTTL:      300,    // TTL par défaut (overridé par set)
  checkperiod: 120,    // nettoyage des entrées expirées toutes les 2 min
  useClones:   false,  // pas de deep clone pour les performances
})

/**
 * L'utilisateur demande-t-il des données fraîches (?fresh=1) ?
 * @param {import('express').Request} req
 */
export function shouldBypass(req) {
  return req.query.fresh === '1'
}

/**
 * Génère une clé de cache déterministe.
 * @param {string} route   Identifiant de la route (ex: 'stats-bots')
 * @param {string} siteId  ID du site
 * @param {object} params  Paramètres de la requête (triés pour cohérence)
 */
export function cacheKey(route, siteId, params = {}) {
  const sorted = Object.keys(params)
    .sort()
    .reduce((o, k) => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        o[k] = params[k]
      }
      return o
    }, {})
  return `${route}|${siteId}|${JSON.stringify(sorted)}`
}

/**
 * TTL dynamique selon la fraîcheur du range.
 * @param {string} to  Date de fin (YYYY-MM-DD)
 */
export function ttlForRange(to) {
  if (!to) return 300
  const toTs = new Date(to).getTime()
  const yesterday = Date.now() - 86_400_000
  return toTs >= yesterday ? 300 : 3600
}

/**
 * Retourne la valeur en cache ou exécute fn() pour la calculer.
 * @param {string}   key     Clé générée via cacheKey()
 * @param {number}   ttl     Durée de vie en secondes
 * @param {boolean}  bypass  Si true, ignore le cache et réécrit
 * @param {Function} fn      Fonction synchrone qui produit la valeur
 */
export function remember(key, ttl, bypass, fn) {
  if (!bypass) {
    const cached = store.get(key)
    if (cached !== undefined) return cached
  }
  const val = fn()
  store.set(key, val, ttl)
  return val
}

/**
 * Vide tout le cache (pour les tests ou un flush manuel).
 */
export function flushAll() {
  store.flushAll()
}

/**
 * Invalide uniquement les entrées pour un siteId donné.
 * Appelé après chaque ingestion de logs pour ce site.
 * @param {string|number} siteId
 */
export function flushSite(siteId) {
  const keys = store.keys().filter(k => k.includes(`|${siteId}|`))
  if (keys.length > 0) store.del(keys)
}

export default { shouldBypass, cacheKey, ttlForRange, remember, flushAll, flushSite }
