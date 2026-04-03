import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import DateRangePicker from '../components/ui/DateRangePicker'
import InfoBubble from '../components/ui/InfoBubble'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import { usePersistentRange } from '../hooks/usePersistentRange'
import { useSort } from '../hooks/useSort'
import SortableHeader from '../components/ui/SortableHeader'
import { useSite } from '../context/SiteContext'
import api from '../api/client'
import dayjs from 'dayjs'
import clsx from 'clsx'

function EmptyTable({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Icon icon="ph:magnifying-glass-minus" className="text-4xl text-prussian-400" />
      <p className="text-errorgrey text-sm">{message}</p>
    </div>
  )
}

function Table404({ data }) {
  const { t } = useTranslation()
  const { sort, toggleSort } = useSort('hits', 'desc')

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sort.by] ?? ''
    const bVal = b[sort.by] ?? ''
    if (sort.dir === 'asc') return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
  })

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-prussian-400">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-bold text-sm">{t('topPages.title404')}</h3>
          <InfoBubble
            title={t('topPages.title404')}
            content={t('topPages.info404Content')}
            impact={t('topPages.info404Impact')}
            action={t('topPages.info404Action')}
          />
        </div>
        <span className="text-errorgrey text-xs">{data.length} URLs</span>
      </div>
      {data.length === 0 ? (
        <EmptyTable message={t('topPages.empty404')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-prussian-400">
                <SortableHeader col="url" sort={sort} onSort={toggleSort} align="left" className="px-5">{t('topPages.headerUrl')}</SortableHeader>
                <SortableHeader col="hits" sort={sort} onSort={toggleSort} className="px-5">{t('topPages.headerHits')}</SortableHeader>
                <SortableHeader col="bot_hits" sort={sort} onSort={toggleSort} className="px-5">{t('topPages.headerBots')}</SortableHeader>
                <SortableHeader col="last_seen" sort={sort} onSort={toggleSort} className="px-5">{t('topPages.headerLastSeen')}</SortableHeader>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
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
  const { t } = useTranslation()
  const { sort, toggleSort } = useSort('hits', 'desc')

  const sorted = [...data].sort((a, b) => {
    const aVal = a[sort.by] ?? ''
    const bVal = b[sort.by] ?? ''
    if (sort.dir === 'asc') return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
  })

  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-prussian-400">
        <h3 className="text-white font-bold text-sm">{t('topPages.titleTop')}</h3>
        <span className="text-errorgrey text-xs">{t('topPages.urlsCount', { count: data.length })}</span>
      </div>
      {data.length === 0 ? (
        <EmptyTable message={t('topPages.emptyTop')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-prussian-400">
                <SortableHeader col="url" sort={sort} onSort={toggleSort} align="left" className="px-5">{t('topPages.headerUrl')}</SortableHeader>
                <SortableHeader col="human_hits" sort={sort} onSort={toggleSort} className="px-5">{t('topPages.headerHumans')}</SortableHeader>
                <SortableHeader col="bot_hits" sort={sort} onSort={toggleSort} className="px-5">{t('topPages.headerBots')}</SortableHeader>
                <SortableHeader col="hits" sort={sort} onSort={toggleSort} className="px-5">{t('topPages.headerTotal')}</SortableHeader>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
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

export default function TopPages() {
  const { t } = useTranslation()
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
        title={t('topPages.welcomeTitle')}
        tips={[
          t('topPages.tip1'),
          t('topPages.tip2'),
          t('topPages.tip3'),
          t('topPages.tip4'),
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('topPages.titleTop')}</h2>
          <p className="text-errorgrey text-sm">{t('topPages.emptyTop')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={exporting || (tab === '404' ? data404.length === 0 : dataPages.length === 0)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-prussian-600 border border-prussian-500 rounded-lg text-xs font-semibold text-errorgrey hover:text-white transition-colors disabled:opacity-40"
          >
            <Icon icon="ph:download-simple" className="text-sm" />
            {exporting ? t('common.exporting') : t('common.csv')}
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
          {t('topPages.tab404')}
          {data404.length > 0 && <span className="bg-dustyred-400/20 text-dustyred-300 text-xs px-1.5 py-0.5 rounded-full">{data404.length}</span>}
        </button>
        <button
          onClick={() => setTab('pages')}
          className={clsx('px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2', tab === 'pages' ? 'bg-prussian-400 text-white' : 'text-errorgrey hover:text-white')}
        >
          <Icon icon="ph:list-magnifying-glass" className={tab === 'pages' ? 'text-moonstone-400' : ''} />
          {t('topPages.tabTop')}
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

