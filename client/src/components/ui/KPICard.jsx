import React from 'react'
import { Icon } from '@iconify/react'
import clsx from 'clsx'
import InfoBubble from './InfoBubble'

export default function KPICard({ label, value, icon, color = 'moonstone', trend, trendLabel, info }) {
  const colorMap = {
    moonstone: { icon: 'text-moonstone-400', bg: 'bg-moonstone-400/10' },
    dustyred:  { icon: 'text-dustyred-400',  bg: 'bg-dustyred-400/10'  },
    amber:     { icon: 'text-amber-400',     bg: 'bg-amber-400/10'     },
    green:     { icon: 'text-emerald-400',   bg: 'bg-emerald-400/10'   },
    purple:    { icon: 'text-purple-400',    bg: 'bg-purple-400/10'    },
  }
  const c = colorMap[color] || colorMap.moonstone

  return (
    <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', c.bg)}>
          {icon && <Icon icon={icon} className={clsx('text-xl', c.icon)} />}
        </div>
        {info && <InfoBubble content={info} side="top" />}
      </div>

      <div>
        <p className="text-3xl font-extrabold text-white leading-none">{value ?? '—'}</p>
        <p className="text-sm text-errorgrey mt-1 font-semibold">{label}</p>
      </div>

      {trend !== undefined && (
        <div className={clsx('flex items-center gap-1 text-xs font-semibold', trend >= 0 ? 'text-emerald-400' : 'text-dustyred-400')}>
          <Icon icon={trend >= 0 ? 'ph:trend-up' : 'ph:trend-down'} className="text-sm" />
          <span>{trendLabel || `${Math.abs(trend)}%`}</span>
        </div>
      )}
    </div>
  )
}
