import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import DateRangePicker from '../components/ui/DateRangePicker'
import { usePersistentRange } from '../hooks/usePersistentRange'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

const LIMIT = 50

export default function Network() {
  const [range, setRange] = usePersistentRange('network')
  const [activeTab, setActiveTab] = useState('ips')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">Réseau</h2>
          <p className="text-errorgrey text-sm">Adresses IP et User-Agents</p>
        </div>
        <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-prussian-400">
        {[
          { id: 'ips', label: 'Adresses IP' },
          { id: 'user-agents', label: 'User-Agents' },
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

      {activeTab === 'ips' && <IPsTab range={range} />}
      {activeTab === 'user-agents' && <UserAgentsTab range={range} />}
    </div>
  )
}

function IPsTab({ range }) {
  const [data, setData] = useState([])
  const [blocklist, setBlocklist] = useState(new Set())
  const [search, setSearch] = useState('')
  const [botFilter, setBotFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedIP, setExpandedIP] = useState(null)
  const [expandedData, setExpandedData] = useState({})
  const [blockModal, setBlockModal] = useState({ ip: null, reason: '' })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/network/ips', {
        params: { ...range, search, bot: botFilter !== 'all' ? botFilter : undefined, limit: LIMIT, offset },
      }),
      api.get('/blocklist'),
    ])
      .then(([ipsRes, blockRes]) => {
        setData(ipsRes.data || [])
        setBlocklist(new Set((blockRes.data || []).map(b => b.ip)))
      })
      .catch(err => console.error('Erreur chargement IPs:', err))
      .finally(() => setLoading(false))
  }, [range, search, botFilter, offset])

  const toggleExpand = async ip => {
    if (expandedIP === ip) {
      setExpandedIP(null)
      return
    }
    setExpandedIP(ip)
    if (!expandedData[ip]) {
      try {
        const res = await api.get(`/network/ips/${ip}/urls`, { params: range })
        setExpandedData(prev => ({ ...prev, [ip]: res.data || [] }))
      } catch (err) {
        console.error('Erreur chargement URLs:', err)
      }
    }
  }

  const handleBlock = async () => {
    if (!blockModal.ip) return
    try {
      await api.post('/blocklist', {
        ip: blockModal.ip,
        reason: blockModal.reason,
      })
      setBlocklist(prev => new Set([...prev, blockModal.ip]))
      setBlockModal({ ip: null, reason: '' })
    } catch (err) {
      console.error('Erreur blocage IP:', err)
    }
  }

  const isBlocked = ip => blocklist.has(ip)

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['all', 'true', 'false'].map(val => (
            <button
              key={val}
              onClick={() => { setBotFilter(val); setOffset(0) }}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                botFilter === val
                  ? 'bg-moonstone-400 text-prussian-700'
                  : 'bg-prussian-500 border border-prussian-400 text-errorgrey hover:border-moonstone-400'
              )}
            >
              {val === 'all' ? 'Tous' : val === 'true' ? 'Bots' : 'Humains'}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Icon
              icon="ph:magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-base"
            />
            <input
              type="text"
              placeholder="Filtrer par IP..."
              value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0) }}
              className="w-full bg-prussian-500 border border-prussian-400 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
        </div>
      </div>

      {/* Tableau IPs */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-prussian-400">
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide w-8" />
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    IP
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Visites
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Bots
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Humains
                  </th>
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Nom du bot
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Dernière visite
                  </th>
                  <th className="px-4 py-3 text-center text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((ip, i) => (
                  <React.Fragment key={i}>
                    <tr className="border-b border-prussian-600 hover:bg-prussian-500 transition-colors">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleExpand(ip.ip)}
                          className="text-moonstone-400 hover:text-moonstone-300"
                        >
                          <Icon icon={expandedIP === ip.ip ? 'ph:caret-down' : 'ph:caret-right'} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-white font-mono font-semibold">
                        {ip.ip}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-semibold">
                        {parseInt(ip.hits).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-right text-lightgrey">
                        {parseInt(ip.bots || 0).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-right text-lightgrey">
                        {parseInt(ip.humans || 0).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-white text-xs">
                        {ip.bot_name ? (
                          <span className="bg-purple-400/20 px-2 py-1 rounded">{ip.bot_name}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-errorgrey text-xs">
                        {ip.last_seen ? dayjs(ip.last_seen).format('DD/MM/YYYY HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isBlocked(ip.ip) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-dustyred-400/20 text-dustyred-300 text-xs font-semibold rounded">
                            <Icon icon="ph:lock" className="text-xs" />
                            Bloquée
                          </span>
                        ) : (
                          <button
                            onClick={() => setBlockModal({ ip: ip.ip, reason: '' })}
                            className="text-moonstone-400 hover:text-moonstone-300 text-sm font-semibold"
                          >
                            Bloquer
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedIP === ip.ip && expandedData[ip.ip] && (
                      <tr className="border-b border-prussian-600 bg-prussian-600/50">
                        <td colSpan="8" className="p-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-prussian-400">
                                  <th className="px-3 py-2 text-left text-errorgrey font-semibold">URL</th>
                                  <th className="px-3 py-2 text-right text-errorgrey font-semibold">Code</th>
                                  <th className="px-3 py-2 text-right text-errorgrey font-semibold">Visites</th>
                                  <th className="px-3 py-2 text-right text-errorgrey font-semibold">Dernière visite</th>
                                </tr>
                              </thead>
                              <tbody>
                                {expandedData[ip.ip].map((url, j) => (
                                  <tr key={j} className="border-b border-prussian-500 hover:bg-prussian-500 transition-colors">
                                    <td className="px-3 py-2 text-lightgrey truncate max-w-sm">
                                      {url.url}
                                    </td>
                                    <td className="px-3 py-2 text-right text-white font-mono">
                                      {url.code}
                                    </td>
                                    <td className="px-3 py-2 text-right text-lightgrey">
                                      {parseInt(url.hits).toLocaleString('fr-FR')}
                                    </td>
                                    <td className="px-3 py-2 text-right text-errorgrey">
                                      {url.last_seen ? dayjs(url.last_seen).format('DD/MM HH:mm') : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="px-3 py-2 bg-prussian-500 border border-prussian-400 rounded-lg text-white text-sm disabled:opacity-50 hover:border-moonstone-400 transition-colors"
            >
              Précédent
            </button>
            <span className="text-errorgrey text-sm">
              Page {Math.floor(offset / LIMIT) + 1}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={data.length < LIMIT}
              className="px-3 py-2 bg-prussian-500 border border-prussian-400 rounded-lg text-white text-sm disabled:opacity-50 hover:border-moonstone-400 transition-colors"
            >
              Suivant
            </button>
          </div>
        </>
      ) : (
        <EmptyState message="Aucune adresse IP sur cette période" />
      )}

      {/* Modal blocage */}
      {blockModal.ip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-prussian-600 rounded-xl border border-prussian-400 p-6 max-w-sm w-full">
            <h3 className="text-white font-bold text-lg mb-4">Bloquer l'IP</h3>
            <p className="text-errorgrey text-sm mb-4">
              Bloquer <span className="font-mono font-bold">{blockModal.ip}</span> ?
            </p>
            <div className="mb-4">
              <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
                Raison (optionnel)
              </label>
              <textarea
                value={blockModal.reason}
                onChange={e => setBlockModal({ ...blockModal, reason: e.target.value })}
                placeholder="Ex: Activité suspecte..."
                className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
                rows="3"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBlockModal({ ip: null, reason: '' })}
                className="flex-1 px-4 py-2 bg-prussian-500 border border-prussian-400 text-white rounded-lg font-semibold hover:border-moonstone-400 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleBlock}
                className="flex-1 px-4 py-2 bg-dustyred-700 text-white rounded-lg font-semibold hover:bg-dustyred-600 transition-colors"
              >
                Bloquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UserAgentsTab({ range }) {
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [botFilter, setBotFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .get('/network/user-agents', {
        params: {
          ...range,
          search,
          bot: botFilter !== 'all' ? botFilter : undefined,
          limit: LIMIT,
          offset,
        },
      })
      .then(res => setData(res.data || []))
      .catch(err => console.error('Erreur chargement User-Agents:', err))
      .finally(() => setLoading(false))
  }, [range, search, botFilter, offset])

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['all', 'true', 'false'].map(val => (
            <button
              key={val}
              onClick={() => { setBotFilter(val); setOffset(0) }}
              className={clsx(
                'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                botFilter === val
                  ? 'bg-moonstone-400 text-prussian-700'
                  : 'bg-prussian-500 border border-prussian-400 text-errorgrey hover:border-moonstone-400'
              )}
            >
              {val === 'all' ? 'Tous' : val === 'true' ? 'Bots' : 'Humains'}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Icon
              icon="ph:magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-base"
            />
            <input
              type="text"
              placeholder="Filtrer par User-Agent..."
              value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0) }}
              className="w-full bg-prussian-500 border border-prussian-400 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
        </div>
      </div>

      {/* Tableau User-Agents */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-prussian-400">
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    User-Agent
                  </th>
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Nom du bot
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Visites
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Dernière visite
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((ua, i) => (
                  <tr
                    key={i}
                    className="border-b border-prussian-600 hover:bg-prussian-500 transition-colors"
                  >
                    <td className="px-4 py-3 text-white truncate max-w-xs text-xs">
                      {ua.ua}
                    </td>
                    <td className="px-4 py-3 text-white text-xs">
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-semibold',
                        ua.is_bot === '1' || ua.is_bot === 1
                          ? 'bg-purple-400/20 text-purple-300'
                          : 'bg-green-400/20 text-green-300'
                      )}>
                        {ua.is_bot === '1' || ua.is_bot === 1 ? 'Bot' : 'Humain'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-lightgrey text-xs">
                      {ua.bot_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-semibold">
                      {parseInt(ua.hits).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right text-errorgrey text-xs">
                      {ua.last_seen ? dayjs(ua.last_seen).format('DD/MM/YYYY HH:mm') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="px-3 py-2 bg-prussian-500 border border-prussian-400 rounded-lg text-white text-sm disabled:opacity-50 hover:border-moonstone-400 transition-colors"
            >
              Précédent
            </button>
            <span className="text-errorgrey text-sm">
              Page {Math.floor(offset / LIMIT) + 1}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={data.length < LIMIT}
              className="px-3 py-2 bg-prussian-500 border border-prussian-400 rounded-lg text-white text-sm disabled:opacity-50 hover:border-moonstone-400 transition-colors"
            >
              Suivant
            </button>
          </div>
        </>
      ) : (
        <EmptyState message="Aucun User-Agent sur cette période" />
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
