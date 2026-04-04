import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import novaBubbleIcon from '../../assets/nova-bubble-icon.png'

// Particule flottante
function Particle({ delay, x, y, size, duration }) {
  return (
    <motion.span
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: 'radial-gradient(circle, rgba(0,198,224,0.8) 0%, rgba(0,198,224,0) 70%)',
      }}
      initial={{ opacity: 0, scale: 0, y: 0 }}
      animate={{ opacity: [0, 0.8, 0], scale: [0, 1, 0.5], y: -40 }}
      transition={{ delay, duration, repeat: Infinity, repeatDelay: Math.random() * 3 + 1, ease: 'easeOut' }}
    />
  )
}

const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  delay: (i * 0.4) % 3,
  x: 20 + (i * 23) % 60,
  y: 30 + (i * 17) % 40,
  size: 4 + (i % 3) * 3,
  duration: 1.5 + (i % 4) * 0.4,
}))

export default function NovaAnalysisLoader({ t }) {
  const steps = [
    t('assistant.loaderStep1'),
    t('assistant.loaderStep2'),
    t('assistant.loaderStep3'),
    t('assistant.loaderStep4'),
    t('assistant.loaderStep5'),
  ]
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex(i => (i + 1) % steps.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-20 gap-10"
    >
      {/* Nova orb */}
      <div className="relative flex items-center justify-center">
        {/* Halo externe pulsé */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 140, height: 140, background: 'radial-gradient(circle, rgba(0,198,224,0.12) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Anneau rotatif */}
        <motion.div
          className="absolute rounded-full border-2 border-moonstone-400/30"
          style={{ width: 110, height: 110, borderTopColor: 'rgba(0,198,224,0.9)', borderRightColor: 'rgba(0,198,224,0.4)' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        />
        {/* Anneau rotatif inverse plus petit */}
        <motion.div
          className="absolute rounded-full border border-moonstone-400/20"
          style={{ width: 80, height: 80, borderBottomColor: 'rgba(0,198,224,0.6)', borderLeftColor: 'rgba(0,198,224,0.2)' }}
          animate={{ rotate: -360 }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
        />
        {/* Logo Nova */}
        <motion.img
          src={novaBubbleIcon}
          alt="Nova"
          className="w-14 h-14 rounded-full object-cover relative z-10"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 24px rgba(0,198,224,0.4)' }}
        />
        {/* Particules */}
        {PARTICLES.map(p => <Particle key={p.id} {...p} />)}
      </div>

      {/* Texte animé */}
      <div className="flex flex-col items-center gap-3">
        <AnimatePresence mode="wait">
          <motion.p
            key={stepIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="text-moonstone-400 text-sm font-semibold"
          >
            {steps[stepIndex]}
          </motion.p>
        </AnimatePresence>
        <p className="text-errorgrey text-xs">{t('assistant.analyzing')}</p>

        {/* Barre de progression indéfinie */}
        <div className="w-48 h-1 bg-prussian-500 rounded-full overflow-hidden mt-1">
          <motion.div
            className="h-full bg-gradient-to-r from-moonstone-400/60 via-moonstone-400 to-moonstone-400/60 rounded-full"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </motion.div>
  )
}
