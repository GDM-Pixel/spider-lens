import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import KPICard from '../components/ui/KPICard'
import DateRangePicker from '../components/ui/DateRangePicker'
import { usePersistentRange } from '../hooks/usePersistentRange'
import api from '../api/client'
import dayjs from 'dayjs'

export default function HttpCodes() {
  const [range, setRange] = usePersistentRange('http-codes')
  const [overview, setOverview] = useState(null)
  const [httpData, setHttpData] = useState([])
  const [loading, setLoading] = useState(true)

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">Codes HTTP</h2>
          <p className="text-errorgrey text-sm">Distribution des codes de réponse HTTP</p>
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
            <KPICard
              label="Succès (2xx)"
              value={parseInt(overview?.s2xx || 0).toLocaleString('fr-FR')}
              icon="ph:check-circle"
              color="green"
              info="Requêtes traitées avec succès"
            />
            <KPICard
              label="Redirections (3xx)"
              value={parseInt(overview?.s3xx || 0).toLocaleString('fr-FR')}
              icon="ph:arrows-clockwise"
              color="amber"
              info="Redirections HTTP"
            />
            <KPICard
              label="Erreurs client (4xx)"
              value={parseInt(overview?.s4xx || 0).toLocaleString('fr-FR')}
              icon="ph:x-circle"
              color="dustyred"
              info="Requêtes mal formées ou ressource non trouvée"
            />
            <KPICard
              label="Erreurs serveur (5xx)"
              value={parseInt(overview?.s5xx || 0).toLocaleString('fr-FR')}
              icon="ph:warning-octagon"
              color="dustyred"
              info="Erreurs serveur"
            />
          </div>

          {/* Graphique */}
          <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
            <h3 className="text-white font-bold text-sm mb-4">Évolution quotidienne</h3>
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
              <EmptyState message="Aucune donnée sur cette période" />
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
