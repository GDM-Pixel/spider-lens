import React from 'react'
import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import clsx from 'clsx'

const IMPACT_CONFIG = {
  critique: {
    badge: 'bg-dustyred-400/15 text-dustyred-300 border-dustyred-400/30',
    border: 'border-l-dustyred-400',
    label: 'Critique',
  },
  warning: {
    badge: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    border: 'border-l-amber-400',
    label: 'Avertissement',
  },
  info: {
    badge: 'bg-moonstone-400/15 text-moonstone-300 border-moonstone-400/30',
    border: 'border-l-moonstone-400',
    label: 'Info',
  },
}

const COLOR_MAP = {
  dustyred:  { icon: 'text-dustyred-400',  bg: 'bg-dustyred-400/10'  },
  amber:     { icon: 'text-amber-400',     bg: 'bg-amber-400/10'     },
  moonstone: { icon: 'text-moonstone-400', bg: 'bg-moonstone-400/10' },
  green:     { icon: 'text-emerald-400',   bg: 'bg-emerald-400/10'   },
}

export const problemVariants = {
  hidden: { opacity: 0, x: -32, scale: 0.95 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 22 } },
}

export default function ProblemCard({ problem }) {
  const impact = IMPACT_CONFIG[problem.impact] || IMPACT_CONFIG.info
  const c = COLOR_MAP[problem.color] || COLOR_MAP.dustyred

  return (
    <motion.div
      variants={problemVariants}
      className={clsx(
        'bg-prussian-600 rounded-xl border border-prussian-400 border-l-4 p-4 flex items-start gap-3',
        impact.border,
      )}
    >
      <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', c.bg)}>
        <Icon icon={problem.icon || 'ph:warning-diamond'} className={clsx('text-lg', c.icon)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-white text-sm font-semibold">{problem.title}</span>
          <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', impact.badge)}>
            {impact.label}
          </span>
        </div>
        <p className="text-errorgrey text-xs leading-relaxed">{problem.detail}</p>
      </div>
    </motion.div>
  )
}
