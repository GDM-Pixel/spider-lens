import React, { useEffect, useState, useRef } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import clsx from 'clsx'
import api from '../api/client'
import BeginnerBanner from '../components/ui/BeginnerBanner'

const PAGE_SIZE = 50

function statusBadge(code) {
  if (!code) return 'bg-errorgrey/20 text-errorgrey border border-errorgrey/30'
  if (code < 300) return 'bg-moonstone-500/20 text-moonstone-300 border border-moonstone-500/30'
  if (code < 400) return 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
  if (code < 500) return 'bg-dustyred-400/20 text-dustyred-300 border border-dustyred-400/30'
  return 'bg-red-900/30 text-red-300 border border-red-800/30'
}

function sourceBadge(source) {
  return source === 'sitemap'
    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
    : 'bg-prussian-400/40 text-lightgrey border border-prussian-400/50'
}

function runStatusBadge(status) {
  switch (status) {
    case 'completed':  return 'bg-green-500/20 text-green-300'
    case 'running':    return 'bg-moonstone-500/20 text-moonstone-300'
    case 'cancelled':  return 'bg-amber-500/20 text-amber-300'
    case 'error':      return 'bg-dustyred-400/20 text-dustyred-300'
    default:           return 'bg-errorgrey/20 text-errorgrey'
  }
}

function truncateUrl(url, len = 60) {
  if (!url) return '—'
  if (url.length <= len) return url
  return url.slice(0, len) + '…'
}

function KPICard({ label, value, icon, color = 'moonstone', info }) {
  const colors = {
    moonstone: 'text-moonstone-400 bg-moonstone-400/10 border-moonstone-700',
    dustyred:  'text-dustyred-400  bg-dustyred-400/10  border-dustyred-700',
  }
  return (
    <div className="bg-prussian-600 rounded-xl border border-prussian-500 p-4 flex flex-col gap-2">
      <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center border', colors[color] || colors.moonstone)}>
        <Icon icon={icon} className="text-lg" />
      </div>
      <div className="text-2xl font-bold text-white">{value ?? '—'}</div>
      <div className="text-xs text-errorgrey font-semibold leading-tight">{label}</div>
    </div>
  )
}

