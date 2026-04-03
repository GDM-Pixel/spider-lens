import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Langues
import en from './locales/en.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import de from './locales/de.json'
import it from './locales/it.json'
import nl from './locales/nl.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { t: en }, fr: { t: fr }, es: { t: es }, de: { t: de }, it: { t: it }, nl: { t: nl } },
    defaultNS: 't',
    ns: ['t'],
    supportedLngs: ['en', 'fr', 'es', 'de', 'it', 'nl'],
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'spider_language',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
