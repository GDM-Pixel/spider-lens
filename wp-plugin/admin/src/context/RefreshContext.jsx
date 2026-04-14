import { createContext, useCallback, useContext, useRef, useState } from 'react'

/**
 * Contexte global de rafraîchissement.
 *
 * - `refreshKey`     : s'incrémente à chaque appui sur "Actualiser" → les pages
 *                      l'ajoutent en dépendance de leur useEffect pour re-fetcher.
 * - `triggerRefresh` : fonction à appeler depuis le bouton de la top bar.
 * - `consumeFresh`   : retourne true une seule fois après un triggerRefresh,
 *                      puis false. Sert à passer `fresh=1` au premier fetch suivant.
 */
const RefreshContext = createContext({
  refreshKey:     0,
  triggerRefresh: () => {},
  consumeFresh:   () => false,
})

export function RefreshProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const freshPending = useRef(false)

  const triggerRefresh = useCallback(() => {
    freshPending.current = true
    setRefreshKey(k => k + 1)
  }, [])

  const consumeFresh = useCallback(() => {
    if (freshPending.current) {
      freshPending.current = false
      return true
    }
    return false
  }, [])

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh, consumeFresh }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh() {
  return useContext(RefreshContext)
}
