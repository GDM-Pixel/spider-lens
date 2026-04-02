import React from 'react'
import { Icon } from '@iconify/react'
import clsx from 'clsx'
import InfoBubble from './InfoBubble'

export default function KPICard({ label, value, icon, color = 'moonstone', info }) {
  const colorMap = {
    moonstone: { icon: 'text-moonstone-400', bg: 'bg-moonstone-400/10' },
    dustyred:  { icon: 'text-dustyred-400',  bg: 'bg-dustyred-400/10'  },
    amber:     { icon: 'text-amber-400',     bg: 'bg-amber-400/10'     },
    green:     { icon: 'text-emerald-400',   bg: 'bg-emerald-400/10'   },
    purple:    { icon: 'text-purple-400',    bg: 'bg-purple-400/10'    },
  }
  const c = colorMap[color] || colorMap.moonstone

  return (
    <div className="bg-prussian-500 rounded-xl border border-prussian-400 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', c.bg)}>
          {icon && <Icon icon={icon} className={clsx('text-lg', c.icon)} />}
        </div>
        {info && <InfoBubble content={info} />}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-white leading-none">{value ?? '—'}</p>
        <p className="text-xs text-errorgrey mt-1 font-semibold">{label}</p>
      </div>
    </div>
  )
}
