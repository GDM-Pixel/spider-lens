import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const COLORS = {
  green:      '#34d399',
  moonstone:  '#00c6e0',
  amber:      '#f59e0b',
  dustyred:   '#d62246',
}

export default function ScoreGauge({ score = 0, label = '', color = 'moonstone' }) {
  const [displayed, setDisplayed] = useState(0)
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.max(0, Math.min(100, score))
  const offset = circumference - (clampedScore / 100) * circumference
  const hex = COLORS[color] || COLORS.moonstone

  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(score), 200)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="12"
          />
          <motion.circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke={hex}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <span className="text-3xl font-black text-white leading-none">{displayed}</span>
          <span className="text-xs text-errorgrey mt-0.5">/100</span>
        </motion.div>
      </div>
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: hex + '22', color: hex, border: `1px solid ${hex}44` }}
        >
          {label}
        </motion.div>
      )}
    </div>
  )
}
