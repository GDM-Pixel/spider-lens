import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { Icon, addIcon } from '@iconify/react'

addIcon('fa-custom:gauge-low', {
  width: 512,
  height: 512,
  body: '<path fill="currentColor" d="M256 464a208 208 0 1 0 0-416 208 208 0 1 0 0 416zM256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zm32 112a32 32 0 1 1 -64 0 32 32 0 1 1 64 0zM256 408c-30.9 0-56-25.1-56-56c0-14 5.1-26.8 13.7-36.6L146 161.7c-5.3-12.1 .2-26.3 12.3-31.6s26.3 .2 31.6 12.3L257.6 296c30.2 .8 54.4 25.6 54.4 56c0 30.9-25.1 56-56 56zM384 160a32 32 0 1 1 -64 0 32 32 0 1 1 64 0zm16 64a32 32 0 1 1 0 64 32 32 0 1 1 0-64zM144 256a32 32 0 1 1 -64 0 32 32 0 1 1 64 0z"/>',
})
import ChartTooltip from '../components/ui/ChartTooltip'
import * as XLSX from 'xlsx'
import DateRangePicker from '../components/ui/DateRangePicker'
import InfoBubble from '../components/ui/InfoBubble'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import KPICard from '../components/ui/KPICard'
import { usePersistentRange } from '../hooks/usePersistentRange'
import { useSort } from '../hooks/useSort'
import SortableHeader from '../components/ui/SortableHeader'
import { useSite } from '../context/SiteContext'
import { useChat } from '../context/ChatContext'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import { kpiVariants } from '../components/ui/KPICard'

const DEFAULT_FROM = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
const DEFAULT_TO   = dayjs().format('YYYY-MM-DD')

// Seuils TTFB (Google Core Web Vitals + convention SEO)
const THRESHOLD_FAST = 200   // vert  : excellent
const THRESHOLD_OK   = 800   // orange: acceptable
// > 800ms = lent (rouge)

function ttfbColor(ms) {
  if (ms <= THRESHOLD_FAST) return '#10b981'  // emerald
  if (ms <= THRESHOLD_OK)   return '#f59e0b'  // amber
  return '#d62246'                             // dustyred
}

function ttfbLabel(ms, t) {
  if (ms <= THRESHOLD_FAST) return { label: t('ttfb.fast'),     cls: 'bg-emerald-400/15 text-emerald-300 border-emerald-800' }
  if (ms <= THRESHOLD_OK)   return { label: t('ttfb.ok'), cls: 'bg-amber-400/15 text-amber-300 border-amber-800' }
  return                           { label: t('ttfb.slow'),       cls: 'bg-dustyred-400/15 text-dustyred-300 border-dustyred-800' }
}

const PAGE_SIZE = 50

