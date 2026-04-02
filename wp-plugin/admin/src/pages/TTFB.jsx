import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import KPICard from '../components/ui/KPICard'
import DateRangePicker from '../components/ui/DateRangePicker'
import { usePersistentRange } from '../hooks/usePersistentRange'
import api from '../api/client'
import dayjs from 'dayjs'

export default function TTFB() {
  const [range, setRange] = usePersistentRange('ttfb')
  const [data, setData] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .get('/stats/ttfb', { params: range })
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
  }, [range])

  const getColor = ttfb => {
    if (ttfb < 200) return '#10b981'
    if (ttfb < 800) return '#f59e0b'
    return '#d62246'
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">TTFB (Time To First Byte)</h2>
          <p className="text-errorgrey text-sm">Temps de réponse du serveur</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KPICard
              label="TTFB moyen"
              value={`${stats.avg ?? 0} ms`}
              icon="ph:timer"
              color={stats.avg < 200 ? 'green' : stats.avg < 800 ? 'amber' : 'dustyred'}
              info="Temps moyen avant la première donnée du serveur"
            />
            <KPICard
              label="TTFB minimum"
              value={`${stats.min ?? 0} ms`}
              icon="ph:arrow-down"
              color="green"
              info="Meilleur temps de réponse"
            />
            <KPICard
              label="TTFB maximum"
              value={`${stats.max ?? 0} ms`}
              icon="ph:arrow-up"
              color={stats.max < 800 ? 'amber' : 'dustyred'}
              info="Pire temps de réponse"
            />
          </div>

          {/* Graphique */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
            <h3 className="text-white font-bold text-sm mb-4">Évolution quotidienne (ms)</h3>
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
                    formatter={v => [`${v} ms`, 'TTFB moyen']}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_ttfb"
                    name="TTFB moyen"
                    stroke={getColor(stats.avg)}
                    fill="url(#gTtfb)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Aucune donnée sur cette période" />
            )}
          </div>

          {/* Légende des couleurs */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
            <h4 className="text-white font-bold text-sm mb-3">Interprétation</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 bg-green-400 shrink-0" />
                <div>
                  <p className="text-white font-semibold text-sm">Excellent (&lt; 200 ms)</p>
                  <p className="text-errorgrey text-xs">Réponse très rapide du serveur</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 bg-orange-400 shrink-0" />
                <div>
                  <p className="text-white font-semibold text-sm">Correct (200-800 ms)</p>
                  <p className="text-errorgrey text-xs">Temps acceptable</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1 bg-dustyred-400 shrink-0" />
                <div>
                  <p className="text-white font-semibold text-sm">À optimiser (&gt; 800 ms)</p>
                  <p className="text-errorgrey text-xs">Amélioration recommandée</p>
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
