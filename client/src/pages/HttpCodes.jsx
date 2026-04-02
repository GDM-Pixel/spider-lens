import React, { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { Icon } from '@iconify/react'
import * as XLSX from 'xlsx'
import DateRangePicker from '../components/ui/DateRangePicker'
import InfoBubble from '../components/ui/InfoBubble'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import KPICard from '../components/ui/KPICard'
import { usePersistentRange } from '../hooks/usePersistentRange'
import { useSite } from '../context/SiteContext'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

const DEFAULT_FROM = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
const DEFAULT_TO   = dayjs().format('YYYY-MM-DD')

const STATUS_GROUPS = [
  { key: 'all',  label: 'Tous',  color: '#d1d1d1', query: null },
  { key: '2xx',  label: '2xx',   color: '#00c6e0', query: '2xx' },
  { key: '3xx',  label: '3xx',   color: '#f59e0b', query: '3xx' },
  { key: '301',  label: '301',   color: '#fbbf24', query: '301' },
  { key: '302',  label: '302',   color: '#d97706', query: '302' },
  { key: '4xx',  label: '4xx',   color: '#d62246', query: '4xx' },
  { key: '404',  label: '404',   color: '#e13d5e', query: '404' },
  { key: '403',  label: '403',   color: '#b01c39', query: '403' },
  { key: '5xx',  label: '5xx',   color: '#9f1934', query: '5xx' },
  { key: '500',  label: '500',   color: '#7f1d1d', query: '500' },
]

const STATUS_BADGE_COLOR = {
  2: 'bg-moonstone-400/15 text-moonstone-300 border-moonstone-800',
  3: 'bg-amber-400/15 text-amber-300 border-amber-800',
  4: 'bg-dustyred-400/15 text-dustyred-300 border-dustyred-800',
  5: 'bg-red-900/30 text-red-300 border-red-900',
}

function statusBadge(code) {
  const cls = STATUS_BADGE_COLOR[Math.floor(code / 100)] || 'bg-prussian-400/30 text-lightgrey border-prussian-300'
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold border ${cls}`}>{code}</span>
}

const PAGE_SIZE = 50

export default function HttpCodes() {
  const { activeSiteId } = useSite()
  const [range, setRange] = usePersistentRange('http-codes')
  const [chartData, setChartData]   = useState([])
  const [overview, setOverview]     = useState(null)
  const [chartView, setChartView]   = useState('line')
  const [loadingChart, setLoadingChart] = useState(true)

  // ── Drill-down state ──────────────────────────────────
  const [activeFilter, setActiveFilter] = useState('all')
  const [botFilter, setBotFilter]       = useState('all')   // 'all' | '0' | '1'
  const [search, setSearch]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort]                 = useState({ by: 'hits', dir: 'desc' })
  const [drillRows, setDrillRows]       = useState([])
  const [drillTotal, setDrillTotal]     = useState(0)
  const [drillPage, setDrillPage]       = useState(0)
  const [loadingDrill, setLoadingDrill] = useState(false)
  const [exporting, setExporting]       = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Reset page quand filtre change
  useEffect(() => { setDrillPage(0) }, [activeFilter, botFilter, debouncedSearch, range, sort, activeSiteId])

  // ── Charger graphe + KPIs ────────────────────────────
  useEffect(() => {
    setLoadingChart(true)
    Promise.all([
      api.get('/stats/http-codes', { params: range }),
      api.get('/stats/overview',   { params: range }),
    ]).then(([http, ov]) => {
      setChartData(http.data)
      setOverview(ov.data)
    }).finally(() => setLoadingChart(false))
  }, [range, activeSiteId])

  // ── Charger tableau drill-down ────────────────────────
  useEffect(() => {
    setLoadingDrill(true)
    const group = STATUS_GROUPS.find(g => g.key === activeFilter)
    const params = {
      ...range,
      limit: PAGE_SIZE,
      offset: drillPage * PAGE_SIZE,
      sort: sort.by,
      dir: sort.dir,
    }
    if (group?.query) params.status = group.query
    if (botFilter !== 'all') params.bot = botFilter
    if (debouncedSearch) params.search = debouncedSearch

    api.get('/stats/url-detail', { params })
      .then(r => { setDrillRows(r.data.rows); setDrillTotal(r.data.total) })
      .finally(() => setLoadingDrill(false))
  }, [range, activeFilter, botFilter, debouncedSearch, sort, drillPage, activeSiteId])

  // ── Export CSV (via endpoint backend) ────────────────
  function exportCSV() {
    const group = STATUS_GROUPS.find(g => g.key === activeFilter)
    const params = new URLSearchParams({ from: range.from, to: range.to })
    if (group?.query) params.set('status', group.query)
    if (botFilter !== 'all') params.set('bot', botFilter)
    if (debouncedSearch) params.set('search', debouncedSearch)

    const token = localStorage.getItem('spider_token')
    const url = `/api/stats/url-detail/export?${params.toString()}`
    // Créer un lien temporaire avec le token dans l'URL n'est pas sécurisé
    // On préfère fetch + download
    setExporting(true)
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `spider-lens-${activeFilter}-${range.from}-${range.to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .finally(() => setExporting(false))
  }

  // ── Export Excel (côté client via xlsx) ──────────────
  function exportExcel() {
    setExporting(true)
    const group = STATUS_GROUPS.find(g => g.key === activeFilter)
    const params = {
      ...range, limit: 10000, offset: 0,
      sort: sort.by, dir: sort.dir,
    }
    if (group?.query) params.status = group.query
    if (botFilter !== 'all') params.bot = botFilter
    if (debouncedSearch) params.search = debouncedSearch

    api.get('/stats/url-detail', { params })
      .then(r => {
        const data = r.data.rows.map(row => ({
          'URL':                  row.url,
          'Code HTTP':            row.status_code,
          'Hits':                 row.hits,
          'Bots':                 row.bot_hits,
          'Humains':              row.human_hits,
          'Dernière vue':         dayjs(row.last_seen).format('DD/MM/YYYY HH:mm'),
          'User-Agent dominant':  row.top_ua || '',
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        // Largeurs de colonnes
        ws['!cols'] = [{ wch: 50 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 60 }]
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, `HTTP ${activeFilter}`)
        XLSX.writeFile(wb, `spider-lens-${activeFilter}-${range.from}-${range.to}.xlsx`)
      })
      .finally(() => setExporting(false))
  }

  // ── Tri colonnes ──────────────────────────────────────
  function toggleSort(col) {
    setSort(s => s.by === col
      ? { by: col, dir: s.dir === 'desc' ? 'asc' : 'desc' }
      : { by: col, dir: 'desc' }
    )
  }

  function SortIcon({ col }) {
    if (sort.by !== col) return <Icon icon="ph:arrows-down-up" className="text-prussian-300 text-xs ml-1" />
    return <Icon icon={sort.dir === 'desc' ? 'ph:arrow-down' : 'ph:arrow-up'} className="text-moonstone-400 text-xs ml-1" />
  }

  const totals = chartData.reduce((acc, d) => ({
    s2xx: (acc.s2xx || 0) + d.s2xx,
    s3xx: (acc.s3xx || 0) + d.s3xx,
    s4xx: (acc.s4xx || 0) + d.s4xx,
    s5xx: (acc.s5xx || 0) + d.s5xx,
  }), {})

  const totalPages = Math.ceil(drillTotal / PAGE_SIZE)
  const activeGroup = STATUS_GROUPS.find(g => g.key === activeFilter)

  return (
    <div className="flex flex-col gap-6">

      <BeginnerBanner
        icon="ph:globe"
        title="Analyse des codes HTTP"
        tips={[
          'Les codes 2xx indiquent des pages chargées avec succès. Les 3xx sont des redirections.',
          'Les 404 signalent des pages introuvables — à corriger ou rediriger pour préserver le SEO.',
          'Les 5xx révèlent des erreurs serveur — critiques si fréquents, car ils bloquent le crawl Google.',
          'Filtrez par code et exportez en CSV ou Excel pour travailler avec d\'autres outils (Screaming Frog, Excel...).',
        ]}
      />

      {/* ── En-tête ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">Codes HTTP</h2>
          <p className="text-errorgrey text-sm">Évolution et analyse des statuts de réponse</p>
        </div>
        <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      {loadingChart ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── KPIs ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="2xx Succès" value={totals.s2xx?.toLocaleString('fr-FR') || '0'}
              icon="ph:check-circle" color="green"
              info="Requêtes traitées avec succès." />
            <KPICard label="3xx Redirections" value={totals.s3xx?.toLocaleString('fr-FR') || '0'}
              icon="ph:arrows-clockwise" color="amber"
              info="Trop de redirections gaspillent le budget de crawl. Favorisez les redirections directes." />
            <KPICard label="4xx Erreurs client" value={totals.s4xx?.toLocaleString('fr-FR') || '0'}
              icon="ph:x-circle" color="dustyred"
              info="Pages introuvables ou accès refusés. Les 404 crawlés par Googlebot gaspillent le budget de crawl." />
            <KPICard label="5xx Erreurs serveur" value={totals.s5xx?.toLocaleString('fr-FR') || '0'}
              icon="ph:warning-octagon" color="dustyred"
              info="Erreurs critiques côté serveur. À résoudre en priorité." />
          </div>

          {/* ── Graphique ────────────────────────────── */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-sm">Évolution par jour</h3>
                <InfoBubble
                  title="Codes HTTP dans le temps"
                  content="Chaque point représente le volume de requêtes d'une famille de code HTTP pour un jour donné."
                  impact="Les pics de 4xx/5xx sont souvent corrélés à des mises en production problématiques ou des attaques."
                />
              </div>
              <div className="flex items-center gap-1 bg-prussian-600 rounded-lg p-1">
                {['line', 'bar'].map(v => (
                  <button key={v} onClick={() => setChartView(v)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${chartView === v ? 'bg-prussian-400 text-white' : 'text-errorgrey hover:text-white'}`}>
                    {v === 'line' ? 'Courbe' : 'Barres'}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                {chartView === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#273043" />
                    <XAxis dataKey="day" tick={{ fill: '#898989', fontSize: 11 }} tickFormatter={v => dayjs(v).format('DD/MM')} />
                    <YAxis tick={{ fill: '#898989', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }} labelFormatter={v => dayjs(v).format('DD/MM/YYYY')} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#d1d1d1' }} />
                    <Line type="monotone" dataKey="s2xx" name="2xx" stroke="#00c6e0" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="s3xx" name="3xx" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="s4xx" name="4xx" stroke="#d62246" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="s5xx" name="5xx" stroke="#9f1934" strokeWidth={2} dot={false} />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#273043" />
                    <XAxis dataKey="day" tick={{ fill: '#898989', fontSize: 11 }} tickFormatter={v => dayjs(v).format('DD/MM')} />
                    <YAxis tick={{ fill: '#898989', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }} labelFormatter={v => dayjs(v).format('DD/MM/YYYY')} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#d1d1d1' }} />
                    <Bar dataKey="s2xx" name="2xx" fill="#00c6e0" stackId="a" />
                    <Bar dataKey="s3xx" name="3xx" fill="#f59e0b" stackId="a" />
                    <Bar dataKey="s4xx" name="4xx" fill="#d62246" stackId="a" />
                    <Bar dataKey="s5xx" name="5xx" fill="#9f1934" stackId="a" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40">
                <p className="text-errorgrey text-sm">Aucune donnée</p>
              </div>
            )}
          </div>

          {/* ── Drill-down ───────────────────────────── */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 overflow-hidden">

            {/* Barre de filtres */}
            <div className="p-4 border-b border-prussian-400 flex flex-wrap gap-3 items-center">
              {/* Filtres code HTTP */}
              <div className="flex flex-wrap gap-1.5">
                {STATUS_GROUPS.map(g => (
                  <button key={g.key} onClick={() => setActiveFilter(g.key)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                      activeFilter === g.key
                        ? 'text-white border-transparent'
                        : 'bg-transparent text-errorgrey border-prussian-400 hover:text-white hover:border-prussian-300'
                    )}
                    style={activeFilter === g.key ? { backgroundColor: g.color, borderColor: g.color } : {}}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              <div className="h-5 w-px bg-prussian-400 hidden sm:block" />

              {/* Filtre bots/humains */}
              <div className="flex gap-1 bg-prussian-600 rounded-lg p-1">
                {[
                  { val: 'all', label: 'Tous' },
                  { val: '0',   label: 'Humains' },
                  { val: '1',   label: 'Bots' },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setBotFilter(opt.val)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${botFilter === opt.val ? 'bg-prussian-400 text-white' : 'text-errorgrey hover:text-white'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Recherche URL */}
              <div className="relative flex-1 min-w-[160px]">
                <Icon icon="ph:magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-sm" />
                <input
                  type="text"
                  placeholder="Filtrer par URL…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-prussian-600 border border-prussian-400 rounded-lg pl-8 pr-3 py-1.5 text-white text-sm placeholder:text-errorgrey focus:outline-none focus:border-moonstone-600 transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-errorgrey hover:text-white">
                    <Icon icon="ph:x" className="text-sm" />
                  </button>
                )}
              </div>

              {/* Exports */}
              <div className="flex gap-2 ml-auto">
                <button onClick={exportCSV} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50">
                  <Icon icon="ph:file-csv" className="text-base text-moonstone-400" />
                  CSV
                </button>
                <button onClick={exportExcel} disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-400 hover:bg-prussian-300 border border-prussian-300 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50">
                  <Icon icon="ph:microsoft-excel-logo" className="text-base text-emerald-400" />
                  Excel
                </button>
              </div>
            </div>

            {/* En-tête tableau + compteur */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-prussian-400 bg-prussian-600/40">
              <p className="text-errorgrey text-xs">
                {loadingDrill ? '…' : (
                  <><span className="text-white font-semibold">{drillTotal.toLocaleString('fr-FR')}</span> URLs
                  {activeFilter !== 'all' && <> · filtre <span className="font-bold" style={{ color: activeGroup?.color }}>{activeFilter}</span></>}
                  {botFilter === '1' && ' · bots seulement'}
                  {botFilter === '0' && ' · humains seulement'}
                  {debouncedSearch && <> · "<span className="text-white">{debouncedSearch}</span>"</>}
                  </>
                )}
              </p>
              {loadingDrill && <div className="w-4 h-4 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />}
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-prussian-400 bg-prussian-600/20">
                    <th className="text-left text-xs font-semibold text-errorgrey px-5 py-3 w-[40%]">URL</th>
                    <th className="text-center text-xs font-semibold text-errorgrey px-3 py-3">Code</th>
                    <th className="text-right text-xs font-semibold text-errorgrey px-3 py-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort('hits')}>
                      <span className="inline-flex items-center">Hits <SortIcon col="hits" /></span>
                    </th>
                    <th className="text-right text-xs font-semibold text-errorgrey px-3 py-3">Bots</th>
                    <th className="text-right text-xs font-semibold text-errorgrey px-3 py-3">Humains</th>
                    <th className="text-right text-xs font-semibold text-errorgrey px-5 py-3 cursor-pointer select-none hover:text-white"
                      onClick={() => toggleSort('last_seen')}>
                      <span className="inline-flex items-center">Dernière vue <SortIcon col="last_seen" /></span>
                    </th>
                    <th className="text-left text-xs font-semibold text-errorgrey px-5 py-3">User-Agent dominant</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.length === 0 && !loadingDrill ? (
                    <tr><td colSpan={7} className="text-center text-errorgrey text-sm py-16">
                      <Icon icon="ph:magnifying-glass-minus" className="text-3xl mb-2 block mx-auto text-prussian-400" />
                      Aucun résultat
                    </td></tr>
                  ) : drillRows.map((row, i) => (
                    <tr key={`${row.url}-${row.status_code}`}
                      className={clsx('border-b border-prussian-400/40 hover:bg-prussian-400/20 transition-colors',
                        i % 2 === 0 ? '' : 'bg-prussian-600/20')}>
                      <td className="px-5 py-2.5">
                        <span className="text-moonstone-400 text-xs font-mono break-all">{row.url}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">{statusBadge(row.status_code)}</td>
                      <td className="px-3 py-2.5 text-right text-white font-bold text-sm">{row.hits.toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-2.5 text-right text-errorgrey text-sm">{row.bot_hits.toLocaleString('fr-FR')}</td>
                      <td className="px-3 py-2.5 text-right text-errorgrey text-sm">{row.human_hits.toLocaleString('fr-FR')}</td>
                      <td className="px-5 py-2.5 text-right text-errorgrey text-xs whitespace-nowrap">
                        {dayjs(row.last_seen).format('DD/MM/YYYY HH:mm')}
                      </td>
                      <td className="px-5 py-2.5 max-w-[220px]">
                        <span className="text-errorgrey text-xs truncate block" title={row.top_ua || ''}>
                          {row.top_ua ? truncateUA(row.top_ua) : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-prussian-400 bg-prussian-600/20">
                <p className="text-errorgrey text-xs">
                  Page {drillPage + 1} / {totalPages}
                  {' '}· {drillTotal.toLocaleString('fr-FR')} résultats
                </p>
                <div className="flex gap-1">
                  <PagBtn onClick={() => setDrillPage(0)} disabled={drillPage === 0} icon="ph:caret-double-left" />
                  <PagBtn onClick={() => setDrillPage(p => p - 1)} disabled={drillPage === 0} icon="ph:caret-left" />
                  {/* Pages autour de l'actuelle */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(0, Math.min(drillPage - 2, totalPages - 5)) + i
                    return (
                      <button key={p} onClick={() => setDrillPage(p)}
                        className={clsx('w-8 h-8 rounded-lg text-xs font-semibold transition-colors',
                          p === drillPage ? 'bg-prussian-300 text-white' : 'text-errorgrey hover:bg-prussian-400 hover:text-white')}>
                        {p + 1}
                      </button>
                    )
                  })}
                  <PagBtn onClick={() => setDrillPage(p => p + 1)} disabled={drillPage >= totalPages - 1} icon="ph:caret-right" />
                  <PagBtn onClick={() => setDrillPage(totalPages - 1)} disabled={drillPage >= totalPages - 1} icon="ph:caret-double-right" />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function PagBtn({ onClick, disabled, icon }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-errorgrey hover:bg-prussian-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      <Icon icon={icon} className="text-sm" />
    </button>
  )
}

function truncateUA(ua) {
  // Extraire le browser/bot le plus lisible
  const bot = ua.match(/\(compatible;\s*([^;)]+)/)?.[1]
  if (bot) return bot
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[0]
  if (browser) return browser
  return ua.length > 50 ? ua.slice(0, 50) + '…' : ua
}
