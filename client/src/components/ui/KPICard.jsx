import React from 'react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import clsx from 'clsx'
import InfoBubble from './InfoBubble'
import { useCountUp } from '../../hooks/useCountUp'

// Variantes d'animation pour chaque carte (utilisées avec staggerChildren du parent)
export const kpiVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
}

export default function KPICard({ label, value, icon, color = 'moonstone', trend, trendLabel, info }) {
  const colorMap = {
    moonstone: { icon: 'text-moonstone-400', bg: 'bg-moonstone-400/10' },
    dustyred:  { icon: 'text-dustyred-400',  bg: 'bg-dustyred-400/10'  },
    amber:     { icon: 'text-amber-400',     bg: 'bg-amber-400/10'     },
    green:     { icon: 'text-emerald-400',   bg: 'bg-emerald-400/10'   },
    purple:    { icon: 'text-purple-400',    bg: 'bg-purple-400/10'    },
  }
  const c = colorMap[color] || colorMap.moonstone
  const animated = useCountUp(value)

  return (
    <motion.div
      variants={kpiVariants}
      className="bg-prussian-500 rounded-xl border border-prussian-400 p-5 flex flex-col gap-3 hover:border-prussian-300 hover:shadow-lg hover:shadow-black/10 transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={clsx('w-12 h-12 rounded-lg flex items-center justify-center shrink-0', c.bg)}>
            {icon && <Icon icon={icon} className={clsx('text-2xl', c.icon)} />}
          </div>
          <p className={clsx('text-base font-semibold leading-tight', c.icon)}>{label}</p>
        </div>
        {info && <InfoBubble content={info} side="top" />}
      </div>

      <div>
        <p className="text-3xl font-extrabold text-white leading-none">{animated ?? '—'}</p>
      </div>

      {trend !== undefined && (
        <div className={clsx('flex items-center gap-1 text-xs font-semibold', trend >= 0 ? 'text-emerald-400' : 'text-dustyred-400')}>
          <Icon icon={trend >= 0 ? 'ph:trend-up' : 'ph:trend-down'} className="text-sm" />
          <span>{trendLabel || `${Math.abs(trend)}%`}</span>
        </div>
      )}
    </motion.div>
  )
}
