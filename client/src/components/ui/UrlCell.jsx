import React from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'

/**
 * Affiche une URL avec un lien cliquable + icône "ouvrir dans un nouvel onglet".
 * Si siteUrl est vide/null, affiche le texte brut sans lien.
 *
 * @param {string} path     - Chemin relatif (ex: /about)
 * @param {string} siteUrl  - URL de base du site (ex: https://monsite.com)
 */
export default function UrlCell({ path, siteUrl }) {
  const { t } = useTranslation()

  if (!siteUrl || !path) {
    return (
      <span className="text-moonstone-400 font-mono truncate">{path || '—'}</span>
    )
  }

  const href = siteUrl.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path)

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-moonstone-400 hover:text-moonstone-300 font-mono truncate min-w-0 transition-colors"
        title={href}
      >
        {path}
      </a>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={t('common.openInNewTab')}
        className="shrink-0 text-moonstone-600 hover:text-moonstone-300 transition-colors"
      >
        <Icon icon="ph:arrow-square-out" className="w-3.5 h-3.5" />
      </a>
    </div>
  )
}
