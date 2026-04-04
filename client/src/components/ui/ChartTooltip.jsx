import React from 'react'
import dayjs from 'dayjs'

/**
 * Tooltip Recharts dark — fond prussian, border visible, valeurs colorées selon la série.
 *
 * Usage :
 *   <Tooltip content={<ChartTooltip />} />
 *   <Tooltip content={<ChartTooltip labelFormatter={v => dayjs(v).format('DD/MM/YYYY')} unit="ms" />} />
 */
export default function ChartTooltip({ active, payload, label, labelFormatter, unit = '' }) {
  if (!active || !payload?.length) return null

  const formattedLabel = labelFormatter ? labelFormatter(label) : label

  return (
    <div className="bg-prussian-600 border border-prussian-300 rounded-lg px-3 py-2 shadow-xl text-xs">
      {formattedLabel && (
        <p className="text-errorgrey mb-1.5 font-medium">{formattedLabel}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
              <span className="text-lightgrey">{entry.name}</span>
            </span>
            <span className="font-semibold" style={{ color: entry.color }}>
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString('fr-FR')
                : entry.value}
              {unit && <span className="text-errorgrey font-normal ml-0.5">{unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
