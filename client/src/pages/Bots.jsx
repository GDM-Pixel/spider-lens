import React, { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { Icon } from '@iconify/react'
import DateRangePicker from '../components/ui/DateRangePicker'
import InfoBubble from '../components/ui/InfoBubble'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import KPICard from '../components/ui/KPICard'
import { usePersistentRange } from '../hooks/usePersistentRange'
import { useSite } from '../context/SiteContext'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

const BOT_COLORS = ['#00c6e0', '#d62246', '#8b5cf6', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6']

export default function Bots() {
  const { activeSiteId } = useSite()
  const [range, setRange] = usePersistentRange('bots')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/stats/bots', { params: range })
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [range, activeSiteId])

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
        title="Bots & Crawlers"
        tips={[
          'Les bots sont des robots automatiques qui visitent votre site — certains sont utiles (Googlebot), d\'autres non.',
          'Googlebot est le robot d\'indexation de Google : s\'il n\'apparaît plus, votre site risque de ne plus être indexé.',
          'Un ratio bots/humains élevé peut indiquer du scraping ou des attaques — surveillez les pics inhabituels.',
          'Le "budget de crawl" est la capacité de Googlebot à explorer votre site : optimisez-le en corrigeant les erreurs 404 et 5xx.',
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">Bots & Crawlers</h2>
          <p className="text-errorgrey text-sm">Analyse des robots d'indexation détectés</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={exporting || data.filter(d => d.is_bot === 1).length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-600 border border-prussian-500 rounded-lg text-xs font-semibold text-errorgrey hover:text-white transition-colors disabled:opacity-40"
          >
            <Icon icon="ph:download-simple" className="text-sm" />
            {exporting ? 'Export…' : 'CSV'}
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Requêtes bots" value={totalBotHits.toLocaleString('fr-FR')} icon="ph:robot" color="purple"
              info="Total des requêtes émises par des robots d'indexation détectés." />
            <KPICard label="Googlebot" value={googlebotHits.toLocaleString('fr-FR')} icon="ph:google-logo" color="moonstone"
              info="Nombre de passages de Googlebot. Un nombre faible peut indiquer un problème de crawlabilité." />
            <KPICard label="Ratio bots / total" value={`${crawlBudgetRatio}%`} icon="ph:chart-pie-slice" color="amber"
              info="Pourcentage du trafic consommé par les bots. Un ratio élevé peut indiquer du crawling agressif ou des attaques." />
            <KPICard label="Types de bots" value={bots.length} icon="ph:list-bullets" color="green" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camembert */}
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-white font-bold text-sm">Répartition des bots</h3>
                <InfoBubble
                  title="Budget de crawl"
                  content="Répartition des différents robots qui crawlent votre site. Idéalement Googlebot doit être dominant parmi les bots SEO."
                  impact="Un fort ratio de bots SEO tiers (Ahrefs, Semrush) par rapport à Googlebot peut indiquer que votre site est plus surveillé par vos concurrents que crawlé par Google."
                />
              </div>
              {bots.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={bots} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="hits">
                        {bots.map((_, i) => <Cell key={i} fill={BOT_COLORS[i % BOT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }} formatter={(v) => v.toLocaleString('fr-FR')} />
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
                  <p className="text-errorgrey text-sm">Aucun bot détecté</p>
                </div>
              )}
            </div>

            {/* Barres comparatives */}
            <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5">
              <h3 className="text-white font-bold text-sm mb-4">Volume par bot</h3>
              {bots.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={bots} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#273043" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#898989', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#d1d1d1', fontSize: 11 }} width={90} />
                    <Tooltip contentStyle={{ background: '#262e40', border: '1px solid #273043', borderRadius: 8, color: '#fff' }} formatter={v => v.toLocaleString('fr-FR')} />
                    <Bar dataKey="hits" name="Requêtes" radius={[0, 4, 4, 0]}>
                      {bots.map((_, i) => <Cell key={i} fill={BOT_COLORS[i % BOT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48">
                  <p className="text-errorgrey text-sm">Aucun bot détecté</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
