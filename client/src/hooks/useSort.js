import { useState } from 'react'

/**
 * Hook de tri réutilisable pour les tableaux.
 * @param {string} defaultBy  — colonne de tri par défaut
 * @param {string} defaultDir — direction par défaut ('asc' | 'desc')
 * @returns {{ sort: {by, dir}, toggleSort: fn }}
 */
export function useSort(defaultBy = 'hits', defaultDir = 'desc') {
  const [sort, setSort] = useState({ by: defaultBy, dir: defaultDir })

  function toggleSort(col) {
    setSort((s) =>
      s.by === col
        ? { by: col, dir: s.dir === 'desc' ? 'asc' : 'desc' }
        : { by: col, dir: 'desc' },
    )
  }

  return { sort, toggleSort }
}
