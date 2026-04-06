import { useEffect } from 'react'
import { useChat } from '../context/ChatContext'

/**
 * Enregistre un fetcher lazy dans ChatContext pour que Nova puisse
 * récupérer le contexte de la page courante au moment où l'utilisateur
 * envoie un message (et non au mount).
 *
 * @param {() => Promise<object>} fetcher  Fonction async qui retourne les données de contexte
 */
export function usePageContext(fetcher) {
  const { setPageContext, clearPageContext } = useChat()

  useEffect(() => {
    setPageContext(fetcher)
    return () => clearPageContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
