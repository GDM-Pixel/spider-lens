import { useState } from 'react'
import dayjs from 'dayjs'

const DEFAULT_FROM = () => dayjs().subtract(30, 'day').format('YYYY-MM-DD')
const DEFAULT_TO   = () => dayjs().format('YYYY-MM-DD')

/**
 * usePersistentRange — plage de dates persistée dans localStorage par clé de page.
 * Chaque page a sa propre clé pour que les filtres soient indépendants.
 */
export function usePersistentRange(pageKey) {
  const storageKey = `spider_range_${pageKey}`

  function readStored() {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (parsed?.from && parsed?.to) return parsed
    } catch {}
    return null
  }

  const [range, setRangeState] = useState(() => readStored() ?? { from: DEFAULT_FROM(), to: DEFAULT_TO() })

  function setRange(next) {
    setRangeState(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  return [range, setRange]
}
