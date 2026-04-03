import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'

export default function NotFound() {
  const location = useLocation()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-prussian-700 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center text-center max-w-md"
      >
        {/* Icône */}
        <div className="w-20 h-20 rounded-2xl bg-prussian-600 border border-prussian-500 flex items-center justify-center mb-6">
          <Icon icon="ph:spider" className="text-moonstone-400 text-4xl" />
        </div>

        {/* Code */}
        <p className="text-moonstone-400 font-mono text-sm font-semibold uppercase tracking-widest mb-2">
          {t('notFound.code')}
        </p>

        <h1 className="text-white font-bold text-3xl mb-3">
          {t('notFound.title')}
        </h1>

        <p className="text-errorgrey text-sm leading-relaxed mb-2">
          {t('notFound.message', { path: <code className="bg-prussian-600 text-moonstone-300 px-1.5 py-0.5 rounded font-mono text-xs">{location.pathname}</code> })}
        </p>

        <p className="text-errorgrey text-sm mb-8">
          {t('notFound.humor')}
        </p>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-moonstone-400/15 border border-moonstone-600 text-moonstone-300 text-sm font-semibold hover:bg-moonstone-400/25 transition-colors"
        >
          <Icon icon="ph:house" className="text-base" />
          {t('notFound.back')}
        </Link>
      </motion.div>
    </div>
  )
}
