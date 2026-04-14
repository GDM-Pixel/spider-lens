import { useState, useEffect } from 'react'

/**
 * Retarde la mise à jour d'une valeur jusqu'à ce que l'utilisateur
 * arrête de modifier pendant `delay` millisecondes.
 *
 * @param {*}      value  Valeur à debouncer
 * @param {number} delay  Délai en ms (défaut : 500)
 * @returns La valeur debouncée
 */
export function useDebounce(value, delay = 500) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