export default function TTFB() {
  const { t } = useTranslation()
  const { activeSiteId } = useSite()
  const { setPageContext, clearPageContext } = useChat()
  const [range, setRange]           = usePersistentRange('ttfb')
  const [threshold, setThreshold]   = useState(800)   // seuil "lent" configurable
  const [overview, setOverview]     = useState(null)
  const [byDay, setByDay]           = useState([])
  const [byUrl, setByUrl]           = useState([])
  const [urlTotal, setUrlTotal]     = useState(0)
  const [urlPage, setUrlPage]       = useState(0)
  const { sort: sortState, toggleSort } = useSort('avg_ms', 'desc')
  const [botFilter, setBotFilter]   = useState('all')
  const [search, setSearch]         = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [onlySlow, setOnlySlow]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [exporting, setExporting]   = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Reset page
  useEffect(() => { setUrlPage(0) }, [range, threshold, sortState, botFilter, debouncedSearch, onlySlow, activeSiteId])

  // Charger overview + courbe
  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/stats/ttfb/overview', { params: { ...range, threshold } }),
      api.get('/stats/ttfb/by-day',   { params: range }),
    ]).then(([ov, bd]) => {
      setOverview(ov.data)
      setByDay(bd.data)
    }).finally(() => setLoading(false))
  }, [range, threshold, activeSiteId])

  useEffect(() => {
    if (overview) {
      setPageContext({
        page: 'ttfb',
        avgTTFB: overview.avg_ttfb,
        slowCount: overview.slow_count,
        total: overview.total,
        threshold,
      })
    }
    return () => clearPageContext()
  }, [overview, threshold])

  // Charger tableau URLs
  useEffect(() => {
    setLoadingUrl(true)
    const params = {
      ...range,
      sort:   sortState.by,
      dir:    sortState.dir,
      limit:  PAGE_SIZE,
      offset: urlPage * PAGE_SIZE,
      threshold: onlySlow ? threshold : 0,
    }
    if (botFilter !== 'all') params.bot = botFilter
    if (debouncedSearch)     params.search = debouncedSearch

    api.get('/stats/ttfb/by-url', { params })
      .then(r => { setByUrl(r.data); setUrlTotal(r.data.length + urlPage * PAGE_SIZE) })
      .finally(() => setLoadingUrl(false))
  }, [range, threshold, sortState, botFilter, debouncedSearch, onlySlow, urlPage, activeSiteId])

  // Export CSV
  function exportCSV() {
    setExporting(true)
    const token = localStorage.getItem('spider_token')
    const params = new URLSearchParams({
      from: range.from, to: range.to,
      threshold: onlySlow ? threshold : 0,
    })
    if (botFilter !== 'all') params.set('bot', botFilter)
    fetch(`/api/stats/ttfb/by-url/export?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `spider-lens-ttfb-${range.from}-${range.to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .finally(() => setExporting(false))
  }

  // Export Excel
  function exportExcel() {
    setExporting(true)
    api.get('/stats/ttfb/by-url', { params: { ...range, sort: sortState.by, dir: sortState.dir, limit: 10000, threshold: onlySlow ? threshold : 0 } })
      .then(r => {
        const data = r.data.map(row => ({
          'URL':              row.url,
          [t('ttfb.headerAvg')]:  row.avg_ms,
          [t('ttfb.headerMin')]:    row.min_ms,
          [t('ttfb.headerMax')]:    row.max_ms,
          [t('ttfb.headerHits')]:         row.hits,
          [t('ttfb.headerStatus')]:           row.avg_ms <= 200 ? t('ttfb.fast') : row.avg_ms <= 800 ? t('ttfb.ok') : t('ttfb.slow'),
          [t('ttfb.headerLastSeen')]:     dayjs(row.last_seen).format('DD/MM/YYYY HH:mm'),
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        ws['!cols'] = [{ wch: 55 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 20 }]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'TTFB')
        XLSX.writeFile(wb, `spider-lens-ttfb-${range.from}-${range.to}.xlsx`)
      })
      .finally(() => setExporting(false))
  }

  const totalPages = Math.ceil(urlTotal / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-6">

      <BeginnerBanner
        icon="ph:timer"
        title={t('ttfb.welcomeTitle')}
        tips={[
          t('ttfb.tip1'),
          t('ttfb.tip2'),
          t('ttfb.tip3'),
          t('ttfb.tip4'),
          t('ttfb.tip5'),
        ]}
      />

      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('ttfb.welcomeTitle')}</h2>
          <p className="text-errorgrey text-sm">Time To First Byte — temps de réponse serveur par URL</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Seuil "lent" configurable */}
          <div className="flex items-center gap-2 bg-prussian-500 border border-prussian-400 rounded-lg px-3 py-2">
            <Icon icon="ph:timer" className="text-errorgrey text-base shrink-0" />
            <span className="text-errorgrey text-xs whitespace-nowrap">{t('ttfb.thresholdLabel')}:</span>
            <input
              type="number" min="100" max="5000" step="100"
              value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value) || 1000)}
              className="w-16 bg-transparent text-white text-sm focus:outline-none"
            />
            <span className="text-errorgrey text-xs">{t('ttfb.thresholdUnit')}</span>
          </div>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-4"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          >
            <KPICard
              label={t('ttfb.kpiAvgTTFB')}
              value={`${overview?.avg_ms?.toLocaleString('fr-FR')} ms`}
              icon="ph:gauge"
              color={overview?.avg_ms <= 200 ? 'green' : overview?.avg_ms <= 800 ? 'amber' : 'dustyred'}
              info={t('ttfb.kpiAvgTTFBInfo')}
            />
            <KPICard
              label={t('ttfb.kpiSlowPages', { threshold })}
              value={overview?.slow_count?.toLocaleString('fr-FR')}
              icon="fa-custom:gauge-low"
              color="dustyred"
              info={t('ttfb.kpiSlowPagesInfo', { threshold })}
            />
            <KPICard
              label={t('ttfb.kpiSlowPercent')}
              value={`${overview?.slow_pct}%`}
              icon="ph:warning"
              color={parseFloat(overview?.slow_pct) > 20 ? 'dustyred' : 'amber'}
              info={t('ttfb.kpiSlowPercentInfo')}
            />
            <KPICard
              label={t('ttfb.kpiFastPages')}
              value={overview?.fast_count?.toLocaleString('fr-FR')}
              icon="ph:lightning"
              color="green"
              info={t('ttfb.kpiFastPagesInfo')}
            />
          </motion.div>

          {/* Répartition rapide/ok/lent */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: `≤ 200ms — ${t('ttfb.fast')}`,     count: overview?.fast_count, color: '#10b981', pct: overview?.total > 0 ? (overview.fast_count / overview.total * 100).toFixed(1) : 0 },
              { label: `201–800ms — ${t('ttfb.ok')}`, count: overview?.ok_count,   color: '#f59e0b', pct: overview?.total > 0 ? (overview.ok_count  / overview.total * 100).toFixed(1) : 0 },
              { label: `> 800ms — ${t('ttfb.slow')}`,         count: overview?.warn_count, color: '#d62246', pct: overview?.total > 0 ? (overview.warn_count / overview.total * 100).toFixed(1) : 0 },
            ].map(({ label, count, color, pct }) => (
              <div key={label} className="bg-prussian-500 border border-prussian-400 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-errorgrey font-semibold">{label}</span>
                  <span className="text-white font-bold text-lg">{pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-prussian-400 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="text-errorgrey text-xs">{count?.toLocaleString('fr-FR')} {t('ttfb.requests')}</span>
              </div>
            ))}
          </div>

          {/* Courbe évolution */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-white font-bold text-sm">{t('ttfb.chartEvolutionTitle')}</h3>
              <InfoBubble
                title={t('ttfb.chartEvolutionInfo')}
                content={t('ttfb.chartEvolutionContent')}
                impact={t('ttfb.chartEvolutionImpact')}
                action={t('ttfb.chartEvolutionAction')}
              />
            </div>
            {byDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={byDay} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="ttfbGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00c6e0" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00c6e0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#273043" />
                  <XAxis dataKey="day" tick={{ fill: '#898989', fontSize: 11 }} tickFormatter={v => dayjs(v).format('DD/MM')} />
                  <YAxis tick={{ fill: '#898989', fontSize: 11 }} unit="ms" />
                  <Tooltip content={<ChartTooltip labelFormatter={v => dayjs(v).format('DD/MM/YYYY')} unit=" ms" />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#d1d1d1' }} />
                  {/* Lignes de référence */}
                  <ReferenceLine y={200} stroke="#10b981" strokeDasharray="4 4" label={{ value: '200ms', fill: '#10b981', fontSize: 10, position: 'right' }} />
                  <ReferenceLine y={800} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '800ms', fill: '#f59e0b', fontSize: 10, position: 'right' }} />
                  <ReferenceLine y={threshold} stroke="#d62246" strokeDasharray="4 4" label={{ value: `${threshold}ms`, fill: '#d62246', fontSize: 10, position: 'right' }} />
                  <Area type="monotone" dataKey="avg_ms" name={t('ttfb.chartEvolutionTitle')} stroke="#00c6e0" strokeWidth={2} fill="url(#ttfbGrad)" dot={false} />
                  <Line type="monotone" dataKey="max_ms" name={`${t('ttfb.headerMax')} (TTFB)`} stroke="#d62246" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40">
                <p className="text-errorgrey text-sm">{t('common.noData')}</p>
              </div>
            )}
          </div>

          {/* Tableau URLs */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 overflow-hidden">

            {/* Barre filtres */}
            <div className="p-4 border-b border-prussian-400 flex flex-wrap gap-3 items-center">

              {/* N'afficher que les pages lentes */}
              <button
                onClick={() => setOnlySlow(s => !s)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  onlySlow
                    ? 'bg-dustyred-400 border-dustyred-400 text-white'
                    : 'bg-transparent border-prussian-400 text-errorgrey hover:text-white'
                )}
              >
                <Icon icon="fa-custom:gauge-low" className="text-base" />
                {t('ttfb.filterSlowPages', { threshold })}
              </button>

              {/* Filtre bots */}
              <div className="flex gap-1 bg-prussian-600 rounded-lg p-1">
                {[
                  { val: 'all', label: t('common.all') },
                  { val: '0', label: t('common.humans') },
                  { val: '1', label: t('common.bots') }
                ].map(opt => (
                  <button key={opt.val} onClick={() => setBotFilter(opt.val)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${botFilter === opt.val ? 'bg-prussian-400 text-white' : 'text-errorgrey hover:text-white'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Recherche */}
              <div className="relative flex-1 min-w-[160px]">
                <Icon icon="ph:magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-sm" />
                <input
                  type="text" placeholder={t('ttfb.searchPlaceholder')} value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-prussian-600 border border-prussian-400 rounded-lg pl-8 pr-3 py-1.5 text-white text-sm placeholder:text-errorgrey focus:outline-none focus:border-moonstone-600 transition-colors"
                />
                {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-errorgrey hover:text-white"><Icon icon="ph:x" className="text-sm" /></button>}
              </div>

              {/* Exports */}
              <div className="flex gap-2 ml-auto">
                <button onClick={exportCSV} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50">
                  <Icon icon="ph:file-csv" className="text-base text-moonstone-400" />{t('common.csv')}
                </button>
                <button onClick={exportExcel} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50">
                  <Icon icon="ph:microsoft-excel-logo" className="text-base text-emerald-400" />{t('common.excel')}
                </button>
              </div>
            </div>

            {/* Loader + compteur */}
            <div className="flex items-center justify-between px-5 py-2 border-b border-prussian-400 bg-prussian-600/30">
              <p className="text-errorgrey text-xs">
                {loadingUrl ? '…' : <><><span className="text-white font-semibold">{byUrl.length}</span> {t('ttfb.urlsCount', { count: byUrl.length })}</>{onlySlow && <span className="text-dustyred-300"> · {t('ttfb.slowOnly')}</span>}</>}
              </p>
              {loadingUrl && (
                <div className="flex items-center gap-2 text-moonstone-300 text-xs font-semibold">
                  <div className="w-4 h-4 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
                  {t('common.loading')}
                </div>
              )}
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-prussian-400 bg-prussian-600/20">
                    <SortableHeader col="url" sort={sortState} onSort={toggleSort} align="left" className="px-5">
                      {t('ttfb.headerUrl')}
                    </SortableHeader>
                    <SortableHeader col="avg_ms" sort={sortState} onSort={toggleSort}>
                      {t('ttfb.headerAvg')}
                    </SortableHeader>
                    <SortableHeader col="min_ms" sort={sortState} onSort={toggleSort}>
                      {t('ttfb.headerMin')}
                    </SortableHeader>
                    <SortableHeader col="max_ms" sort={sortState} onSort={toggleSort}>
                      {t('ttfb.headerMax')}
                    </SortableHeader>
                    <th className="text-center text-xs font-semibold text-errorgrey px-3 py-3">{t('ttfb.headerStatus')}</th>
                    <SortableHeader col="hits" sort={sortState} onSort={toggleSort}>
                      {t('ttfb.headerHits')}
                    </SortableHeader>
                    <SortableHeader col="last_seen" sort={sortState} onSort={toggleSort} className="px-5">
                      {t('ttfb.headerLastSeen')}
                    </SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {byUrl.length === 0 && !loadingUrl ? (
                    <tr><td colSpan={7} className="text-center text-errorgrey text-sm py-14">
                      <Icon icon="ph:gauge" className="text-3xl mb-2 block mx-auto text-prussian-400" />
                      {t('common.noData')}
                    </td></tr>
                  ) : byUrl.map((row, i) => {
                    const badge = ttfbLabel(row.avg_ms, t)
                    return (
                      <tr key={row.url} className={clsx('border-b border-prussian-400/40 hover:bg-prussian-400/20 transition-colors', i % 2 !== 0 && 'bg-prussian-600/20')}>
                        <td className="px-5 py-2.5">
                          <span className="text-moonstone-400 text-xs font-mono">{row.url}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-bold text-sm" style={{ color: ttfbColor(row.avg_ms) }}>{row.avg_ms} ms</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-errorgrey text-sm">{row.min_ms} ms</td>
                        <td className="px-3 py-2.5 text-right text-errorgrey text-sm">{row.max_ms} ms</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-white text-sm font-semibold">{row.hits.toLocaleString('fr-FR')}</td>
                        <td className="px-5 py-2.5 text-right text-errorgrey text-xs whitespace-nowrap">
                          {dayjs(row.last_seen).format('DD/MM/YYYY HH:mm')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
