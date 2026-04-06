import React from 'react'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import { useBeginnerMode } from '../../hooks/useBeginnerMode'

export default function BeginnerBanner({ icon = 'ph:lightbulb', title, tips = [] }) {
  const { beginner } = useBeginnerMode()
  if (!beginner) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex gap-3 bg-moonstone-400/8 border border-moonstone-700 rounded-xl px-4 py-3"
    >
      <div className="w-8 h-8 rounded-lg bg-moonstone-400/15 flex items-center justify-center shrink-0 mt-0.5">
        <Icon icon={icon} className="text-moonstone-400 text-base" />
      </div>
      <div className="min-w-0">
        {title && <p className="text-moonstone-300 font-bold text-xs mb-1.5">{title}</p>}
        <ul className="flex flex-col gap-1">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-lightgrey leading-relaxed">
              <span className="text-moonstone-500 mt-0.5 shrink-0">▸</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}
