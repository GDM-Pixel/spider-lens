import React, { useEffect, useState, useCallback } from 'react'
import { Icon } from '@iconify/react'
import { Link } from 'react-router-dom'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

const PAGE_SIZE = 50

export default function Blocklist() {
  const [rows, setRows]       = useState([])
  const [total, setTotal]     = useState(0)
  const [offset, setOffset]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = { limit: PAGE_SIZE, offset }
    if (debouncedSearch) params.search = debouncedSearch
    api.get('/blocklist', { params })
      .then(r => { setRows(r.data.rows); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [offset, debouncedSearch])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setOffset(0) }, [debouncedSearch])

  async function handleUnblock(ip) {
    if (!confirm(`Débloquer l'IP ${ip} ?`)) return
    await api.delete(`/blocklist/${encodeURIComponent(ip)}`)
    fetchData()
  }

  function exportRules(type) {
    const token = localStorage.getItem('spider_token')
    fetch(`/api/blocklist/export/${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `spider-lens-blocklist.${type}.conf`
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:prohibit"
        title="Blocklist IPs"
        tips={[
          'Cette liste contient les IPs que vous avez marquées comme bloquées depuis la page Réseau.',
          'Exportez les règles nginx ou Apache pour les appliquer sur votre serveur web.',
          'Spider-Lens ne bloque pas directement les IPs — il génère des règles à copier dans votre config serveur.',
          'Pour bloquer une nouvelle IP, rendez-vous dans Réseau et cliquez sur l\'icône 🚫 en face de l\'IP.',
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">Blocklist</h2>
          <p className="text-errorgrey text-sm">
            {total > 0 ? (
              <span><span className="text-white font-semibold">{total}</span> IP{total > 1 ? 's' : ''} bloquée{total > 1 ? 's' : ''}</span>
            ) : 'Aucune IP bloquée'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportRules('nginx')}
            disabled={total === 0}
            className="flex items-center gap-2 px-4 py-2 bg-prussian-600 border border-prussian-500 rounded-lg text-sm font-semibold text-errorgrey hover:text-white disabled:opacity-40 transition-colors"
          >
            <Icon icon="ph:download-simple" className="text-base" />
            nginx
          </button>
          <button
            onClick={() => exportRules('apache')}
            disabled={total === 0}
            className="flex items-center gap-2 px-4 py-2 bg-prussian-600 border border-prussian-500 rounded-lg text-sm font-semibold text-errorgrey hover:text-white disabled:opacity-40 transition-colors"
          >
            <Icon icon="ph:download-simple" className="text-base" />
            Apache
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="flex items-center gap-2 bg-prussian-600 border border-prussian-500 rounded-lg px-3 py-2 max-w-sm">
        <Icon icon="ph:magnifying-glass" className="text-errorgrey shrink-0" />
        <input
          type="text"
          placeholder="Rechercher une IP…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-transparent text-white text-sm flex-1 outline-none placeholder-errorgrey"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-errorgrey hover:text-white transition-colors">
            <Icon icon="ph:x" className="text-sm" />
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-prussian-700 text-errorgrey text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Adresse IP</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Raison</th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">Site</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Bloquée le</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Par</th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="py-16 text-center">
                <div className="w-6 h-6 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            )}
            {!loading && rows.map(row => (
              <tr key={row.id} className="border-t border-prussian-400 hover:bg-prussian-400/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon icon="ph:prohibit" className="text-dustyred-400 text-sm shrink-0" />
                    <span className="font-mono text-moonstone-300">{row.ip}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-errorgrey text-sm hidden md:table-cell">
                  {row.reason || <span className="italic text-prussian-300">—</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {row.site_name
                    ? <span className="text-xs bg-prussian-600 text-lightgrey rounded px-2 py-0.5">{row.site_name}</span>
                    : <span className="text-prussian-300 text-xs">Tous</span>
                  }
                </td>
                <td className="px-4 py-3 text-errorgrey text-xs hidden sm:table-cell">
                  {dayjs(row.blocked_at).format('DD/MM/YYYY HH:mm')}
                </td>
                <td className="px-4 py-3 text-errorgrey text-xs hidden sm:table-cell">
                  {row.blocked_by}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleUnblock(row.ip)}
                    title="Débloquer cette IP"
                    className="text-errorgrey hover:text-green-400 transition-colors p-1 rounded"
                  >
                    <Icon icon="ph:lock-open" className="text-base" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Icon icon="ph:shield-check" className="text-4xl text-green-400/50" />
                    <p className="text-errorgrey text-sm">
                      {debouncedSearch ? 'Aucune IP correspond à cette recherche.' : 'Aucune IP bloquée pour l\'instant.'}
                    </p>
                    {!debouncedSearch && (
                      <Link to="/network" className="text-moonstone-400 hover:text-moonstone-300 text-xs font-semibold transition-colors">
                        Aller à la page Réseau →
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
            className="px-4 py-2 bg-prussian-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-prussian-500 transition-colors"
          >← Précédent</button>
          <span className="text-errorgrey text-sm">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total.toLocaleString()}
          </span>
          <button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(o => o + PAGE_SIZE)}
            className="px-4 py-2 bg-prussian-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-prussian-500 transition-colors"
          >Suivant →</button>
        </div>
      )}

      {/* Guide export */}
      {total > 0 && (
        <div className="bg-prussian-600 border border-prussian-500 rounded-xl p-5 flex flex-col gap-3">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Icon icon="ph:info" className="text-moonstone-400 text-base" />
            Comment appliquer ces règles ?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-2">nginx</p>
              <pre className="bg-prussian-700 rounded-lg px-3 py-2.5 text-xs text-lightgrey font-mono overflow-x-auto">{`# Dans votre nginx.conf ou vhost :
include /etc/nginx/spider-lens-blocklist.conf;

# Dans le fichier téléchargé :
deny 1.2.3.4;
deny 5.6.7.8;`}</pre>
            </div>
            <div>
              <p className="text-errorgrey text-xs font-semibold uppercase tracking-wide mb-2">Apache</p>
              <pre className="bg-prussian-700 rounded-lg px-3 py-2.5 text-xs text-lightgrey font-mono overflow-x-auto">{`# Dans votre VirtualHost ou .htaccess :
<RequireAll>
  Require all granted
  Require not ip 1.2.3.4
  Require not ip 5.6.7.8
</RequireAll>`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
