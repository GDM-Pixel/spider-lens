import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import DateRangePicker from '../components/ui/DateRangePicker'
import { usePersistentRange } from '../hooks/usePersistentRange'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import api from '../api/client'
import dayjs from 'dayjs'

const BOT_COLORS = ['#00c6e0', '#d62246', '#8b5cf6', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#06b6d4']

export default function Bots() {
  const { t } = useTranslation()
  const [range, setRange] = usePersistentRange('bots')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .get('/stats/bots', { params: range })
      .then(res => setData(res.data || []))
      .catch(err => console.error('Erreur chargement bots:', err))
      .finally(() => setLoading(false))
  }, [range])

  const botData = data.filter(d => d.is_bot === '1' || d.is_bot === 1)
  const pieData = botData.map(d => ({
    name: d.name,
    value: parseInt(d.hits),
  }))

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
      })
      const url = `${window.spiderLens.apiBase}/stats/bots/export?${params.toString()}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-WP-Nonce': window.spiderLens.nonce,
        },
        credentials: 'same-origin',
      })
      if (response.ok) {
        const blob = await response.blob()
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `bots-${range.from}-${range.to}.csv`
        link.click()
      }
    } catch (err) {
      console.error('Erreur export:', err)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:robot"
        title={t('bots.welcomeTitle')}
        tips={[
          t('bots.tip1'),
          t('bots.tip2'),
          t('bots.tip3'),
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('bots.welcomeTitle')}</h2>
          <p className="text-errorgrey text-sm">{t('bots.kpiBotRequestsInfo')}</p>
        </div>
        <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Graphique + Export */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <h3 className="text-white font-bold text-sm mb-4">{t('bots.chartDistributionTitle')}</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={BOT_COLORS[i % BOT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message={t('bots.emptyBots')} />
              )}
            </div>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm w-full justify-center"
              >
                <Icon icon="ph:download" className="text-base" />
                {t('common.csv')}
              </button>
            </div>
          </div>

          {/* Tableau des bots */}
          {botData.length > 0 ? (
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <h3 className="text-white font-bold text-sm mb-4">{t('bots.chartDistributionTitle')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-prussian-400">
                      <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                        {t('common.by')}
                      </th>
                      <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                        {t('common.hits')}
                      </th>
                      <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                        {t('common.lastSeen')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {botData.map((bot, i) => (
                      <tr
                        key={i}
                        className="border-b border-prussian-600 hover:bg-prussian-400/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-white font-semibold">
                          {bot.name}
                        </td>
                        <td className="px-4 py-3 text-right text-white font-semibold">
                          {parseInt(bot.hits).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-right text-errorgrey text-xs">
                          {bot.last_seen ? dayjs(bot.last_seen).format('DD/MM/YYYY HH:mm') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState message={t('bots.emptyBots')} />
          )}
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
