import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import KPICard from '../components/ui/KPICard'
import SortableHeader from '../components/ui/SortableHeader'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import DateRangePicker from '../components/ui/DateRangePicker'
import { usePersistentRange } from '../hooks/usePersistentRange'
import { useSort } from '../hooks/useSort'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'
import { usePageContext } from '../hooks/usePageContext'

export default function HttpCodes() {
  const { t } = useTranslation()
  const [range, setRange] = usePersistentRange('http-codes')
  const [overview, setOverview] = useState(null)

  usePageContext(() =>
    Promise.all([
      api.get('/stats/http-codes', { params: range }),
      api.get('/stats/overview',   { params: range }),
    ]).then(([http, ov]) => ({
      page:      'HTTP Codes',
      range,
      overview:  ov.data,
      httpCodes: http.data?.slice(0, 20),
    }))
  )
  const [httpData, setHttpData] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [botFilter, setBotFilter] = useState('')
  const [search, setSearch] = useState('')
  const [detailOffset, setDetailOffset] = useState(0)
  const [detail, setDetail] = useState({ rows: [], total: 0 })
  const [detailLoading, setDetailLoading] = useState(false)
  const { sort, toggleSort } = useSort('hits', 'desc')
  const DETAIL_LIMIT = 50

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to })
      const url = `${window.spiderLens.apiBase}/stats/http-codes/export?${params}`
      const res = await fetch(url, { headers: { 'X-WP-Nonce': window.spiderLens.nonce }, credentials: 'same-origin' })
      if (res.ok) {
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `http-codes-${range.from}-${range.to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch (err) { console.error('Export error:', err) }
    finally { setExporting(false) }
  }

  useEffect(() => {
    setDetailOffset(0)
  }, [range, statusFilter, botFilter, search, sort])

  useEffect(() => {
    setDetailLoading(true)
    api.get('/stats/url-detail', {
      params: {
        ...range,
        status: statusFilter || undefined,
        bot: botFilter || undefined,
        search: search || undefined,
        sort: sort.by,
        dir: sort.dir,
        limit: DETAIL_LIMIT,
        offset: detailOffset,
      },
    })
      .then(res => setDetail(res.data || { rows: [], total: 0 }))
      .catch(err => console.error('Erreur drill-down:', err))
      .finally(() => setDetailLoading(false))
  }, [range, statusFilter, botFilter, search, sort, detailOffset])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/stats/http-codes', { params: range }),
      api.get('/stats/overview', { params: range }),
    ])
      .then(([httpRes, overRes]) => {
        setHttpData(httpRes.data)
        setOverview(overRes.data)
      })
      .catch(err => console.error('Erreur chargement HTTP codes:', err))
      .finally(() => setLoading(false))
  }, [range])

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:chart-line"
        title={t('httpCodes.welcomeTitle')}
        tips={[
          t('httpCodes.tip1'),
          t('httpCodes.tip2'),
          t('httpCodes.tip3'),
          t('httpCodes.tip4'),
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('httpCodes.chartTitle')}</h2>
          <p className="text-errorgrey text-sm">{t('httpCodes.chartInfo')}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm disabled:opacity-50"
          >
            <Icon icon="ph:download" className="text-base" />
            {exporting ? t('common.exporting') : t('common.csv')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label={t('httpCodes.kpi2xx')}
              value={parseInt(overview?.s2xx || 0).toLocaleString('fr-FR')}
              icon="ph:check-circle"
              color="green"
              info={t('httpCodes.kpi2xxInfo')}
            />
            <KPICard
              label={t('httpCodes.kpi3xx')}
              value={parseInt(overview?.s3xx || 0).toLocaleString('fr-FR')}
              icon="ph:arrows-clockwise"
              color="amber"
              info={t('httpCodes.kpi3xxInfo')}
            />
            <KPICard
              label={t('httpCodes.kpi4xx')}
              value={parseInt(overview?.s4xx || 0).toLocaleString('fr-FR')}
              icon="ph:x-circle"
              color="dustyred"
              info={t('httpCodes.kpi4xxInfo')}
            />
            <KPICard
              label={t('httpCodes.kpi5xx')}
              value={parseInt(overview?.s5xx || 0).toLocaleString('fr-FR')}
              icon="ph:warning-octagon"
              color="dustyred"
              info={t('httpCodes.kpi5xxInfo')}
            />
          </div>

          {/* Drill-down URL detail */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-white font-bold text-sm">{t('httpCodes.chartTitle')}</h3>
              <div className="flex flex-wrap gap-2 items-center">
                {/* Filtre status */}
                <div className="flex gap-1 flex-wrap">
                  {[
                    { val: '', label: t('common.all') },
                    { val: '2xx', label: '2xx' },
                    { val: '3xx', label: '3xx' },
                    { val: '404', label: '404' },
                    { val: '4xx', label: '4xx' },
                    { val: '5xx', label: '5xx' },
                  ].map(f => (
                    <button
                      key={f.val}
                      onClick={() => setStatusFilter(f.val)}
                      className={clsx(
                        'px-2 py-1 rounded text-xs font-semibold transition-colors',
                        statusFilter === f.val
                          ? 'bg-moonstone-400 text-prussian-700'
                          : 'bg-prussian-600 text-errorgrey hover:text-white'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {/* Filtre bot */}
                <select
                  value={botFilter}
                  onChange={e => setBotFilter(e.target.value)}
                  className="bg-prussian-600 border border-prussian-500 text-errorgrey text-xs rounded px-2 py-1"
                >
                  <option value="">{t('common.all')}</option>
                  <option value="0">{t('common.humans')}</option>
                  <option value="1">{t('common.bots')}</option>
                </select>
                {/* Recherche URL */}
                <input
                  type="text"
                  placeholder={t('httpCodes.searchPlaceholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-prussian-600 border border-prussian-500 text-white text-xs rounded px-2 py-1 w-40 focus:outline-none focus:border-moonstone-400"
                />
              </div>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : detail.rows.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-prussian-400">
                        <SortableHeader col="url" sort={sort} onSort={toggleSort} align="left">{t('common.url')}</SortableHeader>
                        <SortableHeader col="status_code" sort={sort} onSort={toggleSort}>{t('common.status')}</SortableHeader>
                        <SortableHeader col="hits" sort={sort} onSort={toggleSort}>{t('common.hits')}</SortableHeader>
                        <SortableHeader col="human_hits" sort={sort} onSort={toggleSort}>{t('common.humans')}</SortableHeader>
                        <SortableHeader col="bot_hits" sort={sort} onSort={toggleSort}>{t('common.bots')}</SortableHeader>
                        <SortableHeader col="last_seen" sort={sort} onSort={toggleSort}>{t('common.lastSeen')}</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.rows.map((row, i) => (
                        <tr key={i} className="border-b border-prussian-600 hover:bg-prussian-400/30 transition-colors">
                          <td className="px-3 py-2 text-moonstone-400 text-xs truncate max-w-sm">{row.url}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded', {
                              'text-green-400': row.status_code >= 200 && row.status_code < 300,
                              'text-amber-400': row.status_code >= 300 && row.status_code < 400,
                              'text-dustyred-400': row.status_code >= 400,
                            })}>
                              {row.status_code}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-white font-semibold text-xs">{parseInt(row.hits).toLocaleString('fr-FR')}</td>
                          <td className="px-3 py-2 text-right text-lightgrey text-xs">{parseInt(row.human_hits).toLocaleString('fr-FR')}</td>
                          <td className="px-3 py-2 text-right text-lightgrey text-xs">{parseInt(row.bot_hits).toLocaleString('fr-FR')}</td>
                          <td className="px-3 py-2 text-right text-errorgrey text-xs">{row.last_seen ? dayjs(row.last_seen).format('DD/MM/YY') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {detail.total > DETAIL_LIMIT && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-errorgrey text-xs">{detail.total} {t('common.results')}</span>
                    <div className="flex gap-2">
                      <button
                        disabled={detailOffset === 0}
                        onClick={() => setDetailOffset(o => Math.max(0, o - DETAIL_LIMIT))}
                        className="px-3 py-1 text-xs bg-prussian-600 text-errorgrey rounded disabled:opacity-40 hover:text-white"
                      >{t('common.previous')}</button>
                      <button
                        disabled={detailOffset + DETAIL_LIMIT >= detail.total}
                        onClick={() => setDetailOffset(o => o + DETAIL_LIMIT)}
                        className="px-3 py-1 text-xs bg-prussian-600 text-errorgrey rounded disabled:opacity-40 hover:text-white"
                      >{t('common.next')}</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-errorgrey text-sm text-center py-8">{t('common.noResults')}</p>
            )}
          </div>

          {/* Graphique */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
            <h3 className="text-white font-bold text-sm mb-4">{t('httpCodes.chartTitle')}</h3>
            {httpData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={httpData}>
                  <defs>
                    <linearGradient id="g2xx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g3xx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g4xx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d62246" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#d62246" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g5xx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9f1934" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#9f1934" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#273043" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: '#898989', fontSize: 11 }}
                    tickFormatter={v => dayjs(v).format('DD/MM')}
                  />
                  <YAxis tick={{ fill: '#898989', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }}
                    labelFormatter={v => dayjs(v).format('DD/MM/YYYY')}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#d1d1d1' }} />
                  <Area type="monotone" dataKey="s2xx" name="2xx" stroke="#10b981" fill="url(#g2xx)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="s3xx" name="3xx" stroke="#f59e0b" fill="url(#g3xx)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="s4xx" name="4xx" stroke="#d62246" fill="url(#g4xx)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="s5xx" name="5xx" stroke="#9f1934" fill="url(#g5xx)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={t('common.noData')} />
            )}
          </div>
        </>
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
