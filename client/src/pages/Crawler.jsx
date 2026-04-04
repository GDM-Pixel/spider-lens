import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { kpiVariants } from '../components/ui/KPICard'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import KPICard from '../components/ui/KPICard'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import { useSite } from '../context/SiteContext'
import { useChat } from '../context/ChatContext'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

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

function truncateUrl(url, len = 55) {
  if (!url) return '—'
  if (url.length <= len) return url
  return url.slice(0, len) + '…'
}

export default function Crawler() {
  const { t } = useTranslation()
  const { activeSiteId } = useSite()
  const { setPageContext, clearPageContext } = useChat()

  const [summary, setSummary]         = useState(null)
  const [pages, setPages]             = useState([])
  const [pagesTotal, setPagesTotal]   = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter]           = useState('all')
  const [runs, setRuns]               = useState([])
  const [loadingSum, setLoadingSum]   = useState(false)
  const [loadingPages, setLoadingPages] = useState(false)

  // Charger summary + runs
  useEffect(() => {
    if (!activeSiteId) return
    setLoadingSum(true)
    Promise.all([
      api.get(`/crawler/${activeSiteId}/summary`),
      api.get(`/crawler/${activeSiteId}/runs`),
    ]).then(([s, r]) => {
      setSummary(s.data)
      setRuns(r.data)
    }).finally(() => setLoadingSum(false))
  }, [activeSiteId])

  // Charger pages paginées
  useEffect(() => {
    if (!activeSiteId) return
    setLoadingPages(true)
    const params = { page: currentPage, limit: PAGE_SIZE }
    if (filter !== 'all') params.filter = filter
    api.get(`/crawler/${activeSiteId}/pages`, { params })
      .then(r => {
        setPages(r.data.rows)
        setPagesTotal(r.data.total)
      })
      .finally(() => setLoadingPages(false))
  }, [activeSiteId, currentPage, filter])

  // Reset page quand le filtre change
  function handleFilter(f) {
    setFilter(f)
    setCurrentPage(1)
  }

  // Chat context
  useEffect(() => {
    if (summary && summary.total > 0) {
      setPageContext({
        page: 'crawler',
        totalCrawled: summary.total,
        missingTitle: summary.missingTitle,
        missingH1: summary.missingH1,
        noindex: summary.noindex,
        thinContent: summary.thinContent,
        errors: summary.errors,
        avgWordCount: summary.avgWordCount,
      })
    }
    return () => clearPageContext()
  }, [summary])

  const pageCount = Math.max(1, Math.ceil(pagesTotal / PAGE_SIZE))

  const FILTERS = [
    { key: 'all',           label: t('crawler.filterAll'),           count: summary?.total },
    { key: 'missing_title', label: t('crawler.filterMissingTitle'),  count: summary?.missingTitle },
    { key: 'missing_h1',    label: t('crawler.filterMissingH1'),     count: summary?.missingH1 },
    { key: 'noindex',       label: t('crawler.filterNoindex'),       count: summary?.noindex },
    { key: 'error',         label: t('crawler.filterErrors'),        count: summary?.errors },
  ]

  // Guard : pas de site sélectionné
  if (!activeSiteId) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Icon icon="ph:magnifying-glass-minus" className="text-5xl text-prussian-400" />
        <p className="text-errorgrey text-sm">{t('crawler.noSiteSelected')}</p>
      </div>
    )
  }

  const thinPct = summary?.total > 0 ? summary.thinContent / summary.total : 0

  return (
    <div className="flex flex-col gap-6">

      <BeginnerBanner
        icon="ph:magnifying-glass"
        title={t('crawler.welcomeTitle')}
        tips={[
          t('crawler.tip1'),
          t('crawler.tip2'),
          t('crawler.tip3'),
          t('crawler.tip4'),
        ]}
      />

      {/* KPI Cards */}
      {loadingSum && !summary ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : summary && summary.total > 0 ? (
        <motion.div
          variants={kpiVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4"
        >
          <KPICard
            label={t('crawler.totalCrawled')}
            value={summary.total?.toLocaleString('fr-FR')}
            icon="ph:globe-hemisphere-west"
            color="moonstone"
          />
          <KPICard
            label={t('crawler.missingTitle')}
            value={summary.missingTitle?.toLocaleString('fr-FR')}
            icon="ph:text-t"
            color={summary.missingTitle > 0 ? 'dustyred' : 'moonstone'}
            info={t('crawler.missingTitleInfo')}
          />
          <KPICard
            label={t('crawler.missingH1')}
            value={summary.missingH1?.toLocaleString('fr-FR')}
            icon="ph:heading"
            color={summary.missingH1 > 0 ? 'dustyred' : 'moonstone'}
            info={t('crawler.missingH1Info')}
          />
          <KPICard
            label={t('crawler.noindexPages')}
            value={summary.noindex?.toLocaleString('fr-FR')}
            icon="ph:eye-slash"
            color="moonstone"
            info={t('crawler.noindexInfo')}
          />
          <KPICard
            label={t('crawler.thinContent')}
            value={summary.thinContent?.toLocaleString('fr-FR')}
            icon="ph:file-text"
            color={thinPct > 0.1 ? 'dustyred' : 'moonstone'}
            info={t('crawler.thinContentInfo')}
          />
          <KPICard
            label={t('crawler.crawlErrors')}
            value={summary.errors?.toLocaleString('fr-FR')}
            icon="ph:warning-octagon"
            color={summary.errors > 0 ? 'dustyred' : 'moonstone'}
          />
        </motion.div>
      ) : summary && summary.total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-prussian-600 border border-prussian-500 rounded-xl">
          <Icon icon="ph:magnifying-glass" className="text-4xl text-prussian-400" />
          <p className="text-errorgrey text-sm">{t('crawler.noData')}</p>
          <p className="text-errorgrey/60 text-xs">{t('crawler.noDataHint')}</p>
        </div>
      ) : null}

      {/* Table section */}
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
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded-full text-xs',
                    filter === f.key ? 'bg-white/20 text-white' : 'bg-prussian-400/60 text-lightgrey'
                  )}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
            <span className="ml-auto text-errorgrey text-xs">
              {pagesTotal.toLocaleString('fr-FR')} URLs
            </span>
          </div>

          {/* Tableau */}
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
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={row.url}
                          className="text-moonstone-400 hover:text-moonstone-300 font-mono text-xs truncate block"
                        >
                          {truncateUrl(row.url)}
                        </a>
                        {row.error && (
                          <span className="text-dustyred-400 text-xs">{row.error}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={clsx('inline-block px-1.5 py-0.5 rounded text-xs font-mono font-semibold', statusBadge(row.status_code))}>
                          {row.status_code || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[180px]">
                        {row.title
                          ? <span className="text-white text-xs truncate block" title={row.title}>{row.title.length > 40 ? row.title.slice(0, 40) + '…' : row.title}</span>
                          : <span className="text-dustyred-400 text-xs italic">{t('crawler.absent')}</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 max-w-[160px]">
                        {row.h1
                          ? <span className="text-white text-xs truncate block" title={row.h1}>{row.h1.length > 35 ? row.h1.slice(0, 35) + '…' : row.h1}</span>
                          : <span className="text-dustyred-400 text-xs italic">{t('crawler.absent')}</span>
                        }
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={clsx('text-xs font-semibold', row.word_count > 0 && row.word_count < 300 ? 'text-amber-400' : 'text-lightgrey')}>
                          {row.word_count > 0 ? row.word_count.toLocaleString('fr-FR') : '—'}
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
                    <td className="px-5 py-2.5 text-right text-xs text-lightgrey">{run.pages_found?.toLocaleString('fr-FR') || '—'}</td>
                    <td className="px-5 py-2.5 text-right text-xs text-lightgrey">{run.pages_crawled?.toLocaleString('fr-FR') || '—'}</td>
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
