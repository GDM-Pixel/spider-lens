import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@iconify/react'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import { useSite } from '../context/SiteContext'
import { useChat } from '../context/ChatContext'
import api from '../api/client'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'
import clsx from 'clsx'

dayjs.extend(relativeTime)
dayjs.locale('fr')

const PAGE_SIZE = 50

const TYPE_CONFIG = {
  traffic_spike:    { icon: 'ph:trend-up',           color: 'text-orange-400' },
  error_rate_spike: { icon: 'ph:warning-circle',     color: 'text-dustyred-400' },
  googlebot_absent: { icon: 'ph:robot',              color: 'text-yellow-400' },
  unknown_bot_spike:{ icon: 'ph:question',           color: 'text-purple-400' },
}

function AnomalyRow({ row }) {
  const { t } = useTranslation()
  const config = TYPE_CONFIG[row.type] || { icon: 'ph:info', color: 'text-errorgrey' }
  const label = t(`anomalies.${row.type}`)
  const isCritical = row.severity === 'critical'

  return (
    <div className={clsx(
      'bg-prussian-600 rounded-xl border p-4 flex items-start gap-4',
      isCritical ? 'border-dustyred-700' : 'border-prussian-500'
    )}>
      <div className={clsx(
        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
        isCritical ? 'bg-dustyred-400/10' : 'bg-prussian-500'
      )}>
        <Icon icon={config.icon} className={clsx('text-xl', config.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx('font-semibold text-sm', config.color)}>{label}</span>
          {isCritical && (
            <span className="text-xs bg-dustyred-400/10 text-dustyred-300 border border-dustyred-700 rounded-full px-2 py-0.5">
              {t('anomalies.badgeCritical')}
            </span>
          )}
          {row.site_name && (
            <span className="text-xs bg-prussian-500 text-errorgrey rounded-full px-2 py-0.5">
              {row.site_name}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-errorgrey">
          {row.value_observed != null && row.baseline_mean != null && row.type !== 'googlebot_absent' && (
            <>
              <span>
                {t('anomalies.observed')} : <strong className="text-white">
                  {row.type.includes('rate') || row.type.includes('bot_spike')
                    ? `${Math.round(row.value_observed * 100)}%`
                    : Math.round(row.value_observed).toLocaleString()}
                </strong>
              </span>
              <span>
                {t('anomalies.baseline')} : <strong className="text-white">
                  {row.type.includes('rate') || row.type.includes('bot_spike')
                    ? `${Math.round(row.baseline_mean * 100)}%`
                    : Math.round(row.baseline_mean).toLocaleString()}
                </strong>
                {row.baseline_stddev != null && (
                  <span className="text-prussian-300"> ±{
                    row.type.includes('rate') || row.type.includes('bot_spike')
                      ? `${Math.round(row.baseline_stddev * 100)}%`
                      : Math.round(row.baseline_stddev).toLocaleString()
                  }</span>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="text-right text-xs text-errorgrey shrink-0">
        <div>{dayjs(row.detected_at).format('DD/MM/YYYY HH:mm')}</div>
        <div className="text-prussian-300">{dayjs(row.detected_at).fromNow()}</div>
      </div>
    </div>
  )
}

export default function Anomalies() {
  const { t } = useTranslation()
  const { activeSiteId } = useSite()
  const { setPageContext, clearPageContext } = useChat()
  const [rows, setRows]         = useState([])
  const [total, setTotal]       = useState(0)
  const [offset, setOffset]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [typeFilter, setTypeFilter] = useState('')

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = { limit: PAGE_SIZE, offset }
    if (activeSiteId) params.siteId = activeSiteId
    if (typeFilter) params.type = typeFilter
    api.get('/alerts/anomalies', { params })
      .then(r => { setRows(r.data.rows); setTotal(r.data.total) })
      .finally(() => setLoading(false))
  }, [activeSiteId, offset, typeFilter])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setOffset(0) }, [activeSiteId, typeFilter])

  useEffect(() => {
    if (rows.length > 0) {
      setPageContext({
        page: 'anomalies',
        total,
        filter: typeFilter || 'all',
        anomalies: rows.slice(0, 5).map(r => ({ type: r.type, severity: r.severity, date: r.detected_at })),
      })
    }
    return () => clearPageContext()
  }, [rows, typeFilter])

  return (
    <div className="flex flex-col gap-6">
      <BeginnerBanner
        icon="ph:warning-diamond"
        title={t('anomalies.welcomeTitle')}
        tips={[
          t('anomalies.tip1'),
          t('anomalies.tip2'),
          t('anomalies.tip3'),
          t('anomalies.tip4'),
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-xl">{t('anomalies.welcomeTitle')}</h2>
          <p className="text-errorgrey text-sm">{t('common.description')}</p>
        </div>
        <span className="text-errorgrey text-sm">{t('anomalies.count', { count: total })}</span>
      </div>

      {/* Filtres par type */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter('')}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
            typeFilter === ''
              ? 'bg-moonstone-400/20 text-moonstone-300 border-moonstone-600'
              : 'bg-prussian-600 text-errorgrey border-prussian-500 hover:text-white'
          )}
        >{t('anomalies.filterAll')}</button>
        {Object.entries(TYPE_CONFIG).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(key)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
              typeFilter === key
                ? 'bg-moonstone-400/20 text-moonstone-300 border-moonstone-600'
                : 'bg-prussian-600 text-errorgrey border-prussian-500 hover:text-white'
            )}
          >
            <Icon icon={config.icon} className={clsx('text-sm', config.color)} />
            {t(`anomalies.${key}`)}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="bg-prussian-600 rounded-xl border border-prussian-500 p-12 text-center">
          <Icon icon="ph:check-circle" className="text-green-400 text-4xl mx-auto mb-3" />
          <p className="text-white font-semibold">{t('anomalies.emptyTitle')}</p>
          <p className="text-errorgrey text-sm mt-1">
            {total === 0
              ? t('anomalies.emptyTextNew')
              : t('anomalies.emptyTextFiltered')}
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {rows.map(row => <AnomalyRow key={row.id} row={row} />)}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
            className="px-4 py-2 bg-prussian-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-prussian-500 transition-colors"
          >← {t('common.previous')}</button>
          <span className="text-errorgrey text-sm">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} {t('common.of')} {total.toLocaleString()}
          </span>
          <button
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(o => o + PAGE_SIZE)}
            className="px-4 py-2 bg-prussian-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-prussian-500 transition-colors"
          >{t('common.next')} →</button>
        </div>
      )}
    </div>
  )
}
