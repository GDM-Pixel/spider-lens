import React, { useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import dayjs from 'dayjs'

/**
 * Bouton de re-vérification d'une URL 404.
 * Affiche un badge coloré selon le résultat :
 *   - vert   (ph:check-circle)      : status 200 → fixé
 *   - bleu   (ph:arrows-left-right) : status 301/302 → redirigé
 *   - rouge  (ph:x-circle)          : toujours cassé
 *
 * @param {string}      url            - Chemin relatif (ex: /page-manquante)
 * @param {number}      siteId         - ID du site
 * @param {object|null} initialRecheck - { status_code, recheck_final_url, recheck_checked_at } ou null
 */
export default function RecheckButton({ url, siteId, initialRecheck }) {
  const { t } = useTranslation()
  const [recheck, setRecheck] = useState(initialRecheck || null)
  const [loading, setLoading] = useState(false)

  async function handleRecheck(e) {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const { data } = await api.post('/crawler/recheck-url', { url, siteId })
      setRecheck({ status_code: data.status, recheck_final_url: data.finalUrl, recheck_checked_at: data.checkedAt })
    } catch {
      // silencieux — l'utilisateur peut réessayer
    } finally {
      setLoading(false)
    }
  }

  const badge = getBadge(recheck, t)

  return (
    <div className="flex items-center gap-1.5 justify-end">
      {badge && (
        <span
          className={`flex items-center gap-1 text-xs font-medium ${badge.className}`}
          title={badge.tooltip}
        >
          <Icon icon={badge.icon} className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{badge.label}</span>
        </span>
      )}
      <button
        onClick={handleRecheck}
        disabled={loading}
        title={loading ? t('recheck.loading') : t('recheck.button')}
        className="text-prussian-300 hover:text-moonstone-300 disabled:opacity-50 transition-colors"
      >
        <Icon
          icon="ph:arrow-clockwise"
          className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  )
}

function getBadge(recheck, t) {
  if (!recheck || !recheck.status_code) return null

  const code = parseInt(recheck.status_code, 10)
  const date = recheck.recheck_checked_at
    ? dayjs(recheck.recheck_checked_at).format('DD/MM/YYYY HH:mm')
    : ''

  if (code === 200) {
    return {
      icon: 'ph:check-circle',
      label: '200',
      className: 'text-emerald-400',
      tooltip: t('recheck.fixed200', { date }),
    }
  }
  if (code === 301 || code === 302) {
    const target = recheck.recheck_final_url || ''
    return {
      icon: 'ph:arrows-left-right',
      label: String(code),
      className: 'text-blue-400',
      tooltip: t('recheck.redirected', { code, target }),
    }
  }
  return {
    icon: 'ph:x-circle',
    label: String(code),
    className: 'text-dustyred-400',
    tooltip: t('recheck.stillBroken', { code }),
  }
}
