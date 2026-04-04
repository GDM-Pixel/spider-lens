import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@iconify/react'
import clsx from 'clsx'

export const recoVariants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

export default function RecommendationCard({ reco, index }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      variants={recoVariants}
      className="bg-prussian-600 rounded-xl border border-prussian-400 overflow-hidden"
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-prussian-500/50 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-moonstone-400/15 flex items-center justify-center shrink-0">
          <span className="text-moonstone-400 text-xs font-bold">{index + 1}</span>
        </div>
        <div className="w-8 h-8 rounded-lg bg-moonstone-400/10 flex items-center justify-center shrink-0">
          <Icon icon={reco.icon || 'ph:arrow-bend-up-right'} className="text-moonstone-400 text-base" />
        </div>
        <span className="flex-1 text-white text-sm font-semibold">{reco.title}</span>
        <Icon
          icon="ph:caret-down"
          className={clsx('text-errorgrey text-sm transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-2.5 border-t border-prussian-500 pt-3">
              <div className="flex items-start gap-2">
                <Icon icon="ph:arrow-right" className="text-moonstone-400 text-sm shrink-0 mt-0.5" />
                <p className="text-lightgrey text-xs leading-relaxed">{reco.action}</p>
              </div>
              {reco.why && (
                <div className="flex items-start gap-2">
                  <Icon icon="ph:lightbulb" className="text-amber-400 text-sm shrink-0 mt-0.5" />
                  <p className="text-errorgrey text-xs leading-relaxed italic">{reco.why}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
