import React, { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import dayjs from 'dayjs'
import clsx from 'clsx'

const LIMIT = 50

export default function Anomalies() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [data, setData] = useState([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const params = {
      limit: LIMIT,
      offset,
    }
    if (typeFilter !== 'all') {
      params.type = typeFilter
    }

    const qs = new URLSearchParams(params).toString()
    fetch(`${window.spiderLens.apiBase}/anomalies?${qs}`, {
      headers: {
        'X-WP-Nonce': window.spiderLens.nonce,
      },
      credentials: 'same-origin',
    })
      .then(res => res.json())
      .then(result => setData(result || []))
      .catch(err => console.error('Erreur chargement anomalies:', err))
      .finally(() => setLoading(false))
  }, [typeFilter, offset])

  const LABELS = {
    traffic_spike: 'Spike de trafic',
    error_rate_spike: "Taux d'erreurs élevé",
  }

  const ICONS = {
    traffic_spike: 'ph:trend-up',
    error_rate_spike: 'ph:warning-circle',
  }

  const handleTypeChange = type => {
    setTypeFilter(type)
    setOffset(0)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-white font-bold text-xl">Anomalies</h2>
        <p className="text-errorgrey text-sm">Détection des pics de trafic et erreurs</p>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'traffic_spike', label: 'Pics de trafic' },
          { id: 'error_rate_spike', label: "Taux d'erreurs" },
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => handleTypeChange(filter.id)}
            className={clsx(
              'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
              typeFilter === filter.id
                ? 'bg-moonstone-400 text-prussian-700'
                : 'bg-prussian-500 border border-prussian-400 text-errorgrey hover:border-moonstone-400'
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Tableau */}
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
                    Type
                  </th>
                  <th className="px-4 py-3 text-center text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Sévérité
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Observé
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Baseline
                  </th>
                  <th className="px-4 py-3 text-left text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Message
                  </th>
                  <th className="px-4 py-3 text-right text-errorgrey text-xs uppercase font-semibold tracking-wide">
                    Détectée le
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((anom, i) => {
                  const isCritical = anom.severity === 'critical'
                  const isWarning = anom.severity === 'warning'

                  return (
                    <tr
                      key={i}
                      className={clsx(
                        'border-b border-prussian-600 hover:bg-prussian-500 transition-colors',
                        isCritical && 'bg-dustyred-400/5'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon
                            icon={ICONS[anom.type] || 'ph:info'}
                            className={clsx(
                              'text-lg',
                              isCritical ? 'text-dustyred-400' : 'text-orange-400'
                            )}
                          />
                          <span className="text-white font-semibold">
                            {LABELS[anom.type] || anom.type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={clsx(
                            'inline-flex items-center px-2 py-1 rounded text-xs font-bold',
                            isCritical
                              ? 'bg-dustyred-400/20 text-dustyred-300'
                              : isWarning
                                ? 'bg-orange-400/20 text-orange-300'
                                : 'bg-green-400/20 text-green-300'
                          )}
                        >
                          {isCritical ? 'Critique' : isWarning ? 'Avertissement' : 'Info'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-semibold font-mono">
                        {anom.observed}
                      </td>
                      <td className="px-4 py-3 text-right text-lightgrey font-mono">
                        {anom.baseline}
                      </td>
                      <td className="px-4 py-3 text-white max-w-sm truncate">
                        {anom.message}
                      </td>
                      <td className="px-4 py-3 text-right text-errorgrey text-xs whitespace-nowrap">
                        {dayjs(anom.detected_at).format('DD/MM/YYYY HH:mm')}
                      </td>
                    </tr>
                  )
                })}
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
        <EmptyState message="Aucune anomalie détectée" />
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
