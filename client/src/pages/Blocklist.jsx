import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@iconify/react'
import { Link } from 'react-router-dom'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import { useSort } from '../hooks/useSort'
import SortableHeader from '../components/ui/SortableHeader'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

function CopySnippet({ code }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="flex items-center gap-2 bg-prussian-700 rounded-lg px-3 py-2.5">
      <code className="flex-1 text-xs text-lightgrey font-mono overflow-x-auto">{code}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 text-errorgrey hover:text-moonstone-400 transition-colors"
        title={t('blocklist.copySnippet')}
      >
        <Icon icon={copied ? 'ph:check' : 'ph:copy'} className={clsx('text-base', copied && 'text-green-400')} />
      </button>
    </div>
  )
}

const PAGE_SIZE = 50

export default function Blocklist() {
  const { t } = useTranslation()
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [offset, setOffset]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { sort, toggleSort }  = useSort('blocked_at', 'desc')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = { limit: PAGE_SIZE, offset, sort: sort.by, dir: sort.dir }
    if (debouncedSearch) params.search = debouncedSearch
    api.get('/blocklist', { params })
      .then(r => { setRows(r.data.rows); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [offset, debouncedSearch, sort])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setOffset(0) }, [debouncedSearch, sort])

  async function handleUnblock(ip) {
    if (!confirm(t('blocklist.unblockTitle', { ip }))) return
    await api.delete(`/blocklist/${encodeURIComponent(ip)}`)
    fetchData()
  }

  function exportRules(type) {
    const token = localStorage.getItem('spider_token')
    fetch(`/api/blocklist/export/${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `spider-lens-blocklist.${type}.conf`
        a.click()
        URL.revokeObjectURL(a.href)
      })
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
          t('blocklist.tip4'),
        ]}
      />

      {/* Bandeau "comment ça fonctionne" */}
      <div className="bg-prussian-600 border border-prussian-500 rounded-xl p-5">
        <h3 className="text-white font-bold text-sm flex items-center gap-2 mb-4">
          <Icon icon="ph:info" className="text-moonstone-400 text-base" />
          {t('blocklist.howItWorksTitle')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-moonstone-400/10 border border-moonstone-600/50 flex items-center justify-center shrink-0 mt-0.5">
              <Icon icon="ph:network" className="text-moonstone-400 text-sm" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold mb-0.5">{t('blocklist.step1Title')}</p>
              <p className="text-errorgrey text-xs">{t('blocklist.step1Body')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-moonstone-400/10 border border-moonstone-600/50 flex items-center justify-center shrink-0 mt-0.5">
              <Icon icon="ph:download-simple" className="text-moonstone-400 text-sm" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold mb-0.5">{t('blocklist.step2Title')}</p>
              <p className="text-errorgrey text-xs">{t('blocklist.step2Body')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-moonstone-400/10 border border-moonstone-600/50 flex items-center justify-center shrink-0 mt-0.5">
              <Icon icon="ph:terminal" className="text-moonstone-400 text-sm" />
            </div>
            <div>
              <p className="text-white text-xs font-semibold mb-0.5">{t('blocklist.step3Title')}</p>
              <p className="text-errorgrey text-xs">{t('blocklist.step3Body')}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportRules('nginx')}
            disabled={total === 0}
            className="flex items-center gap-2 px-4 py-2 bg-moonstone-600/20 border border-moonstone-600/50 rounded-lg text-sm font-semibold text-moonstone-300 hover:bg-moonstone-600/30 hover:text-white disabled:opacity-40 transition-colors"
          >
            <Icon icon="ph:download-simple" className="text-base" />
            {t('blocklist.exportNginx')}
          </button>
          <button
            onClick={() => exportRules('apache')}
            disabled={total === 0}
            className="flex items-center gap-2 px-4 py-2 bg-moonstone-600/20 border border-moonstone-600/50 rounded-lg text-sm font-semibold text-moonstone-300 hover:bg-moonstone-600/30 hover:text-white disabled:opacity-40 transition-colors"
          >
            <Icon icon="ph:download-simple" className="text-base" />
            {t('blocklist.exportApache')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">Blocklist</h2>
          <p className="text-errorgrey text-sm">
            {total > 0 ? (
              <span>{t('blocklist.subtitleMany', { total, plural: total > 1 ? 's' : '' })}</span>
            ) : t('blocklist.subtitleNone')}
          </p>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="flex items-center gap-2 bg-prussian-600 border border-prussian-500 rounded-lg px-3 py-2 max-w-sm">
        <Icon icon="ph:magnifying-glass" className="text-errorgrey shrink-0" />
        <input
          type="text"
          placeholder={t('blocklist.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-transparent text-white text-sm flex-1 outline-none placeholder-errorgrey"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-errorgrey hover:text-white transition-colors">
            <Icon icon="ph:x" className="text-sm" />
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-prussian-700 text-errorgrey text-xs uppercase tracking-wide">
              <SortableHeader col="ip" sort={sort} onSort={toggleSort} align="left" className="px-4">{t('blocklist.headerIp')}</SortableHeader>
              <th className="text-left px-4 py-3 hidden md:table-cell">{t('blocklist.headerReason')}</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">{t('blocklist.headerSite')}</th>
              <SortableHeader col="blocked_at" sort={sort} onSort={toggleSort} align="left" className="px-4 hidden sm:table-cell">{t('blocklist.headerBlockedAt')}</SortableHeader>
              <th className="text-left px-4 py-3 hidden sm:table-cell">{t('blocklist.headerBlockedBy')}</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="py-16 text-center">
                <div className="w-6 h-6 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && rows.map(row => (
              <tr key={row.id} className="border-t border-prussian-400 hover:bg-prussian-400/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon icon="ph:prohibit" className="text-dustyred-400 text-sm shrink-0" />
                    <span className="font-mono text-moonstone-300">{row.ip}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-errorgrey text-sm hidden md:table-cell">
                  {row.reason || <span className="italic text-prussian-300">—</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {row.site_name
                    ? <span className="text-xs bg-prussian-600 text-lightgrey rounded px-2 py-0.5">{row.site_name}</span>
                    : <span className="text-prussian-300 text-xs">Tous</span>
                  }
                </td>
                <td className="px-4 py-3 text-errorgrey text-xs hidden sm:table-cell">
                  {dayjs(row.blocked_at).format('DD/MM/YYYY HH:mm')}
                </td>
                <td className="px-4 py-3 text-errorgrey text-xs hidden sm:table-cell">
                  {row.blocked_by}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleUnblock(row.ip)}
                    title={t('blocklist.unblockTitle', { ip: row.ip })}
                    className="text-errorgrey hover:text-green-400 transition-colors p-1 rounded"
                  >
                    <Icon icon="ph:lock-open" className="text-base" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Icon icon="ph:shield-check" className="text-4xl text-green-400/50" />
                    <p className="text-errorgrey text-sm">
                      {debouncedSearch ? t('blocklist.emptySearch') : t('blocklist.emptyNoBlocks')}
                    </p>
                    {!debouncedSearch && (
                      <Link to="/network" className="text-moonstone-400 hover:text-moonstone-300 text-xs font-semibold transition-colors">
                        {t('blocklist.linkToNetwork')}
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
            className="px-4 py-2 bg-prussian-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-prussian-500 transition-colors"
          >← {t('common.previous')}</button>
          <span className="text-errorgrey text-sm">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} {t('common.of')} {total.toLocaleString()}
          </span>
          <button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(o => o + PAGE_SIZE)}
            className="px-4 py-2 bg-prussian-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-prussian-500 transition-colors"
          >{t('common.next')} →</button>
        </div>
      )}

      {/* Guide snippets */}
      <div className="bg-prussian-600 border border-prussian-500 rounded-xl p-5 flex flex-col gap-4">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Icon icon="ph:code" className="text-moonstone-400 text-base" />
          {t('blocklist.guideTitle')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-2">{t('blocklist.guideNginxLabel')}</p>
            <CopySnippet code={t('blocklist.guideNginxSnippet')} />
          </div>
          <div>
            <p className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-2">{t('blocklist.guideApacheLabel')}</p>
            <CopySnippet code={t('blocklist.guideApacheSnippet')} />
          </div>
        </div>
      </div>
    </div>
  )
}
