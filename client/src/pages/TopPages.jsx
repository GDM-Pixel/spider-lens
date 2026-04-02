import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import DateRangePicker from '../components/ui/DateRangePicker'
import InfoBubble from '../components/ui/InfoBubble'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import { usePersistentRange } from '../hooks/usePersistentRange'
import { useSite } from '../context/SiteContext'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

export default function TopPages() {
  const { activeSiteId } = useSite()
  const [range, setRange] = usePersistentRange('top-pages')
  const [tab, setTab] = useState('404') // '404' | 'pages'
  const [data404, setData404] = useState([])
  const [dataPages, setDataPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/stats/top-404', { params: { ...range, limit: 30 } }),
      api.get('/stats/top-pages', { params: { ...range, limit: 30 } }),
    ]).then(([r404, rpages]) => {
      setData404(r404.data)
      setDataPages(rpages.data)
    }).finally(() => setLoading(false))
  }, [range, activeSiteId])

  function exportCSV() {
    setExporting(true)
    const token = localStorage.getItem('spider_token')
    const endpoint = tab === '404' ? 'top-404' : 'top-pages'
    const filename = tab === '404'
      ? `spider-lens-404-${range.from}-${range.to}.csv`
      : `spider-lens-top-pages-${range.from}-${range.to}.csv`
    const siteParam = activeSiteId ? `&siteId=${activeSiteId}` : ''
    fetch(`/api/stats/${endpoint}/export?from=${range.from}&to=${range.to}${siteParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .finally(() => setExporting(false))
  }

  return (
    <div className="flex flex-col gap-6">

      <BeginnerBanner
        icon="ph:files"
        title="Top Pages & Erreurs 404"
        tips={[
          'L\'onglet "Erreurs 404" liste les URLs introuvables les plus demandées — ce sont des opportunités de créer des redirections 301.',
          'Une page 404 très visitée par Googlebot gaspille votre budget de crawl et nuit à l\'indexation.',
          'L\'onglet "Top Pages" montre vos contenus les plus populaires — utile pour identifier les pages à optimiser en priorité.',
          'Cliquez sur une URL pour la copier ou l\'ouvrir directement dans votre navigateur.',
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">Top Pages</h2>
          <p className="text-errorgrey text-sm">Pages les plus vues et erreurs 404</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={exporting || (tab === '404' ? data404.length === 0 : dataPages.length === 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-600 border border-prussian-500 rounded-lg text-xs font-semibold text-errorgrey hover:text-white transition-colors disabled:opacity-40"
          >
            <Icon icon="ph:download-simple" className="text-sm" />
            {exporting ? 'Export…' : 'CSV'}
          </button>
          <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-prussian-600 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('404')}
          className={clsx('px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2', tab === '404' ? 'bg-prussian-400 text-white' : 'text-errorgrey hover:text-white')}
        >
          <Icon icon="ph:x-circle" className={tab === '404' ? 'text-dustyred-400' : ''} />
          Erreurs 404
          {data404.length > 0 && <span className="bg-dustyred-400/20 text-dustyred-300 text-xs px-1.5 py-0.5 rounded-full">{data404.length}</span>}
        </button>
        <button
          onClick={() => setTab('pages')}
          className={clsx('px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2', tab === 'pages' ? 'bg-prussian-400 text-white' : 'text-errorgrey hover:text-white')}
        >
          <Icon icon="ph:list-magnifying-glass" className={tab === 'pages' ? 'text-moonstone-400' : ''} />
          Top pages
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-prussian-500 rounded-xl border border-prussian-400 overflow-hidden">
          {tab === '404' ? (
            <Table404 data={data404} />
          ) : (
            <TablePages data={dataPages} />
          )}
        </div>
      )}
    </div>
  )
}

function Table404({ data }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-prussian-400">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-bold text-sm">URLs en erreur 404</h3>
          <InfoBubble
            title="Erreurs 404"
            content="Pages introuvables : la ressource demandée n'existe plus ou l'URL est incorrecte."
            impact="Les 404 fréquemment crawlés par Googlebot gaspillent votre budget de crawl et peuvent entraîner des désindexations."
            action="Créez des redirections 301 vers la page la plus pertinente, ou renvoyez un 410 Gone si la page ne doit plus exister."
          />
        </div>
        <span className="text-errorgrey text-xs">{data.length} URLs</span>
      </div>
      {data.length === 0 ? (
        <EmptyTable message="Aucune 404 sur cette période 🎉" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-prussian-400">
                <th className="text-left text-xs font-semibold text-errorgrey px-5 py-3">URL</th>
                <th className="text-right text-xs font-semibold text-errorgrey px-5 py-3">Hits</th>
                <th className="text-right text-xs font-semibold text-errorgrey px-5 py-3">Bots</th>
                <th className="text-right text-xs font-semibold text-errorgrey px-5 py-3">Dernière vue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className={clsx('border-b border-prussian-400/50 hover:bg-prussian-400/30 transition-colors', i % 2 === 0 ? 'bg-prussian-500' : 'bg-prussian-600/30')}>
                  <td className="px-5 py-3 text-sm text-moonstone-400 font-mono max-w-xs truncate">{row.url}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-dustyred-400 font-bold text-sm">{row.hits.toLocaleString('fr-FR')}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-errorgrey">{row.bot_hits?.toLocaleString('fr-FR') || 0}</td>
                  <td className="px-5 py-3 text-right text-xs text-errorgrey">
                    {dayjs(row.last_seen).format('DD/MM/YYYY HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function TablePages({ data }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-prussian-400">
        <h3 className="text-white font-bold text-sm">Pages les plus visitées (200)</h3>
        <span className="text-errorgrey text-xs">{data.length} URLs</span>
      </div>
      {data.length === 0 ? (
        <EmptyTable message="Aucune donnée sur cette période" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-prussian-400">
                <th className="text-left text-xs font-semibold text-errorgrey px-5 py-3">URL</th>
                <th className="text-right text-xs font-semibold text-errorgrey px-5 py-3">Humains</th>
                <th className="text-right text-xs font-semibold text-errorgrey px-5 py-3">Bots</th>
                <th className="text-right text-xs font-semibold text-errorgrey px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className={clsx('border-b border-prussian-400/50 hover:bg-prussian-400/30 transition-colors', i % 2 === 0 ? 'bg-prussian-500' : 'bg-prussian-600/30')}>
                  <td className="px-5 py-3 text-sm text-moonstone-400 font-mono max-w-xs truncate">{row.url}</td>
                  <td className="px-5 py-3 text-right text-sm text-white font-semibold">{row.human_hits?.toLocaleString('fr-FR') || 0}</td>
                  <td className="px-5 py-3 text-right text-sm text-errorgrey">{row.bot_hits?.toLocaleString('fr-FR') || 0}</td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-moonstone-400 font-bold text-sm">{row.hits.toLocaleString('fr-FR')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function EmptyTable({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Icon icon="ph:magnifying-glass-minus" className="text-4xl text-prussian-400" />
      <p className="text-errorgrey text-sm">{message}</p>
    </div>
  )
}
