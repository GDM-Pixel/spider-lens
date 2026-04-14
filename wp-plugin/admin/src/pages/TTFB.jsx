import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import KPICard from '../components/ui/KPICard'
import DateRangePicker from '../components/ui/DateRangePicker'
import { usePersistentRange } from '../hooks/usePersistentRange'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import api from '../api/client'
import dayjs from 'dayjs'
import { usePageContext } from '../hooks/usePageContext'
import { useRefresh } from '../context/RefreshContext'

export default function TTFB() {
  const { t } = useTranslation()
  const [range, setRange] = usePersistentRange('ttfb')
  const [data, setData] = useState([])
  const { refreshKey, consumeFresh } = useRefresh()

  usePageContext(() =>
    api.get('/stats/ttfb', { params: range }).then(r => {
      const rows = r.data || []
      const avg  = rows.length ? (rows.reduce((s, d) => s + parseFloat(d.avg_ttfb || 0), 0) / rows.length).toFixed(0) : null
      const slow = rows.filter(d => parseFloat(d.avg_ttfb) > 800).slice(0, 5)
      return { page: 'TTFB', range, avgTtfb: avg, slowPages: slow, totalRows: rows.length }
    })
  )
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to })
      const url = `${window.spiderLens.apiBase}/stats/ttfb/export?${params}`
      const res = await fetch(url, { headers: { 'X-WP-Nonce': window.spiderLens.nonce }, credentials: 'same-origin' })
      if (res.ok) {
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `ttfb-${range.from}-${range.to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch (err) { console.error('Export error:', err) }
    finally { setExporting(false) }
  }

  useEffect(() => {
    setLoading(true)
    const fresh = consumeFresh()
    api
      .get('/stats/ttfb', { params: range, fresh })
      .then(res => {
        const ttfbData = res.data || []
        setData(ttfbData)

        if (ttfbData.length > 0) {
          const avgTtfb = ttfbData.reduce((sum, d) => sum + parseFloat(d.avg_ttfb || 0), 0) / ttfbData.length
          const minTtfb = Math.min(...ttfbData.map(d => parseFloat(d.min_ttfb || 0)))
          const maxTtfb = Math.max(...ttfbData.map(d => parseFloat(d.max_ttfb || 0)))
          setStats({
            avg: Math.round(avgTtfb),
            min: Math.round(minTtfb),
            max: Math.round(maxTtfb),
          })
        }
      })
      .catch(err => console.error('Erreur chargement TTFB:', err))
      .finally(() => setLoading(false))
  }, [range, refreshKey])

  const getColor = ttfb => {
    if (ttfb < 200) return '#10b981'
    if (ttfb < 800) return '#f59e0b'
    return '#d62246'
  }

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:gauge"
        title={t('ttfb.welcomeTitle')}
        tips={[
          t('ttfb.tip1'),
          t('ttfb.tip2'),
          t('ttfb.tip3'),
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('ttfb.welcomeTitle')}</h2>
          <p className="text-errorgrey text-sm">{t('ttfb.chartEvolutionInfo')}</p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
          <button
            onClick={handleExport}
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard
              label={t('ttfb.kpiAvgTTFB')}
              value={`${stats.avg ?? 0} ms`}
              icon="ph:timer"
              color={stats.avg < 200 ? 'green' : stats.avg < 800 ? 'amber' : 'dustyred'}
              info={t('ttfb.kpiAvgTTFBInfo')}
            />
            <KPICard
              label={t('ttfb.kpiSlowPercent')}
              value={`${stats.min ?? 0} ms`}
              icon="ph:arrow-down"
              color="green"
              info={t('ttfb.kpiSlowPercentInfo')}
            />
            <KPICard
              label={t('ttfb.kpiFastPages')}
              value={`${stats.max ?? 0} ms`}
              icon="ph:arrow-up"
              color={stats.max < 800 ? 'amber' : 'dustyred'}
              info={t('ttfb.kpiFastPagesInfo')}
            />
          </div>

          {/* Graphique */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
            <h3 className="text-white font-bold text-sm mb-4">{t('ttfb.chartEvolutionTitle')}</h3>
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="gTtfb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
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
                    formatter={v => [`${v} ms`, t('ttfb.chartEvolutionTitle')]}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_ttfb"
                    name={t('ttfb.chartEvolutionTitle')}
                    stroke={getColor(stats.avg)}
                    fill="url(#gTtfb)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message={t('common.noData')} />
            )}
          </div>

          {/* Légende des couleurs */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
            <h4 className="text-white font-bold text-sm mb-3">{t('ttfb.thresholdLabel')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 bg-green-400 shrink-0" />
                <div>
                  <p className="text-white font-semibold text-sm">{t('ttfb.fast')}</p>
                  <p className="text-errorgrey text-xs">{t('ttfb.kpiAvgTTFBInfo')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 bg-orange-400 shrink-0" />
                <div>
                  <p className="text-white font-semibold text-sm">{t('ttfb.ok')}</p>
                  <p className="text-errorgrey text-xs">{t('ttfb.kpiSlowPagesInfo')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 bg-dustyred-400 shrink-0" />
                <div>
                  <p className="text-white font-semibold text-sm">{t('ttfb.slow')}</p>
                  <p className="text-errorgrey text-xs">{t('ttfb.chartEvolutionContent')}</p>
                </div>
              </div>
            </div>
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
