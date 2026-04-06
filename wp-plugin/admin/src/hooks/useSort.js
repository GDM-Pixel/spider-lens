import { useState } from 'react'

export function useSort(defaultBy = 'hits', defaultDir = 'desc') {
  const [sort, setSort] = useState({ by: defaultBy, dir: defaultDir })

  function toggleSort(col) {
    setSort(s => s.by === col
      ? { by: col, dir: s.dir === 'desc' ? 'asc' : 'desc' }
      : { by: col, dir: 'desc' }
    )
  }

  return { sort, toggleSort }
}
