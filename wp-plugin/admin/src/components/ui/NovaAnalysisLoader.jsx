import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const STEPS_KEYS = [
  'assistant.loaderStep1',
  'assistant.loaderStep2',
  'assistant.loaderStep3',
  'assistant.loaderStep4',
  'assistant.loaderStep5',
]

export default function NovaAnalysisLoader() {
  const { t } = useTranslation()
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex(i => Math.min(i + 1, STEPS_KEYS.length - 1))
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      {/* Orb animé */}
      <div className="relative w-24 h-24">
        <motion.div
          className="absolute inset-0 rounded-full bg-moonstone-400/20 border border-moonstone-400/40"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full bg-moonstone-400/10 border border-moonstone-400/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-4 rounded-full bg-moonstone-400/15 border border-moonstone-400/20"
          animate={{ rotate: -360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-8 h-8 rounded-full bg-moonstone-400/40"
            animate={{ scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
        </div>
      </div>

      {/* Étape courante */}
      <div className="h-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="text-errorgrey text-sm"
          >
            {t(STEPS_KEYS[stepIndex])}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Barre de progression indéterminée */}
      <div className="w-48 h-1 bg-prussian-600 rounded-full overflow-hidden">
        <motion.div
          className="h-full w-1/2 bg-moonstone-400 rounded-full"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  )
}
