import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { kpiVariants } from '../components/ui/KPICard'
import { useTranslation } from 'react-i18next'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Icon } from '@iconify/react'
import DateRangePicker from '../components/ui/DateRangePicker'
import InfoBubble from '../components/ui/InfoBubble'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import KPICard from '../components/ui/KPICard'
import ChartTooltip from '../components/ui/ChartTooltip'
import { usePersistentRange } from '../hooks/usePersistentRange'
import { useSite } from '../context/SiteContext'
import { useRefresh } from '../context/RefreshContext'
import { apiGet } from '../api/client'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

const BOT_COLORS = ['#00c6e0', '#d62246', '#8b5cf6', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6']

export default function Bots() {
  const { t } = useTranslation()
  const { activeSiteId } = useSite()
  const { refreshKey, consumeFresh } = useRefresh()
  const [range, setRange] = usePersistentRange('bots')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    const fresh = consumeFresh()
    setLoading(true)
    apiGet('/stats/bots', { params: range, fresh, signal: ctrl.signal })
      .then(r => setData(r.data))
      .catch(err => { if (err.name !== 'CanceledError') console.error(err) })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [range, activeSiteId, refreshKey])

  function exportCSV() {
    setExporting(true)
    const token = localStorage.getItem('spider_token')
    const siteParam = activeSiteId ? `&siteId=${activeSiteId}` : ''
    fetch(`/api/stats/bots/export?from=${range.from}&to=${range.to}${siteParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `spider-lens-bots-${range.from}-${range.to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .finally(() => setExporting(false))
  }

  const bots = data.filter(d => d.is_bot === 1)
  const humans = data.find(d => d.is_bot === 0)
  const totalBotHits = bots.reduce((s, d) => s + d.hits, 0)
  const googlebotHits = bots.find(d => d.name === 'Googlebot')?.hits || 0
  const crawlBudgetRatio = totalBotHits + (humans?.hits || 0) > 0
    ? ((totalBotHits / (totalBotHits + (humans?.hits || 0))) * 100).toFixed(1)
    : 0

  return (
    <div className="flex flex-col gap-6">

      <BeginnerBanner
        icon="ph:robot"
        title={t('bots.welcomeTitle')}
        tips={[
          t('bots.tip1'),
          t('bots.tip2'),
          t('bots.tip3'),
          t('bots.tip4'),
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('bots.welcomeTitle')}</h2>
          <p className="text-errorgrey text-sm">{t('bots.welcomeTitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={exporting || data.filter(d => d.is_bot === 1).length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-600 border border-prussian-500 rounded-lg text-xs font-semibold text-errorgrey hover:text-white transition-colors disabled:opacity-40"
          >
            <Icon icon="ph:download-simple" className="text-sm" />
            {exporting ? t('common.exporting') : t('common.csv')}
          </button>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-4"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          >
            <KPICard label={t('bots.kpiBotRequests')} value={totalBotHits.toLocaleString('fr-FR')} icon="ph:robot" color="purple"
              info={t('bots.kpiBotRequestsInfo')} />
            <KPICard label={t('bots.kpiGooglebot')} value={googlebotHits.toLocaleString('fr-FR')} icon="ph:google-logo" color="moonstone"
              info={t('bots.kpiGooglebotInfo')} />
            <KPICard label={t('bots.kpiBotRatio')} value={`${crawlBudgetRatio}%`} icon="ph:chart-pie-slice" color="amber"
              info={t('bots.kpiBotRatioInfo')} />
            <KPICard label={t('bots.kpiBotTypes')} value={bots.length} icon="ph:list-bullets" color="green" />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camembert */}
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-white font-bold text-sm">{t('bots.chartDistributionTitle')}</h3>
                <InfoBubble
                  title={t('bots.chartDistributionTitle')}
                  content={t('bots.chartDistributionContent')}
                  impact={t('bots.chartDistributionImpact')}
                />
              </div>
              {bots.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={bots} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="hits">
                        {bots.map((_, i) => <Cell key={i} fill={BOT_COLORS[i % BOT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex flex-col gap-2 mt-2">
                    {bots.map((bot, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm text-lightgrey">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BOT_COLORS[i % BOT_COLORS.length] }} />
                          {bot.name}
                        </span>
                        <span className="text-white font-semibold text-sm">{bot.hits.toLocaleString('fr-FR')}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-errorgrey text-sm">{t('bots.emptyBots')}</p>
                </div>
              )}
            </div>

            {/* Barres comparatives */}
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <h3 className="text-white font-bold text-sm mb-4">{t('bots.chartVolumeTitle')}</h3>
              {bots.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={bots} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#273043" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#898989', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#d1d1d1', fontSize: 11 }} width={90} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="hits" name="Requêtes" radius={[0, 4, 4, 0]}>
                      {bots.map((_, i) => <Cell key={i} fill={BOT_COLORS[i % BOT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <p className="text-errorgrey text-sm">{t('bots.emptyBots')}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
