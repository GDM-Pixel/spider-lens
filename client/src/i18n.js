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
import pt from './locales/pt.json'
import ja from './locales/ja.json'
import pl from './locales/pl.json'
import sv from './locales/sv.json'
import ko from './locales/ko.json'
import tr from './locales/tr.json'
import ru from './locales/ru.json'
import cs from './locales/cs.json'
import da from './locales/da.json'
import uk from './locales/uk.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { t: en }, fr: { t: fr }, es: { t: es }, de: { t: de }, it: { t: it }, nl: { t: nl },
      pt: { t: pt }, ja: { t: ja }, pl: { t: pl }, sv: { t: sv }, ko: { t: ko }, tr: { t: tr },
      ru: { t: ru }, cs: { t: cs }, da: { t: da }, uk: { t: uk },
    },
    defaultNS: 't',
    ns: ['t'],
    supportedLngs: ['en', 'fr', 'es', 'de', 'it', 'nl', 'pt', 'ja', 'pl', 'sv', 'ko', 'tr', 'ru', 'cs', 'da', 'uk'],
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'spider_language',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
