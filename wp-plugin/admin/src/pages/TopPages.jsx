import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import DateRangePicker from '../components/ui/DateRangePicker'
import { usePersistentRange } from '../hooks/usePersistentRange'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

export default function TopPages() {
  const [range, setRange] = usePersistentRange('top-pages')
  const [activeTab, setActiveTab] = useState('top-pages')
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const endpoint = activeTab === 'top-pages' ? '/stats/top-pages' : '/stats/top-404'
    api
      .get(endpoint, { params: { ...range, limit: 50 } })
      .then(res => setData(res.data || []))
      .catch(err => console.error('Erreur chargement pages:', err))
      .finally(() => setLoading(false))
  }, [range, activeTab])

  const filteredData = data.filter(item =>
    item.url.toLowerCase().includes(search.toLowerCase())
  )

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
      })
      const url = `${window.spiderLens.apiBase}/stats/${activeTab}/export?${params.toString()}`
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
        link.download = `${activeTab}-${range.from}-${range.to}.csv`
        link.click()
      }
    } catch (err) {
      console.error('Erreur export:', err)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">Pages</h2>
          <p className="text-errorgrey text-sm">URLs les plus visitées et erreurs 404</p>
        </div>
        <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-prussian-400">
        {[
          { id: 'top-pages', label: 'Top Pages (200)' },
          { id: 'top-404', label: 'Top 404' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'px-4 py-2 text-sm font-semibold transition-colors border-b-2',
              activeTab === tab.id
                ? 'text-moonstone-400 border-moonstone-400'
                : 'text-errorgrey border-transparent hover:text-lightgrey'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recherche + Export */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Icon
              icon="ph:magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-base"
            />
            <input
              type="text"
              placeholder="Filtrer par URL..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-prussian-500 border border-prussian-400 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm"
        >
          <Icon icon="ph:download" className="text-base" />
          Export CSV
        </button>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredData.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-prussian-400">
                <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                  URL
                </th>
                <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                  Visites
                </th>
                <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                  Humains
                </th>
                <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                  Bots
                </th>
                <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                  Dernière visite
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, i) => (
                <tr
                  key={i}
                  className="border-b border-prussian-600 hover:bg-prussian-500 transition-colors"
                >
                  <td className="px-4 py-3 text-white truncate max-w-sm">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-moonstone-400 hover:text-moonstone-300"
                    >
                      {item.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold">
                    {parseInt(item.hits).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right text-lightgrey">
                    {parseInt(item.humans || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right text-lightgrey">
                    {parseInt(item.bots || 0).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right text-errorgrey text-xs">
                    {item.last_seen ? dayjs(item.last_seen).format('DD/MM/YYYY HH:mm') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message={search ? 'Aucune page correspond à votre recherche' : 'Aucune donnée sur cette période'} />
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
