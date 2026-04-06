import React from 'react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import clsx from 'clsx'

const IMPACT_CONFIG = {
  critique: {
    badge:  'bg-dustyred-400/20 text-dustyred-300 border border-dustyred-400/30',
    border: 'border-l-dustyred-400',
  },
  warning: {
    badge:  'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    border: 'border-l-amber-400',
  },
  info: {
    badge:  'bg-moonstone-500/20 text-moonstone-300 border border-moonstone-500/30',
    border: 'border-l-moonstone-400',
  },
}

const COLOR_MAP = {
  dustyred:  'text-dustyred-400',
  amber:     'text-amber-400',
  moonstone: 'text-moonstone-400',
}

export default function ProblemCard({ problem, index = 0 }) {
  const config = IMPACT_CONFIG[problem.impact] || IMPACT_CONFIG.info

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={clsx(
        'bg-prussian-600 border border-prussian-500 border-l-4 rounded-xl p-4 flex gap-3',
        config.border
      )}
    >
      <div className="shrink-0 mt-0.5">
        <Icon icon={problem.icon || 'ph:warning'} className={clsx('text-xl', COLOR_MAP[problem.color] || 'text-errorgrey')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-semibold text-sm">{problem.title}</span>
          <span className={clsx('text-xs px-1.5 py-0.5 rounded-full font-semibold', config.badge)}>
            {problem.impact}
          </span>
        </div>
        <p className="text-lightgrey text-xs leading-relaxed">{problem.detail}</p>
      </div>
    </motion.div>
  )
}
