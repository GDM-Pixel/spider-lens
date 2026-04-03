import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@iconify/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import DateRangePicker from '../components/ui/DateRangePicker'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import { usePersistentRange } from '../hooks/usePersistentRange'
import { useSort } from '../hooks/useSort'
import SortableHeader from '../components/ui/SortableHeader'
import { useSite } from '../context/SiteContext'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

const DEFAULT_FROM = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
const DEFAULT_TO = dayjs().format('YYYY-MM-DD')
const PAGE_SIZE = 50

// Emoji drapeau à partir du code pays ISO 3166-1 alpha-2
function countryFlag(code) {
  if (!code || code.length !== 2) return '🌐'
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0))
  )
}

// Widget Top Pays
function TopCountriesWidget({ range, siteId, botFilter }) {
  const { t } = useTranslation()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = { from: range.from, to: range.to }
    if (siteId) params.siteId = siteId
    if (botFilter !== '') params.bot = botFilter
    api.get('/network/top-countries', { params })
      .then(r => setData(r.data.slice(0, 10)))
      .finally(() => setLoading(false))
  }, [range, siteId, botFilter])

  if (loading) return (
    <div className="bg-prussian-600 rounded-xl border border-prussian-500 p-5 flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (data.length === 0) return null

  const max = data[0]?.hits || 1

  return (
    <div className="bg-prussian-600 rounded-xl border border-prussian-500 p-5">
      <h3 className="text-white font-bold text-sm mb-4">{t('network.topCountries')}</h3>
      <div className="flex flex-col gap-2">
        {data.map((row, i) => (
          <div key={row.country_code || i} className="flex items-center gap-3">
            <span className="text-lg w-7 text-center shrink-0">{countryFlag(row.country_code)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white text-xs font-semibold truncate">{row.country || t('common.unknown')}</span>
                <span className="text-errorgrey text-xs ml-2 shrink-0">{row.hits.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-prussian-500 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-moonstone-400"
                  style={{ width: `${Math.round((row.hits / max) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-errorgrey text-xs w-8 text-right shrink-0">
              {row.ip_count} IP{row.ip_count > 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Modale de blocage d'IP ────────────────────────────────
function BlockModal({ ip, onConfirm, onClose }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit(e) {
    e.preventDefault()
    onConfirm(ip, reason.trim() || null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-prussian-600 border border-prussian-400 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-dustyred-400/10 border border-dustyred-700/50 flex items-center justify-center shrink-0">
            <Icon icon="ph:prohibit" className="text-dustyred-400 text-xl" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">{t('network.blockModalTitle')}</h3>
            <p className="text-moonstone-300 font-mono text-sm">{ip}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-errorgrey text-xs font-semibold uppercase tracking-wide block mb-1.5">
              {t('network.blockModalReasonLabel')}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('network.blockModalReasonPlaceholder')}
              className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm placeholder-errorgrey outline-none focus:border-moonstone-500"
            />
          </div>
          <p className="text-errorgrey text-xs">
            {t('network.blockModalInfo')}
          </p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-prussian-700 text-errorgrey rounded-lg text-sm font-semibold hover:text-white transition-colors"
            >
              {t('network.blockModalCancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-dustyred-400 text-white rounded-lg text-sm font-semibold hover:bg-dustyred-500 transition-colors"
            >
              {t('network.blockModalConfirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StatusBadge({ value, total, label, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  if (value === 0) return null
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-mono', color)}>
      {pct}%
    </span>
  )
}

// ── Expansion : URLs visitées par une IP ──────────────────
function IpUrlDetail({ ip, range, siteId }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState(null)

  useEffect(() => {
    api.get(`/network/ips/${encodeURIComponent(ip)}/urls`, {
      params: { ...range, siteId: siteId || undefined },
    }).then(r => setRows(r.data))
  }, [ip, range, siteId])

  if (rows === null) return (
    <tr>
      <td colSpan={7} className="px-4 py-3 text-center">
        <div className="w-5 h-5 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin mx-auto" />
      </td>
    </tr>
  )

  return (
    <tr>
      <td colSpan={7} className="px-4 py-2 bg-prussian-700/60">
        <div className="rounded-lg overflow-hidden border border-prussian-500">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-prussian-600 text-errorgrey">
                <th className="text-left px-3 py-2">{t('network.headerUrlDetail')}</th>
                <th className="text-center px-3 py-2">{t('network.headerCodeDetail')}</th>
                <th className="text-right px-3 py-2">{t('network.headerHits')}</th>
                <th className="text-right px-3 py-2">{t('network.headerLastVisit')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-prussian-600 hover:bg-prussian-600/40">
                  <td className="px-3 py-1.5 font-mono text-moonstone-300 truncate max-w-[340px]">{r.url}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={clsx('font-mono font-semibold',
                      r.status_code < 300 ? 'text-green-400' :
                      r.status_code < 400 ? 'text-yellow-400' :
                      r.status_code < 500 ? 'text-orange-400' : 'text-dustyred-400'
                    )}>{r.status_code}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-white font-semibold">{r.hits.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right text-errorgrey">{dayjs(r.last_seen).format('DD/MM HH:mm')}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-3 text-center text-errorgrey">{t('network.emptyUrls')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

// ── Onglet IPs ────────────────────────────────────────────
function IpsTab({ range, siteId }) {
  const { t } = useTranslation()
  const [rows, setRows]         = useState([])
  const [total, setTotal]       = useState(0)
  const [offset, setOffset]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch]     = useState('')
  const [botFilter, setBotFilter] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [blockedIps, setBlockedIps] = useState(new Set())
  const [blockModal, setBlockModal] = useState(null) // ip à bloquer
  const { sort: ipSort, toggleSort: toggleIpSort } = useSort('hits', 'desc')

  // Chargement initial de la blocklist (IPs bloquées)
  useEffect(() => {
    api.get('/blocklist', { params: { limit: 1000 } })
      .then(r => setBlockedIps(new Set(r.data.rows.map(b => b.ip))))
      .catch(() => {})
  }, [])

  async function handleBlock(ip, reason) {
    try {
      await api.post('/blocklist', { ip, reason, siteId: siteId || undefined })
      setBlockedIps(prev => new Set([...prev, ip]))
    } catch (e) {
      if (e.response?.status === 409) alert('Cette IP est déjà bloquée.')
    } finally {
      setBlockModal(null)
    }
  }

  async function handleUnblock(ip) {
    await api.delete(`/blocklist/${encodeURIComponent(ip)}`)
    setBlockedIps(prev => { const s = new Set(prev); s.delete(ip); return s })
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = { ...range, limit: PAGE_SIZE, offset, sort: ipSort.by, dir: ipSort.dir }
    if (botFilter !== '') params.bot = botFilter
    if (debouncedSearch) params.search = debouncedSearch
    if (siteId) params.siteId = siteId
    api.get('/network/ips', { params })
      .then(r => { setRows(r.data.rows); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [range, offset, botFilter, debouncedSearch, siteId, ipSort])

  function exportCSV() {
    setExporting(true)
    const token = localStorage.getItem('spider_token')
    const params = new URLSearchParams({ from: range.from, to: range.to })
    if (botFilter !== '') params.set('bot', botFilter)
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (siteId) params.set('siteId', siteId)
    fetch(`/api/network/ips/export?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `spider-lens-ips-${range.from}-${range.to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .finally(() => setExporting(false))
  }

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setOffset(0); setExpanded(null) }, [range, botFilter, debouncedSearch, siteId, ipSort])

  return (
    <div className="flex flex-col gap-4">
      {blockModal && (
        <BlockModal
          ip={blockModal}
          onConfirm={handleBlock}
          onClose={() => setBlockModal(null)}
        />
      )}
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-prussian-600 border border-prussian-500 rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-xs">
          <Icon icon="ph:magnifying-glass" className="text-errorgrey shrink-0" />
          <input
            type="text"
            placeholder={t('network.filterIps')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-white text-sm flex-1 outline-none placeholder-errorgrey"
          />
        </div>
        <div className="flex gap-1">
          {[['', t('network.filterAll')], ['0', t('network.filterHumans')], ['1', t('network.filterBots')]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setBotFilter(val)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                botFilter === val
                  ? 'bg-moonstone-400/20 text-moonstone-300 border border-moonstone-600'
                  : 'bg-prussian-600 text-errorgrey border border-prussian-500 hover:text-white'
              )}
            >{label}</button>
          ))}
        </div>
        <span className="text-errorgrey text-sm">{total.toLocaleString()} {t('network.totalIps')}</span>
        <button
          onClick={exportCSV}
          disabled={exporting || total === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-600 border border-prussian-500 rounded-lg text-xs font-semibold text-errorgrey hover:text-white transition-colors disabled:opacity-40"
        >
          <Icon icon="ph:download-simple" className="text-sm" />
          {exporting ? t('common.exporting') : t('common.csv')}
        </button>
      </div>

      {/* Table */}
      <div className="bg-prussian-600 rounded-xl border border-prussian-500 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-prussian-700 text-errorgrey text-xs uppercase tracking-wide">
              <SortableHeader col="ip" sort={ipSort} onSort={toggleIpSort} align="left" className="px-4">{t('network.headerIp')}</SortableHeader>
              <th className="text-left px-4 py-3 hidden md:table-cell">{t('network.headerCountry')}</th>
              <SortableHeader col="hits" sort={ipSort} onSort={toggleIpSort} className="px-4">{t('network.headerHits')}</SortableHeader>
              <SortableHeader col="bot_hits" sort={ipSort} onSort={toggleIpSort} className="px-4 hidden md:table-cell">{t('network.headerBots')}</SortableHeader>
              <SortableHeader col="human_hits" sort={ipSort} onSort={toggleIpSort} className="px-4 hidden md:table-cell">{t('network.headerHumans')}</SortableHeader>
              <th className="text-center px-4 py-3 hidden lg:table-cell">{t('network.headerCodes')}</th>
              <SortableHeader col="bot_name" sort={ipSort} onSort={toggleIpSort} align="left" className="px-4 hidden lg:table-cell">{t('network.headerBotName')}</SortableHeader>
              <SortableHeader col="last_seen" sort={ipSort} onSort={toggleIpSort} className="px-4 hidden sm:table-cell">{t('network.headerLastVisit')}</SortableHeader>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="py-12 text-center">
                <div className="w-6 h-6 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && rows.map(row => {
              const isBlocked = blockedIps.has(row.ip)
              return (
              <React.Fragment key={row.ip}>
                <tr
                  className={clsx(
                    'border-t border-prussian-500 hover:bg-prussian-500/40 cursor-pointer transition-colors',
                    isBlocked && 'bg-dustyred-400/5'
                  )}
                  onClick={() => setExpanded(expanded === row.ip ? null : row.ip)}
                >
                  <td className="px-4 py-3 font-mono text-moonstone-300">
                    <div className="flex items-center gap-2">
                      <Icon
                        icon={expanded === row.ip ? 'ph:caret-down' : 'ph:caret-right'}
                        className="text-errorgrey shrink-0"
                      />
                      <span className={isBlocked ? 'line-through text-errorgrey' : ''}>{row.ip}</span>
                      {row.bot_hits > 0 && row.human_hits === 0 && (
                        <span className="text-xs bg-dustyred-400/10 text-dustyred-300 border border-dustyred-700 rounded px-1.5 py-0.5">{t('network.badgeBot')}</span>
                      )}
                      {isBlocked && (
                        <span className="text-xs bg-dustyred-400/15 text-dustyred-400 border border-dustyred-700/60 rounded px-1.5 py-0.5 font-semibold">{t('network.badgeBlocked')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base leading-none">{countryFlag(row.country_code)}</span>
                      <span className="text-errorgrey text-xs">{row.country || '—'}</span>
                      {row.city && <span className="text-prussian-300 text-xs hidden xl:inline">· {row.city}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-bold">{row.hits.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-dustyred-300 hidden md:table-cell">{row.bot_hits.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-400 hidden md:table-cell">{row.human_hits.toLocaleString()}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      <StatusBadge value={row.s2xx} total={row.hits} color="text-green-400 bg-green-400/10" />
                      <StatusBadge value={row.s3xx} total={row.hits} color="text-yellow-400 bg-yellow-400/10" />
                      <StatusBadge value={row.s4xx} total={row.hits} color="text-orange-400 bg-orange-400/10" />
                      <StatusBadge value={row.s5xx} total={row.hits} color="text-dustyred-400 bg-dustyred-400/10" />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-errorgrey text-xs hidden lg:table-cell truncate max-w-[120px]">
                    {row.bot_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-errorgrey text-xs hidden sm:table-cell">
                    {dayjs(row.last_seen).format('DD/MM HH:mm')}
                  </td>
                  <td
                    className="px-3 py-3 text-right"
                    onClick={e => e.stopPropagation()}
                  >
                    {isBlocked ? (
                      <button
                        onClick={() => handleUnblock(row.ip)}
                        title={t('blocklist.unblockTitle')}
                        className="text-green-400 hover:text-green-300 transition-colors p-1"
                      >
                        <Icon icon="ph:lock-open" className="text-base" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setBlockModal(row.ip)}
                        title={t('network.blockModalTitle')}
                        className="text-errorgrey hover:text-moonstone-400 transition-colors p-1"
                      >
                        <Icon icon="ph:plus-circle" className="text-base" />
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === row.ip && (
                  <IpUrlDetail ip={row.ip} range={range} siteId={siteId} />
                )}
              </React.Fragment>
            )})}

            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-errorgrey">{t('network.emptyIps')}</td></tr>
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
    </div>
  )
}

// ── Onglet User-Agents ────────────────────────────────────
function UserAgentsTab({ range, siteId }) {
  const { t } = useTranslation()
  const [rows, setRows]           = useState([])
  const [total, setTotal]         = useState(0)
  const [offset, setOffset]       = useState(0)
  const [loading, setLoading]     = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch]       = useState('')
  const [botFilter, setBotFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { sort: uaSort, toggleSort: toggleUaSort } = useSort('hits', 'desc')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = { ...range, limit: PAGE_SIZE, offset, sort: uaSort.by, dir: uaSort.dir }
    if (botFilter !== '') params.bot = botFilter
    if (debouncedSearch) params.search = debouncedSearch
    if (siteId) params.siteId = siteId
    api.get('/network/user-agents', { params })
      .then(r => { setRows(r.data.rows); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [range, offset, botFilter, debouncedSearch, siteId, uaSort])

  function exportCSV() {
    setExporting(true)
    const token = localStorage.getItem('spider_token')
    const params = new URLSearchParams({ from: range.from, to: range.to })
    if (botFilter !== '') params.set('bot', botFilter)
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (siteId) params.set('siteId', siteId)
    fetch(`/api/network/user-agents/export?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `spider-lens-user-agents-${range.from}-${range.to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .finally(() => setExporting(false))
  }

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setOffset(0) }, [range, botFilter, debouncedSearch, siteId, uaSort])

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-prussian-600 border border-prussian-500 rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-xs">
          <Icon icon="ph:magnifying-glass" className="text-errorgrey shrink-0" />
          <input
            type="text"
            placeholder={t('network.filterUa')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-white text-sm flex-1 outline-none placeholder-errorgrey"
          />
        </div>
        <div className="flex gap-1">
          {[['', t('network.filterAll')], ['0', t('network.filterHumans')], ['1', t('network.filterBots')]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setBotFilter(val)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                botFilter === val
                  ? 'bg-moonstone-400/20 text-moonstone-300 border border-moonstone-600'
                  : 'bg-prussian-600 text-errorgrey border border-prussian-500 hover:text-white'
              )}
            >{label}</button>
          ))}
        </div>
        <span className="text-errorgrey text-sm">{total.toLocaleString()} {t('network.totalUa')}</span>
        <button
          onClick={exportCSV}
          disabled={exporting || total === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-600 border border-prussian-500 rounded-lg text-xs font-semibold text-errorgrey hover:text-white transition-colors disabled:opacity-40"
        >
          <Icon icon="ph:download-simple" className="text-sm" />
          {exporting ? t('common.exporting') : t('common.csv')}
        </button>
      </div>

      <div className="bg-prussian-600 rounded-xl border border-prussian-500 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-prussian-700 text-errorgrey text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">{t('network.headerUa')}</th>
              <th className="text-center px-4 py-3">{t('network.headerType')}</th>
              <SortableHeader col="bot_name" sort={uaSort} onSort={toggleUaSort} align="left" className="px-4 hidden md:table-cell">{t('network.headerBotName')}</SortableHeader>
              <SortableHeader col="hits" sort={uaSort} onSort={toggleUaSort} className="px-4">{t('network.headerHits')}</SortableHeader>
              <SortableHeader col="last_seen" sort={uaSort} onSort={toggleUaSort} className="px-4 hidden sm:table-cell">{t('network.headerLastVisit')}</SortableHeader>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="py-12 text-center">
                <div className="w-6 h-6 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && rows.map((row, i) => (
              <tr key={i} className="border-t border-prussian-500 hover:bg-prussian-500/40">
                <td className="px-4 py-3 font-mono text-xs text-lightgrey truncate max-w-[300px]">{row.user_agent}</td>
                <td className="px-4 py-3 text-center">
                  {row.is_bot
                    ? <span className="text-xs bg-dustyred-400/10 text-dustyred-300 border border-dustyred-700 rounded px-1.5 py-0.5">{t('network.typeBot')}</span>
                    : <span className="text-xs bg-green-400/10 text-green-400 border border-green-700 rounded px-1.5 py-0.5">{t('network.typeHuman')}</span>
                  }
                </td>
                <td className="px-4 py-3 text-errorgrey text-xs hidden md:table-cell">{row.bot_name || '—'}</td>
                <td className="px-4 py-3 text-right text-white font-bold">{row.hits.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-errorgrey text-xs hidden sm:table-cell">
                  {dayjs(row.last_seen).format('DD/MM HH:mm')}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center text-errorgrey">{t('network.emptyUa')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
    </div>
  )
}

// ── Page principale ───────────────────────────────────────
export default function Network() {
  const { t } = useTranslation()
  const { activeSiteId } = useSite()
  const [range, setRange] = usePersistentRange('network')
  const [tab, setTab] = useState('ips')

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:network"
        title={t('network.welcomeTitle')}
        tips={[
          t('network.tip1'),
          t('network.tip2'),
          t('network.tip3'),
          t('network.tip4'),
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('network.tabIps')}</h2>
          <p className="text-errorgrey text-sm">{t('network.tabUa')}</p>
        </div>
        <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-prussian-700 p-1 rounded-xl w-fit">
        {[['ips', 'ph:network', t('network.tabIps')], ['user-agents', 'ph:browser', t('network.tabUa')]].map(([id, icon, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              tab === id
                ? 'bg-prussian-500 text-white'
                : 'text-errorgrey hover:text-white'
            )}
          >
            <Icon icon={icon} className="text-base" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'ips' ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <IpsTab range={range} siteId={activeSiteId} />
            </div>
            <div>
              <TopCountriesWidget range={range} siteId={activeSiteId} botFilter="" />
            </div>
          </div>
        </div>
      ) : (
        <UserAgentsTab range={range} siteId={activeSiteId} />
      )}
    </div>
  )
}
