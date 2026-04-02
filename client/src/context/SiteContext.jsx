import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const SiteContext = createContext({
  sites: [],
  activeSiteId: null,
  activeSite: null,
  setActiveSiteId: () => {},
  reloadSites: async () => {},
  loading: true,
})

export function useSite() {
  return useContext(SiteContext)
}

export default function SiteProvider({ children }) {
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSiteId, setActiveSiteIdState] = useState(() => {
    const stored = localStorage.getItem('spider_activeSiteId')
    return stored ? parseInt(stored, 10) : null
  })

  const reloadSites = useCallback(async () => {
    try {
      const res = await api.get('/sites')
      setSites(res.data)
      // Si le site actif a été supprimé, revenir à "tous"
      if (activeSiteId && !res.data.find(s => s.id === activeSiteId)) {
        setActiveSiteIdState(null)
        localStorage.removeItem('spider_activeSiteId')
      }
    } catch {
      // Pas connecté ou erreur réseau — silencieux
    } finally {
      setLoading(false)
    }
  }, [activeSiteId])

  useEffect(() => { reloadSites() }, [])

  function setActiveSiteId(id) {
    setActiveSiteIdState(id)
    if (id) localStorage.setItem('spider_activeSiteId', String(id))
    else localStorage.removeItem('spider_activeSiteId')
  }

  const activeSite = sites.find(s => s.id === activeSiteId) || null

  return (
    <SiteContext.Provider value={{ sites, activeSiteId, activeSite, setActiveSiteId, reloadSites, loading }}>
      {children}
    </SiteContext.Provider>
  )
}
