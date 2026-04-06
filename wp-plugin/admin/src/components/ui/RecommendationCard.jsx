import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@iconify/react'
import clsx from 'clsx'

export default function RecommendationCard({ recommendation, index = 0 }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="bg-prussian-600 border border-prussian-500 rounded-xl overflow-hidden"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-prussian-500/50 transition-colors text-left"
      >
        <span className="w-6 h-6 rounded-full bg-moonstone-400/20 text-moonstone-400 text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <Icon icon={recommendation.icon || 'ph:lightbulb'} className="text-moonstone-400 text-lg shrink-0" />
        <span className="text-white font-semibold text-sm flex-1">{recommendation.title}</span>
        <Icon
          icon="ph:caret-down"
          className={clsx('text-errorgrey text-sm transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-2 border-t border-prussian-500">
              <div className="flex gap-2 mt-3">
                <Icon icon="ph:arrow-circle-right" className="text-moonstone-400 text-sm shrink-0 mt-0.5" />
                <p className="text-white text-xs leading-relaxed">{recommendation.action}</p>
              </div>
              {recommendation.why && (
                <div className="flex gap-2">
                  <Icon icon="ph:lightbulb" className="text-amber-400 text-sm shrink-0 mt-0.5" />
                  <p className="text-lightgrey text-xs italic leading-relaxed">{recommendation.why}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
