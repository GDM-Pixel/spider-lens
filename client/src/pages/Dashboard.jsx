import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@iconify/react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import KPICard from '../components/ui/KPICard'
import DateRangePicker from '../components/ui/DateRangePicker'
import InfoBubble from '../components/ui/InfoBubble'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import { usePersistentRange } from '../hooks/usePersistentRange'
import { useSite } from '../context/SiteContext'
import api from '../api/client'
import dayjs from 'dayjs'


const HTTP_COLORS = {
  s2xx: '#00c6e0',
  s3xx: '#f59e0b',
  s4xx: '#d62246',
  s5xx: '#9f1934',
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { activeSiteId } = useSite()
  const [range, setRange] = usePersistentRange('dashboard')
  const [overview, setOverview] = useState(null)
  const [httpData, setHttpData] = useState([])
  const [botsData, setBotsData] = useState([])
  const [recentAnomalies, setRecentAnomalies] = useState([])
  const [weeklyTrends, setWeeklyTrends] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const anomalyParams = activeSiteId ? { siteId: activeSiteId } : {}
    Promise.all([
      api.get('/stats/overview', { params: range }),
      api.get('/stats/http-codes', { params: range }),
      api.get('/stats/bots', { params: range }),
      api.get('/alerts/anomalies/recent', { params: anomalyParams }),
      api.get('/stats/weekly-trends', { params: { weeks: 12 } }),
    ]).then(([ov, http, bots, anomalies, trends]) => {
      setOverview(ov.data)
      setHttpData(http.data)
      setBotsData(bots.data)
      setRecentAnomalies(anomalies.data)
      setWeeklyTrends(trends.data)
    }).finally(() => setLoading(false))
  }, [range, activeSiteId])

  const botPieData = botsData
    .filter(d => d.is_bot === 1)
    .map(d => ({ name: d.name, value: d.hits }))

  const BOT_COLORS = ['#00c6e0', '#d62246', '#8b5cf6', '#f59e0b', '#10b981', '#6366f1', '#ec4899']

  return (
    <div className="flex flex-col gap-6">

      <BeginnerBanner
        icon="ph:chart-line"
        title={t('dashboard.welcomeTitle')}
        tips={[
          t('dashboard.tip1'),
          t('dashboard.tip2'),
          t('dashboard.tip3'),
          t('dashboard.tip4'),
        ]}
      />

      {/* En-tête avec sélecteur dates */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('dashboard.overview')}</h2>
          <p className="text-errorgrey text-sm">{t('dashboard.overviewSubtitle')}</p>
        </div>
        <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <KPICard
              label={t('dashboard.totalRequests')}
              value={overview?.total?.toLocaleString('fr-FR') || '0'}
              icon="ph:globe-hemisphere-west"
              color="moonstone"
              info={t('dashboard.totalRequestsInfo')}
            />
            <KPICard
              label={t('dashboard.humanVisitors')}
              value={overview?.humans?.toLocaleString('fr-FR') || '0'}
              icon="ph:users"
              color="green"
              info={t('dashboard.humanVisitorsInfo')}
            />
            <KPICard
              label={t('dashboard.botRequests')}
              value={overview?.bots?.toLocaleString('fr-FR') || '0'}
              icon="ph:robot"
              color="purple"
              info={t('dashboard.botRequestsInfo')}
            />
            <KPICard
              label={t('dashboard.errorRate')}
              value={`${overview?.errorRate || 0}%`}
              icon="ph:warning-octagon"
              color={parseFloat(overview?.errorRate) > 5 ? 'dustyred' : 'green'}
              info={t('dashboard.errorRateInfo')}
            />
            <KPICard
              label={t('dashboard.success2xx')}
              value={overview?.s2xx?.toLocaleString('fr-FR') || '0'}
              icon="ph:check-circle"
              color="green"
            />
            <KPICard
              label={t('dashboard.redirects3xx')}
              value={overview?.s3xx?.toLocaleString('fr-FR') || '0'}
              icon="ph:arrows-clockwise"
              color="amber"
            />
            <KPICard
              label={t('dashboard.clientErrors4xx')}
              value={overview?.s4xx?.toLocaleString('fr-FR') || '0'}
              icon="ph:x-circle"
              color="dustyred"
            />
            <KPICard
              label={t('dashboard.unique404')}
              value={overview?.unique404?.toLocaleString('fr-FR') || '0'}
              icon="ph:magnifying-glass-minus"
              color="dustyred"
              info={t('dashboard.unique404Info')}
            />
          </div>

          {/* Graphes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Évolution codes HTTP */}
            <div className="lg:col-span-2 bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-sm">{t('dashboard.httpEvolution')}</h3>
                <InfoBubble
                  title={t('dashboard.httpEvolution')}
                  content={t('dashboard.httpEvolutionInfo')}
                  impact={t('dashboard.httpEvolutionImpact')}
                  action={t('dashboard.httpEvolutionAction')}
                />
              </div>
              {httpData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={httpData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#273043" />
                    <XAxis dataKey="day" tick={{ fill: '#898989', fontSize: 11 }} tickFormatter={v => dayjs(v).format('DD/MM')} />
                    <YAxis tick={{ fill: '#898989', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }}
                      labelFormatter={v => dayjs(v).format('DD/MM/YYYY')}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#d1d1d1' }} />
                    <Line type="monotone" dataKey="s2xx" name="2xx" stroke="#00c6e0" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="s3xx" name="3xx" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="s4xx" name="4xx" stroke="#d62246" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="s5xx" name="5xx" stroke="#9f1934" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message={t('common.noData')} />
              )}
            </div>

            {/* Répartition bots */}
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-sm">{t('dashboard.botsDistribution')}</h3>
                <InfoBubble
                  title={t('dashboard.botsDistributionTitle')}
                  content={t('dashboard.botsDistributionInfo')}
                  impact={t('dashboard.botsDistributionImpact')}
                />
              </div>
              {botPieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={botPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
                        {botPieData.map((_, i) => (
                          <Cell key={i} fill={BOT_COLORS[i % BOT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex flex-col gap-1.5 mt-2">
                    {botPieData.slice(0, 5).map((d, i) => (
                      <li key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: BOT_COLORS[i % BOT_COLORS.length] }} />
                          <span className="text-lightgrey">{d.name}</span>
                        </span>
                        <span className="text-white font-semibold">{d.value.toLocaleString('fr-FR')}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState message={t('common.noData')} />
              )}
            </div>
          </div>

          {/* Tendances — 12 semaines */}
          {weeklyTrends.length > 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-sm">{t('dashboard.trends')}</h3>
                <InfoBubble
                  title={t('dashboard.trendsInfo')}
                  content={t('dashboard.trendsContent')}
                  impact={t('dashboard.trendsImpact')}
                  action={t('dashboard.trendsAction')}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Trafic humains vs bots */}
                <div className="lg:col-span-2 bg-prussian-500 rounded-xl border border-prussian-400 p-5">
                  <h4 className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-3">{t('dashboard.trendsTraffic')}</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={weeklyTrends}>
                      <defs>
                        <linearGradient id="gHumans" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00c6e0" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00c6e0" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gBots" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#273043" />
                      <XAxis dataKey="week_label" tick={{ fill: '#898989', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#898989', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#d1d1d1' }} />
                      <Area type="monotone" dataKey="humans" name={t('dashboard.trendsHumans')} stroke="#00c6e0" fill="url(#gHumans)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="bots" name={t('dashboard.trendsBots')} stroke="#8b5cf6" fill="url(#gBots)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Googlebot + TTFB */}
                <div className="flex flex-col gap-4">
                  <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5 flex-1">
                    <h4 className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-3">{t('dashboard.trendsGooglebot')}</h4>
                    <ResponsiveContainer width="100%" height={80}>
                      <LineChart data={weeklyTrends}>
                        <XAxis dataKey="week_label" tick={false} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff', fontSize: 11 }} />
                        <Line type="monotone" dataKey="googlebot" name="Googlebot" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5 flex-1">
                    <h4 className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-3">{t('dashboard.trendsTTFB')}</h4>
                    <ResponsiveContainer width="100%" height={80}>
                      <LineChart data={weeklyTrends}>
                        <XAxis dataKey="week_label" tick={false} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff', fontSize: 11 }}
                          formatter={(v) => [`${v} ms`, 'TTFB']}
                        />
                        <Line
                          type="monotone"
                          dataKey="avg_ttfb"
                          name="TTFB"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Widget anomalies récentes */}
          {recentAnomalies.length > 0 && (
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon icon="ph:warning-diamond" className="text-orange-400 text-lg" />
                  <h3 className="text-white font-bold text-sm">{t('dashboard.recentAnomalies')}</h3>
                </div>
                <Link to="/anomalies" className="text-moonstone-400 hover:text-moonstone-300 text-xs font-semibold transition-colors">
                  {t('dashboard.viewAll')}
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {recentAnomalies.map(a => {
                  const isCritical = a.severity === 'critical'
                  const ICONS = {
                    traffic_spike: 'ph:trend-up',
                    error_rate_spike: 'ph:warning-circle',
                    googlebot_absent: 'ph:robot',
                    unknown_bot_spike: 'ph:question',
                  }
                  const LABELS = {
                    traffic_spike: t('dashboard.anomalyTrafficSpike'),
                    error_rate_spike: t('dashboard.anomalyErrorRate'),
                    googlebot_absent: t('dashboard.anomalyGooglebotAbsent'),
                    unknown_bot_spike: t('dashboard.anomalyUnknownBot'),
                  }
                  return (
                    <div key={a.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${isCritical ? 'bg-dustyred-400/10 border border-dustyred-700/50' : 'bg-prussian-600'}`}>
                      <Icon icon={ICONS[a.type] || 'ph:info'} className={`text-lg shrink-0 ${isCritical ? 'text-dustyred-400' : 'text-orange-400'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold ${isCritical ? 'text-dustyred-300' : 'text-white'}`}>
                          {LABELS[a.type] || a.type}
                        </span>
                        {a.site_name && <span className="text-errorgrey text-xs ml-2">{a.site_name}</span>}
                      </div>
                      <span className="text-errorgrey text-xs shrink-0">{dayjs(a.detected_at).format('HH:mm')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 gap-2">
      <Icon icon="ph:chart-bar" className="text-3xl text-prussian-400" />
      <p className="text-errorgrey text-sm">{message}</p>
    </div>
  )
}
