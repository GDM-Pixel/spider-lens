import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import DateRangePicker from '../components/ui/DateRangePicker'
import { usePersistentRange } from '../hooks/usePersistentRange'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'
import { usePageContext } from '../hooks/usePageContext'
import { useRefresh } from '../context/RefreshContext'

const LIMIT = 50

export default function Network() {
  const { t } = useTranslation()
  const [range, setRange] = usePersistentRange('network')
  const [activeTab, setActiveTab] = useState('ips')

  usePageContext(() =>
    api.get('/network/ips', { params: { ...range, limit: 20 } }).then(r => ({
      page:  'Network',
      range,
      topIps: r.data?.slice(0, 20),
    }))
  )

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:network"
        title={t('network.welcomeTitle')}
        tips={[
          t('network.tip1'),
          t('network.tip2'),
          t('network.tip3'),
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('network.welcomeTitle')}</h2>
          <p className="text-errorgrey text-sm">{t('network.tip1')}</p>
        </div>
        <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-prussian-400">
        {[
          { id: 'ips', labelKey: 'network.tabIps' },
          { id: 'user-agents', labelKey: 'network.tabUa' },
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
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'ips' && <IPsTab range={range} t={t} />}
      {activeTab === 'user-agents' && <UserAgentsTab range={range} t={t} />}
    </div>
  )
}

function IPsTab({ range, t }) {
  const [data, setData] = useState([])
  const [blocklist, setBlocklist] = useState(new Set())
  const [search, setSearch] = useState('')
  const [botFilter, setBotFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedIP, setExpandedIP] = useState(null)
  const [expandedData, setExpandedData] = useState({})
  const [blockModal, setBlockModal] = useState({ ip: null, reason: '' })
  const { refreshKey, consumeFresh } = useRefresh()

  useEffect(() => {
    setLoading(true)
    const fresh = consumeFresh()
    Promise.all([
      api.get('/network/ips', {
        params: { ...range, search, bot: botFilter !== 'all' ? botFilter : undefined, limit: LIMIT, offset },
        fresh,
      }),
      api.get('/blocklist'),
    ])
      .then(([ipsRes, blockRes]) => {
        setData(ipsRes.data || [])
        setBlocklist(new Set((blockRes.data || []).map(b => b.ip)))
      })
      .catch(err => console.error('Erreur chargement IPs:', err))
      .finally(() => setLoading(false))
  }, [range, search, botFilter, offset, refreshKey])

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

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to })
      const url = `${window.spiderLens.apiBase}/network/ips/export?${params}`
      const res = await fetch(url, { headers: { 'X-WP-Nonce': window.spiderLens.nonce }, credentials: 'same-origin' })
      if (res.ok) {
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `ips-${range.from}-${range.to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch (err) { console.error('Export error:', err) }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres + Export */}
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
              {val === 'all' ? t('common.all') : val === 'true' ? t('common.bots') : t('common.humans')}
            </button>
          ))}
        </div>
        <div className="flex flex-1 min-w-[200px] gap-2">
          <div className="relative flex-1">
            <Icon
              icon="ph:magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-base"
            />
            <input
              type="text"
              placeholder={t('network.headerIp')}
              value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0) }}
              className="w-full bg-prussian-500 border border-prussian-400 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm shrink-0"
          >
            <Icon icon="ph:download" className="text-base" />
            {t('common.csv')}
          </button>
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
                    {t('network.headerIp')}
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('common.hits')}
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('common.bots')}
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('common.humans')}
                  </th>
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('common.by')}
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('common.lastSeen')}
                  </th>
                  <th className="px-4 py-3 text-center text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('network.blockModalTitle')}
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
                            {t('network.badgeBlocked')}
                          </span>
                        ) : (
                          <button
                            onClick={() => setBlockModal({ ip: ip.ip, reason: '' })}
                            className="text-moonstone-400 hover:text-moonstone-300 text-sm font-semibold"
                          >
                            {t('network.blockModalCancel')}
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
                                  <th className="px-3 py-2 text-left text-errorgrey font-semibold">{t('common.url')}</th>
                                  <th className="px-3 py-2 text-right text-errorgrey font-semibold">{t('common.status')}</th>
                                  <th className="px-3 py-2 text-right text-errorgrey font-semibold">{t('common.hits')}</th>
                                  <th className="px-3 py-2 text-right text-errorgrey font-semibold">{t('common.lastSeen')}</th>
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
        <EmptyState message={t('network.emptyIps')} />
      )}

      {/* Modal blocage */}
      {blockModal.ip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-prussian-600 rounded-xl border border-prussian-400 p-6 max-w-sm w-full">
            <h3 className="text-white font-bold text-lg mb-4">{t('network.blockModalTitle')}</h3>
            <p className="text-errorgrey text-sm mb-4">
              Bloquer <span className="font-mono font-bold">{blockModal.ip}</span> ?
            </p>
            <div className="mb-4">
              <label className="block text-errorgrey text-xs uppercase font-semibold tracking-wide mb-2">
                {t('network.blockModalReasonLabel')}
              </label>
              <textarea
                value={blockModal.reason}
                onChange={e => setBlockModal({ ...blockModal, reason: e.target.value })}
                placeholder={t('network.blockModalReasonPlaceholder')}
                className="w-full bg-prussian-700 border border-prussian-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
                rows="3"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBlockModal({ ip: null, reason: '' })}
                className="flex-1 px-4 py-2 bg-prussian-500 border border-prussian-400 text-white rounded-lg font-semibold hover:border-moonstone-400 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleBlock}
                className="flex-1 px-4 py-2 bg-dustyred-700 text-white rounded-lg font-semibold hover:bg-dustyred-600 transition-colors"
              >
                {t('network.blockModalTitle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UserAgentsTab({ range, t }) {
  const [data, setData] = useState([])
  const [search, setSearch] = useState('')
  const [botFilter, setBotFilter] = useState('all')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const { refreshKey, consumeFresh } = useRefresh()

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ from: range.from, to: range.to })
      const url = `${window.spiderLens.apiBase}/network/user-agents/export?${params}`
      const res = await fetch(url, { headers: { 'X-WP-Nonce': window.spiderLens.nonce }, credentials: 'same-origin' })
      if (res.ok) {
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `user-agents-${range.from}-${range.to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch (err) { console.error('Export error:', err) }
  }

  useEffect(() => {
    setLoading(true)
    const fresh = consumeFresh()
    api
      .get('/network/user-agents', {
        params: {
          ...range,
          search,
          bot: botFilter !== 'all' ? botFilter : undefined,
          limit: LIMIT,
          offset,
        },
        fresh,
      })
      .then(res => setData(res.data || []))
      .catch(err => console.error('Erreur chargement User-Agents:', err))
      .finally(() => setLoading(false))
  }, [range, search, botFilter, offset, refreshKey])

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
              {val === 'all' ? t('common.all') : val === 'true' ? t('common.bots') : t('common.humans')}
            </button>
          ))}
        </div>
        <div className="flex flex-1 min-w-[200px] gap-2">
          <div className="relative flex-1">
            <Icon
              icon="ph:magnifying-glass"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-errorgrey text-base"
            />
            <input
              type="text"
              placeholder={t('network.headerUa')}
              value={search}
              onChange={e => { setSearch(e.target.value); setOffset(0) }}
              className="w-full bg-prussian-500 border border-prussian-400 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-moonstone-400"
            />
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm shrink-0"
          >
            <Icon icon="ph:download" className="text-base" />
            {t('common.csv')}
          </button>
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
                    {t('network.headerUa')}
                  </th>
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    {t('network.typeBot')}
                  </th>
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
                        {ua.is_bot === '1' || ua.is_bot === 1 ? t('network.typeBot') : t('network.typeHuman')}
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
        <EmptyState message={t('network.emptyUa')} />
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