export default function Crawler() {
  const { t } = useTranslation()

  const [summary, setSummary]             = useState(null)
  const [pages, setPages]                 = useState([])
  const [pagesTotal, setPagesTotal]       = useState(0)
  const [currentPage, setCurrentPage]     = useState(1)
  const [filter, setFilter]               = useState('all')
  const [runs, setRuns]                   = useState([])
  const [crawlStatus, setCrawlStatus]     = useState(null)
  const [loadingSum, setLoadingSum]       = useState(false)
  const [loadingPages, setLoadingPages]   = useState(false)
  const [starting, setStarting]           = useState(false)
  const [cancelling, setCancelling]       = useState(false)
  const pollRef = useRef(null)

  const isRunning = crawlStatus?.status === 'running'

  // Charger summary + runs + status au mount
  useEffect(() => {
    loadAll()
  }, [])

  // Polling si crawl en cours
  useEffect(() => {
    if (isRunning) {
      pollRef.current = setInterval(() => {
        api.get('/crawler/status').then(r => {
          setCrawlStatus(r.data)
          if (r.data.status !== 'running') {
            clearInterval(pollRef.current)
            loadAll()
          }
        }).catch(() => {})
      }, 3000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [isRunning])

  // Recharger les pages quand le filtre ou la page change
  useEffect(() => {
    loadPages()
  }, [currentPage, filter])

  function loadAll() {
    setLoadingSum(true)
    Promise.all([
      api.get('/crawler/summary'),
      api.get('/crawler/runs'),
      api.get('/crawler/status'),
    ]).then(([s, r, st]) => {
      setSummary(s.data)
      setRuns(r.data)
      setCrawlStatus(st.data)
    }).catch(() => {}).finally(() => {
      setLoadingSum(false)
      loadPages()
    })
  }

  function loadPages() {
    setLoadingPages(true)
    const params = { page: currentPage, limit: PAGE_SIZE }
    if (filter !== 'all') params.filter = filter
    api.get('/crawler/pages', { params })
      .then(r => {
        setPages(r.data.rows || [])
        setPagesTotal(r.data.total || 0)
      })
      .catch(() => {})
      .finally(() => setLoadingPages(false))
  }

  function handleFilter(f) {
    setFilter(f)
    setCurrentPage(1)
  }

  async function handleStart() {
    setStarting(true)
    try {
      const r = await api.post('/crawler/start')
      setCrawlStatus({ status: 'running', pagesFound: 0, pagesCrawled: 0 })
    } catch (err) {
      console.error('Erreur démarrage crawl:', err)
    } finally {
      setStarting(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    try {
      await api.post('/crawler/cancel')
      setCrawlStatus(prev => ({ ...prev, status: 'cancelled' }))
      clearInterval(pollRef.current)
      setTimeout(() => loadAll(), 500)
    } catch (err) {
      console.error('Erreur annulation crawl:', err)
    } finally {
      setCancelling(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(pagesTotal / PAGE_SIZE))

  const FILTERS = [
    { key: 'all',           label: t('crawler.filterAll'),          count: summary?.total },
    { key: 'missing_title', label: t('crawler.filterMissingTitle'), count: summary?.missingTitle },
    { key: 'missing_h1',    label: t('crawler.filterMissingH1'),    count: summary?.missingH1 },
    { key: 'noindex',       label: t('crawler.filterNoindex'),      count: summary?.noindex },
    { key: 'error',         label: t('crawler.filterErrors'),       count: summary?.errors },
  ]

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:magnifying-glass"
        title={t('crawler.welcomeTitle')}
        tips={[t('crawler.tip1'), t('crawler.tip2'), t('crawler.tip3'), t('crawler.tip4')]}
      />

      <div>
        <h2 className="text-white font-bold text-xl">{t('crawler.welcomeTitle')}</h2>
        <p className="text-errorgrey text-sm">{t('header.pages.crawler.subtitle')}</p>
      </div>

      {/* Barre de statut du crawl */}
      <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-4 flex flex-wrap items-center gap-4">
        {isRunning ? (
          <>
            <div className="flex items-center gap-2 flex-1">
              <div className="w-3 h-3 rounded-full bg-moonstone-400 animate-pulse" />
              <span className="text-white font-semibold text-sm">{t('settings.crawlRunning')}</span>
              <span className="text-errorgrey text-sm ml-2">
                {crawlStatus?.pagesCrawled ?? 0} / {crawlStatus?.pagesFound ?? 0} {t('settings.crawlPages')}
              </span>
            </div>
            {crawlStatus?.pagesFound > 0 && (
              <div className="flex-1 min-w-[120px]">
                <div className="w-full bg-prussian-700 rounded-full h-1.5">
                  <div
                    className="bg-moonstone-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((crawlStatus.pagesCrawled || 0) / crawlStatus.pagesFound) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-2 px-4 py-2 bg-dustyred-400 text-white font-bold rounded-lg hover:bg-dustyred-300 transition-colors text-sm disabled:opacity-50"
            >
              <Icon icon="ph:x" />
              {t('settings.cancelCrawl')}
            </button>
          </>
        ) : (
          <>
            <div className="flex-1">
              {crawlStatus?.status === 'completed' && crawlStatus?.finishedAt && (
                <p className="text-errorgrey text-sm">
                  {t('settings.lastCrawl')} : {dayjs(crawlStatus.finishedAt).format('DD/MM/YYYY HH:mm')}
                  {' — '}{crawlStatus.pagesCrawled} pages
                </p>
              )}
              {(!crawlStatus || crawlStatus.status === 'idle') && (
                <p className="text-errorgrey text-sm">{t('settings.noCrawlYet')}</p>
              )}
            </div>
            <button
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-2 px-4 py-2 bg-moonstone-400 text-prussian-700 font-bold rounded-lg hover:bg-moonstone-300 transition-colors text-sm disabled:opacity-50"
            >
              <Icon icon="ph:play" />
              {starting ? '...' : t('settings.launchCrawl')}
            </button>
          </>
        )}
      </div>

      {/* KPI Cards */}
      {loadingSum && !summary ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : summary && summary.total > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard label={t('crawler.totalCrawled')}  value={summary.total?.toLocaleString()}       icon="ph:globe-hemisphere-west" color="moonstone" />
          <KPICard label={t('crawler.missingTitle')}  value={summary.missingTitle?.toLocaleString()} icon="ph:text-t"               color={summary.missingTitle > 0 ? 'dustyred' : 'moonstone'} />
          <KPICard label={t('crawler.missingH1')}     value={summary.missingH1?.toLocaleString()}    icon="ph:text-h-one"           color={summary.missingH1 > 0 ? 'dustyred' : 'moonstone'} />
          <KPICard label={t('crawler.noindexPages')}  value={summary.noindex?.toLocaleString()}      icon="ph:eye-slash"            color="moonstone" />
          <KPICard label={t('crawler.thinContent')}   value={summary.thinContent?.toLocaleString()}  icon="ph:file-text"            color={summary.thinContent > summary.total * 0.1 ? 'dustyred' : 'moonstone'} />
          <KPICard label={t('crawler.crawlErrors')}   value={summary.errors?.toLocaleString()}       icon="ph:warning-octagon"      color={summary.errors > 0 ? 'dustyred' : 'moonstone'} />
        </div>
      ) : summary && summary.total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-prussian-600 border border-prussian-500 rounded-xl">
          <Icon icon="ph:magnifying-glass" className="text-4xl text-prussian-400" />
          <p className="text-errorgrey text-sm">{t('crawler.noData')}</p>
          <p className="text-errorgrey/60 text-xs">{t('crawler.noDataHint')}</p>
        </div>
      ) : null}

      {/* Tableau des pages */}
      {summary && summary.total > 0 && (
        <div className="bg-prussian-500 rounded-xl border border-prussian-400 overflow-hidden">
          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-prussian-400">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => handleFilter(f.key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  filter === f.key
                    ? 'bg-moonstone-500 text-white'
                    : 'bg-prussian-600 text-errorgrey border border-prussian-400 hover:text-white'
                )}
              >
                {f.label}
                {f.count != null && f.count > 0 && (
                  <span className={clsx('px-1.5 py-0.5 rounded-full text-xs', filter === f.key ? 'bg-white/20 text-white' : 'bg-prussian-400/60 text-lightgrey')}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
            <span className="ml-auto text-errorgrey text-xs">{pagesTotal.toLocaleString()} URLs</span>
          </div>

          {/* Table */}
          {loadingPages ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Icon icon="ph:check-circle" className="text-4xl text-green-400" />
              <p className="text-errorgrey text-sm">{t('crawler.noIssues')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-prussian-400">
                    <th className="px-4 py-3 text-left text-xs text-errorgrey font-semibold uppercase tracking-wider">{t('crawler.columnUrl')}</th>
                    <th className="px-4 py-3 text-center text-xs text-errorgrey font-semibold uppercase tracking-wider w-16">{t('crawler.columnStatus')}</th>
                    <th className="px-4 py-3 text-left text-xs text-errorgrey font-semibold uppercase tracking-wider">{t('crawler.columnTitle')}</th>
                    <th className="px-4 py-3 text-left text-xs text-errorgrey font-semibold uppercase tracking-wider">{t('crawler.columnH1')}</th>
                    <th className="px-4 py-3 text-right text-xs text-errorgrey font-semibold uppercase tracking-wider w-20">{t('crawler.columnWords')}</th>
                    <th className="px-4 py-3 text-center text-xs text-errorgrey font-semibold uppercase tracking-wider w-16">{t('crawler.columnDepth')}</th>
                    <th className="px-4 py-3 text-center text-xs text-errorgrey font-semibold uppercase tracking-wider w-24">{t('crawler.columnSource')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((row, i) => (
                    <tr
                      key={i}
                      className={clsx(
                        'border-b border-prussian-400/50 hover:bg-prussian-400/30 transition-colors',
                        i % 2 === 0 ? 'bg-prussian-500' : 'bg-prussian-600/30'
                      )}
                    >
                      <td className="px-4 py-2.5 max-w-xs">
                        <a href={row.url} target="_blank" rel="noopener noreferrer" title={row.url}
                           className="text-moonstone-400 hover:text-moonstone-300 font-mono text-xs truncate block">
                          {truncateUrl(row.url)}
                        </a>
                        {row.error && <span className="text-dustyred-400 text-xs">{row.error}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={clsx('inline-block px-1.5 py-0.5 rounded text-xs font-mono font-semibold', statusBadge(row.status_code))}>
                          {row.status_code || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        {row.title
                          ? <span className="text-white text-xs truncate block" title={row.title}>{row.title.length > 40 ? row.title.slice(0, 40) + '…' : row.title}</span>
                          : <span className="text-dustyred-400 text-xs italic">{t('crawler.absent')}</span>}
                      </td>
                      <td className="px-4 py-2.5 max-w-[160px]">
                        {row.h1
                          ? <span className="text-white text-xs truncate block" title={row.h1}>{row.h1.length > 35 ? row.h1.slice(0, 35) + '…' : row.h1}</span>
                          : <span className="text-dustyred-400 text-xs italic">{t('crawler.absent')}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={clsx('text-xs font-semibold', row.word_count > 0 && row.word_count < 300 ? 'text-amber-400' : 'text-lightgrey')}>
                          {row.word_count > 0 ? row.word_count.toLocaleString() : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-errorgrey">{row.depth}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={clsx('inline-block px-2 py-0.5 rounded-full text-xs font-semibold', sourceBadge(row.source))}>
                          {row.source || 'sitemap'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-prussian-400">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-600 border border-prussian-400 rounded-lg text-xs font-semibold text-errorgrey hover:text-white disabled:opacity-40 transition-colors"
              >
                <Icon icon="ph:arrow-left" className="text-sm" />
                {t('common.previous')}
              </button>
              <span className="text-errorgrey text-xs">
                {t('common.page', { page: currentPage, total: pageCount })}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-600 border border-prussian-400 rounded-lg text-xs font-semibold text-errorgrey hover:text-white disabled:opacity-40 transition-colors"
              >
                {t('common.next')}
                <Icon icon="ph:arrow-right" className="text-sm" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Historique des crawls */}
      {runs.length > 0 && (
        <div className="bg-prussian-600 border border-prussian-500 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-prussian-500">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Icon icon="ph:clock-clockwise" className="text-moonstone-400" />
              {t('crawler.recentRuns')}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-prussian-500">
                  <th className="px-5 py-3 text-left text-xs text-errorgrey font-semibold uppercase tracking-wider">{t('crawler.runDate')}</th>
                  <th className="px-5 py-3 text-center text-xs text-errorgrey font-semibold uppercase tracking-wider">{t('crawler.runStatus')}</th>
                  <th className="px-5 py-3 text-right text-xs text-errorgrey font-semibold uppercase tracking-wider">{t('crawler.runPagesFound')}</th>
                  <th className="px-5 py-3 text-right text-xs text-errorgrey font-semibold uppercase tracking-wider">{t('crawler.runPagesCrawled')}</th>
                  <th className="px-5 py-3 text-left text-xs text-errorgrey font-semibold uppercase tracking-wider">{t('crawler.runError')}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => (
                  <tr key={run.id} className={clsx('border-b border-prussian-500/50', i % 2 === 0 ? 'bg-prussian-600' : 'bg-prussian-700/30')}>
                    <td className="px-5 py-2.5 text-xs text-lightgrey">
                      {run.started_at ? dayjs(run.started_at).format('DD/MM/YYYY HH:mm') : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-center">
                      <span className={clsx('inline-block px-2 py-0.5 rounded-full text-xs font-semibold', runStatusBadge(run.status))}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs text-lightgrey">{run.pages_found?.toLocaleString() || '—'}</td>
                    <td className="px-5 py-2.5 text-right text-xs text-lightgrey">{run.pages_crawled?.toLocaleString() || '—'}</td>
                    <td className="px-5 py-2.5 text-xs text-dustyred-400">{run.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
