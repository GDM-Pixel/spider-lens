import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

const COLOR_MAP = {
  green:     { stroke: '#34d399', text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  moonstone: { stroke: '#00c6e0', text: 'text-moonstone-400', bg: 'bg-moonstone-400/10' },
  amber:     { stroke: '#f59e0b', text: 'text-amber-400', bg: 'bg-amber-400/10' },
  dustyred:  { stroke: '#d62246', text: 'text-dustyred-400', bg: 'bg-dustyred-400/10' },
}

export default function ScoreGauge({ score = 0, label = '', color = 'moonstone' }) {
  const c = COLOR_MAP[color] || COLOR_MAP.moonstone
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(Math.max(score, 0), 100) / 100
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Track */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="10"
          />
          {/* Progress */}
          <motion.circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={c.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={clsx('text-3xl font-extrabold leading-none', c.text)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-errorgrey mt-0.5">/100</span>
        </div>
      </div>
      <motion.span
        className={clsx('text-sm font-semibold px-3 py-1 rounded-full border', c.text, c.bg,
          color === 'green' ? 'border-emerald-400/20' :
          color === 'moonstone' ? 'border-moonstone-400/20' :
          color === 'amber' ? 'border-amber-400/20' : 'border-dustyred-400/20'
        )}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.8 }}
      >
        {label}
      </motion.span>
    </div>
  )
}
