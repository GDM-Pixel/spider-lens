import { useState } from 'react'
import dayjs from 'dayjs'

const DEFAULT_FROM = () => dayjs().subtract(30, 'day').format('YYYY-MM-DD')
const DEFAULT_TO   = () => dayjs().format('YYYY-MM-DD')

export function usePersistentRange(pageKey) {
  const storageKey = `spider_lens_wp_range_${pageKey}`

  const [range, setRangeState] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) return JSON.parse(stored)
    } catch {}
    return { from: DEFAULT_FROM(), to: DEFAULT_TO() }
  })

  function setRange(next) {
    setRangeState(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  return [range, setRange]
}
