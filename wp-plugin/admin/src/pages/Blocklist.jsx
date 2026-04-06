import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import BeginnerBanner from '../components/ui/BeginnerBanner'

const LIMIT = 50

export default function Blocklist() {
  const { t } = useTranslation()
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = {
      search,
      limit: LIMIT,
      offset,
    }

    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v)
    ).toString()
    fetch(`${window.spiderLens.apiBase}/blocklist?${qs}`, {
      headers: {
        'X-WP-Nonce': window.spiderLens.nonce,
      },
      credentials: 'same-origin',
    })
      .then(res => res.json())
      .then(result => setData(result || []))
      .catch(err => console.error('Erreur chargement blocklist:', err))
      .finally(() => setLoading(false))
  }, [search, offset])

  const handleUnblock = async ip => {
    try {
      const response = await fetch(
        `${window.spiderLens.apiBase}/blocklist/${encodeURIComponent(ip)}`,
        {
          method: 'DELETE',
          headers: {
            'X-WP-Nonce': window.spiderLens.nonce,
          },
          credentials: 'same-origin',
        }
      )
      if (response.ok) {
        setData(data.filter(item => item.ip !== ip))
      }
    } catch (err) {
      console.error('Erreur déblocage IP:', err)
    }
  }

  const handleExport = async type => {
    try {
      const url = `${window.spiderLens.apiBase}/blocklist/export/${type}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-WP-Nonce': window.spiderLens.nonce,
        },
        credentials: 'same-origin',
      })
      if (response.ok) {
        const blob = await response.blob()
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `blocklist-${dayjs().format('YYYY-MM-DD')}.${type === 'nginx' ? 'conf' : 'txt'}`
        link.click()
      }
    } catch (err) {
      console.error('Erreur export:', err)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:prohibit"
        title={t('blocklist.welcomeTitle')}
        tips={[
          t('blocklist.tip1'),
          t('blocklist.tip2'),
          t('blocklist.tip3'),
        ]}
      />
      <div>
        <h2 className="text-white font-bold text-xl">{t('blocklist.title')}</h2>
        <p className="text-errorgrey text-sm">{t('blocklist.subtitle')}</p>
      </div>

      {/* Recherche + Exports */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Icon
              icon="ph:magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-base"
            />
            <input
              type="text"
              placeholder={t('blocklist.searchPlaceholder')}
              value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0) }}
              className="w-full bg-prussian-500 border border-prussian-400 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleExport('nginx')}
            className="flex items-center gap-2 px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm"
          >
            <Icon icon="ph:download" className="text-base" />
            {t('blocklist.exportNginx')}
          </button>
          <button
            onClick={() => handleExport('apache')}
            className="flex items-center gap-2 px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm"
          >
            <Icon icon="ph:download" className="text-base" />
            {t('blocklist.exportApache')}
          </button>
        </div>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-prussian-400">
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('network.headerIp')}
                  </th>
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('blocklist.headerReason')}
                  </th>
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('blocklist.headerBlockedAt')}
                  </th>
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('common.by')}
                  </th>
                  <th className="px-4 py-3 text-center text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('blocklist.unblockTitle')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-prussian-600 hover:bg-prussian-500 transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-mono font-semibold">
                      {item.ip}
                    </td>
                    <td className="px-4 py-3 text-lightgrey">
                      {item.reason || '—'}
                    </td>
                    <td className="px-4 py-3 text-errorgrey text-xs">
                      {dayjs(item.blocked_at).format('DD/MM/YYYY HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-lightgrey text-xs">
                      {item.blocked_by || 'Système'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleUnblock(item.ip)}
                        className="text-moonstone-400 hover:text-moonstone-300 font-semibold text-sm"
                      >
                        {t('blocklist.unblockTitle')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="px-3 py-2 bg-prussian-500 border border-prussian-400 rounded-lg text-white text-sm disabled:opacity-50 hover:border-moonstone-400 transition-colors"
            >
              Précédent
            </button>
            <span className="text-errorgrey text-sm">
              Page {Math.floor(offset / LIMIT) + 1}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={data.length < LIMIT}
              className="px-3 py-2 bg-prussian-500 border border-prussian-400 rounded-lg text-white text-sm disabled:opacity-50 hover:border-moonstone-400 transition-colors"
            >
              Suivant
            </button>
          </div>
        </>
      ) : (
        <EmptyState message={search ? t('blocklist.emptySearch') : t('blocklist.emptyNoBlocks')} />
      )}
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <Icon icon="ph:chart-bar" className="text-3xl text-prussian-400" />
      <p className="text-errorgrey text-sm">{message}</p>
    </div>
  )
}
