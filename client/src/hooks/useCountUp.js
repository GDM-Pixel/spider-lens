import { useEffect, useRef, useState } from 'react'

/**
 * Anime un nombre de 0 à `target` sur `duration` ms avec easing ease-out.
 * Retourne la valeur courante formatée.
 *
 * @param {string|number} value   — valeur brute (ex: "12 345" ou 12345 ou "4.2%")
 * @param {number}        duration — durée en ms (défaut: 900)
 */
export function useCountUp(value, duration = 900) {
  const [display, setDisplay] = useState(value)
  const rafRef = useRef(null)
  const prevRef = useRef(value)

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    // Extraire la partie numérique et le suffixe/préfixe
    const str = String(value ?? '')
    const match = str.match(/^([^0-9]*)([0-9][0-9\s.,]*)([^0-9]*)$/)

    // Si pas de nombre, on affiche directement sans animation
    if (!match) {
      setDisplay(value)
      prevRef.current = value
      return
    }

    const prefix = match[1]
    const suffix = match[3]
    // Normaliser le nombre (enlever espaces et virgules de milliers)
    const rawTarget = parseFloat(match[2].replace(/[\s\u00a0]/g, '').replace(',', '.'))

    if (isNaN(rawTarget)) {
      setDisplay(value)
      prevRef.current = value
      return
    }

    const start = performance.now()
    const from = 0

    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(from + (rawTarget - from) * eased)

      // Reformater avec le même séparateur que la valeur originale
      const formatted = current.toLocaleString('fr-FR')
      setDisplay(`${prefix}${formatted}${suffix}`)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(value) // valeur finale exacte
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    prevRef.current = value

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return display
}
