import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

// Jours de la semaine — index 0 = dimanche (convention SQLite/MySQL %w / DAYOFWEEK-1)
const WEEKDAY_KEYS = ['dashboard.heatmap.sun', 'dashboard.heatmap.mon', 'dashboard.heatmap.tue',
  'dashboard.heatmap.wed', 'dashboard.heatmap.thu', 'dashboard.heatmap.fri', 'dashboard.heatmap.sat']
const WEEKDAY_FALLBACKS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const HOURS = Array.from({ length: 24 }, (_, i) => i)

/**
 * Transforme le tableau API [{hour, weekday, hits}] en Map "weekday-hour" → hits
 */
function buildGrid(data) {
  const map = new Map()
  for (const { hour, weekday, hits } of data) {
    map.set(`${weekday}-${String(hour).padStart(2, '0')}`, hits)
  }
  return map
}

/**
 * Retourne une couleur moonstone avec opacité proportionnelle à l'intensité.
 * 0 → transparent, max → pleine couleur
 */
function cellColor(hits, maxHits) {
  if (!hits || maxHits === 0) return 'rgba(0, 198, 224, 0.04)'
  const intensity = Math.sqrt(hits / maxHits) // sqrt pour aplatir les écarts
  const alpha = 0.08 + intensity * 0.82        // entre 0.08 et 0.90
  return `rgba(0, 198, 224, ${alpha.toFixed(2)})`
}

export default function HeatmapChart({ data = [] }) {
  const { t } = useTranslation()
  const [tooltip, setTooltip] = useState(null) // { x, y, day, hour, hits }

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-errorgrey text-sm">
        Aucune donnée disponible pour cette période
      </div>
    )
  }

  const grid    = buildGrid(data)
  const maxHits = Math.max(...data.map(d => d.hits), 1)

  return (
    <div className="relative w-full overflow-x-auto">
      {/* Tooltip flottant */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-prussian-700 border border-prussian-400 rounded-lg px-3 py-2 text-xs text-white shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
        >
          <span className="font-semibold text-moonstone-400">{tooltip.day} {String(tooltip.hour).padStart(2, '0')}h</span>
          {' — '}{tooltip.hits.toLocaleString()} {tooltip.hits === 1 ? 'requête' : 'requêtes'}
        </div>
      )}

      <div className="min-w-[640px]">
        {/* Ligne des heures */}
        <div className="flex ml-8 mb-1">
          {HOURS.map(h => (
            <div key={h} className="flex-1 text-center text-errorgrey/60 text-[9px] leading-none">
              {h % 3 === 0 ? `${h}h` : ''}
            </div>
          ))}
        </div>

        {/* Grille 7 lignes × 24 colonnes */}
        {WEEKDAY_FALLBACKS.map((fallback, dayIdx) => {
          const dayLabel = t(WEEKDAY_KEYS[dayIdx], { defaultValue: fallback })
          return (
            <div key={dayIdx} className="flex items-center gap-0.5 mb-0.5">
              {/* Label jour */}
              <div className="w-8 shrink-0 text-right pr-1.5 text-errorgrey/70 text-[9px] font-medium leading-none">
                {dayLabel}
              </div>
              {/* 24 cellules */}
              {HOURS.map(h => {
                const key  = `${dayIdx}-${String(h).padStart(2, '0')}`
                const hits = grid.get(key) ?? 0
                return (
                  <div
                    key={h}
                    className="flex-1 rounded-[2px] cursor-default transition-transform hover:scale-110"
                    style={{
                      height: '14px',
                      backgroundColor: cellColor(hits, maxHits),
                      border: '1px solid rgba(0,198,224,0.06)',
                    }}
                    onMouseEnter={e => setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      day: dayLabel,
                      hour: h,
                      hits,
                    })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })}
            </div>
          )
        })}

        {/* Légende intensité */}
        <div className="flex items-center gap-1.5 mt-2 ml-8">
          <span className="text-errorgrey/60 text-[9px]">Moins</span>
          {[0.04, 0.2, 0.4, 0.6, 0.8, 0.9].map(alpha => (
            <div
              key={alpha}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `rgba(0,198,224,${alpha})`, border: '1px solid rgba(0,198,224,0.1)' }}
            />
          ))}
          <span className="text-errorgrey/60 text-[9px]">Plus</span>
        </div>
      </div>
    </div>
  )
}
