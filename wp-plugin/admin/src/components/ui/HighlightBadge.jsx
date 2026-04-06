import React from 'react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import clsx from 'clsx'

export default function HighlightBadge({ highlight, index = 0 }) {
  const trendIcon = highlight.trend === 'up'
    ? 'ph:trend-up'
    : highlight.trend === 'down'
    ? 'ph:trend-down'
    : 'ph:minus'

  const trendColor = highlight.trend === 'up'
    ? 'text-emerald-400'
    : highlight.trend === 'down'
    ? 'text-dustyred-400'
    : 'text-errorgrey'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.06 }}
      className="bg-prussian-700/60 border border-prussian-500 rounded-xl p-3 flex flex-col gap-1"
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {highlight.icon && (
          <Icon icon={highlight.icon} className="text-moonstone-400 text-sm" />
        )}
        <span className="text-errorgrey text-xs font-semibold truncate">{highlight.key}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white font-bold text-lg leading-none">{highlight.value}</span>
        <Icon icon={trendIcon} className={clsx('text-sm', trendColor)} />
      </div>
    </motion.div>
  )
}
