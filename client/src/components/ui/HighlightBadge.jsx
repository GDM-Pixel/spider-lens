import React from 'react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import clsx from 'clsx'

const TREND_CONFIG = {
  up:      { icon: 'ph:trend-up',   color: 'text-emerald-400' },
  down:    { icon: 'ph:trend-down', color: 'text-dustyred-400' },
  neutral: { icon: 'ph:minus',      color: 'text-errorgrey' },
}

export const highlightVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
}

export default function HighlightBadge({ highlight }) {
  const trend = TREND_CONFIG[highlight.trend] || TREND_CONFIG.neutral

  return (
    <motion.div
      variants={highlightVariants}
      className="bg-prussian-600 border border-prussian-400 rounded-xl p-3 flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-lg bg-moonstone-400/10 flex items-center justify-center shrink-0">
        <Icon icon={highlight.icon || 'ph:chart-bar'} className="text-moonstone-400 text-base" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{highlight.value}</p>
        <p className="text-errorgrey text-xs truncate">{highlight.key}</p>
      </div>
      <Icon icon={trend.icon} className={clsx('text-base shrink-0', trend.color)} />
    </motion.div>
  )
}
