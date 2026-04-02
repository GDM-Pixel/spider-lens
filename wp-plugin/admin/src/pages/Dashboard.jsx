import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import KPICard from '../components/ui/KPICard'
import DateRangePicker from '../components/ui/DateRangePicker'
import InfoBubble from '../components/ui/InfoBubble'
import { usePersistentRange } from '../hooks/usePersistentRange'
import api from '../api/client'
import dayjs from 'dayjs'

const BOT_COLORS = ['#00c6e0', '#d62246', '#8b5cf6', '#f59e0b', '#10b981', '#6366f1']

export default function Dashboard() {
  const [range, setRange]                 = usePersistentRange('dashboard')
  const [overview, setOverview]           = useState(null)
  const [httpData, setHttpData]           = useState([])
  const [botsData, setBotsData]           = useState([])
  const [recentAnomalies, setAnomalies]   = useState([])
  const [weeklyTrends, setWeeklyTrends]   = useState([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/stats/overview',      { params: range }),
      api.get('/stats/http-codes',    { params: range }),
      api.get('/stats/bots',          { params: range }),
      api.get('/anomalies/recent'),
      api.get('/stats/weekly-trends', { params: { weeks: 12 } }),
    ]).then(([ov, http, bots, anom, trends]) => {
      setOverview(ov.data)
      setHttpData(http.data)
      setBotsData(bots.data)
      setAnomalies(anom.data)
      setWeeklyTrends(trends.data)
    }).finally(() => setLoading(false))
  }, [range])

  const botPieData = botsData.filter(d => d.is_bot === '1' || d.is_bot === 1)
    .map(d => ({ name: d.name, value: parseInt(d.hits) }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">Vue globale</h2>
          <p className="text-errorgrey text-sm">Aperçu de votre trafic WordPress sur la période</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Requêtes totales"   value={parseInt(overview?.total || 0).toLocaleString('fr-FR')}  icon="ph:globe-hemisphere-west" color="moonstone" info="Nombre total de requêtes WordPress capturées." />
            <KPICard label="Visiteurs humains"  value={parseInt(overview?.humans || 0).toLocaleString('fr-FR')} icon="ph:users"                 color="green"     info="Requêtes hors bots détectés." />
            <KPICard label="Requêtes bots"      value={parseInt(overview?.bots || 0).toLocaleString('fr-FR')}   icon="ph:robot"                 color="purple"    info="Robots d'indexation et crawlers." />
            <KPICard label="Taux d'erreur"      value={`${overview?.errorRate || 0}%`}                          icon="ph:warning-octagon"       color={parseFloat(overview?.errorRate) > 5 ? 'dustyred' : 'green'} />
            <KPICard label="Succès (2xx)"        value={parseInt(overview?.s2xx || 0).toLocaleString('fr-FR')}  icon="ph:check-circle"          color="green" />
            <KPICard label="Redirections (3xx)"  value={parseInt(overview?.s3xx || 0).toLocaleString('fr-FR')}  icon="ph:arrows-clockwise"      color="amber" />
            <KPICard label="Erreurs client (4xx)" value={parseInt(overview?.s4xx || 0).toLocaleString('fr-FR')} icon="ph:x-circle"              color="dustyred" />
            <KPICard label="URLs en 404 uniques" value={parseInt(overview?.unique404 || 0).toLocaleString('fr-FR')} icon="ph:magnifying-glass-minus" color="dustyred" info="URLs distinctes ayant retourné un 404." />
          </div>

          {/* Graphes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <h3 className="text-white font-bold text-sm mb-4">Évolution des codes HTTP</h3>
              {httpData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={httpData}>
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
                </ResponsiveContainer>
              ) : <EmptyState message="Aucune donnée sur cette période" />}
            </div>

            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <h3 className="text-white font-bold text-sm mb-4">Répartition des bots</h3>
              {botPieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={botPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                        {botPieData.map((_, i) => <Cell key={i} fill={BOT_COLORS[i % BOT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex flex-col gap-1.5 mt-2">
                    {botPieData.slice(0, 5).map((d, i) => (
                      <li key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BOT_COLORS[i % BOT_COLORS.length] }} />
                          <span className="text-lightgrey truncate">{d.name}</span>
                        </span>
                        <span className="text-white font-semibold">{d.value.toLocaleString('fr-FR')}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : <EmptyState message="Aucun bot détecté" />}
            </div>
          </div>

          {/* Tendances 12 semaines */}
          {weeklyTrends.length > 1 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-white font-bold text-sm">Tendances — 12 semaines</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-prussian-500 rounded-xl border border-prussian-400 p-5">
                  <h4 className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-3">Trafic hebdomadaire</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={weeklyTrends}>
                      <defs>
                        <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00c6e0" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00c6e0" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#273043" />
                      <XAxis dataKey="week_label" tick={{ fill: '#898989', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#898989', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#d1d1d1' }} />
                      <Area type="monotone" dataKey="humans" name="Humains" stroke="#00c6e0" fill="url(#gH)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="bots"   name="Bots"    stroke="#8b5cf6" fill="url(#gB)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-4 flex-1">
                    <h4 className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-2">Googlebot</h4>
                    <ResponsiveContainer width="100%" height={70}>
                      <LineChart data={weeklyTrends}>
                        <XAxis dataKey="week_label" tick={false} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff', fontSize: 11 }} />
                        <Line type="monotone" dataKey="googlebot" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-4 flex-1">
                    <h4 className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-2">TTFB moyen (ms)</h4>
                    <ResponsiveContainer width="100%" height={70}>
                      <LineChart data={weeklyTrends}>
                        <XAxis dataKey="week_label" tick={false} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff', fontSize: 11 }} formatter={v => [`${v} ms`, 'TTFB']} />
                        <Line type="monotone" dataKey="avg_ttfb" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Anomalies récentes */}
          {recentAnomalies.length > 0 && (
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon icon="ph:warning-diamond" className="text-orange-400 text-lg" />
                  <h3 className="text-white font-bold text-sm">Anomalies récentes (48h)</h3>
                </div>
                <Link to="/anomalies" className="text-moonstone-400 hover:text-moonstone-300 text-xs font-semibold">Voir tout →</Link>
              </div>
              <div className="flex flex-col gap-2">
                {recentAnomalies.map(a => {
                  const isCritical = a.severity === 'critical'
                  const LABELS = { traffic_spike: 'Spike de trafic', error_rate_spike: "Taux d'erreurs élevé" }
                  const ICONS  = { traffic_spike: 'ph:trend-up', error_rate_spike: 'ph:warning-circle' }
                  return (
                    <div key={a.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${isCritical ? 'bg-dustyred-400/10 border border-dustyred-700/50' : 'bg-prussian-600'}`}>
                      <Icon icon={ICONS[a.type] || 'ph:info'} className={`text-lg shrink-0 ${isCritical ? 'text-dustyred-400' : 'text-orange-400'}`} />
                      <span className={`text-sm font-semibold flex-1 ${isCritical ? 'text-dustyred-300' : 'text-white'}`}>{LABELS[a.type] || a.type}</span>
                      <span className="text-errorgrey text-xs">{dayjs(a.detected_at).format('HH:mm')}</span>
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
    <div className="flex flex-col items-center justify-center h-28 gap-2">
      <Icon icon="ph:chart-bar" className="text-3xl text-prussian-400" />
      <p className="text-errorgrey text-sm">{message}</p>
    </div>
  )
}
