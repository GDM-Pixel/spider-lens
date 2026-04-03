import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@iconify/react'

const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = LANGUAGES.find(l => l.code === i18n.resolvedLanguage) || LANGUAGES[1]

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(code) {
    i18n.changeLanguage(code)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-prussian-500 border border-prussian-400 rounded-full px-3 py-1.5 text-xs font-semibold text-errorgrey hover:text-white hover:border-prussian-300 transition-all"
      >
        <span>{current.flag}</span>
        <span className="hidden sm:block">{current.code.toUpperCase()}</span>
        <Icon icon="ph:caret-down" className={`text-sm transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-prussian-600 border border-prussian-500 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => select(lang.code)}
              className={`flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-prussian-500 transition-colors ${
                lang.code === current.code ? 'text-moonstone-400 font-semibold' : 'text-errorgrey hover:text-white'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
