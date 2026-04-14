import React from 'react'
import { useLocation } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useBeginnerMode } from '../../../hooks/useBeginnerMode'
import { useSite } from '../../../context/SiteContext'
import { useRefresh } from '../../../context/RefreshContext'
import LanguageSwitcher from '../../ui/LanguageSwitcher'

export default function Header({ collapsed, onToggle }) {
  const location  = useLocation()
  const { t }     = useTranslation()
  const pageKey   = location.pathname.replace('/', '') || 'dashboard'
  const pageInfo  = t(`header.pages.${pageKey}`, { returnObjects: true }) || { title: 'Spider-Lens', subtitle: '' }
  const username  = localStorage.getItem('spider_username') || 'Admin'
  const { beginner, toggle } = useBeginnerMode()
  const { sites, activeSiteId, setActiveSiteId } = useSite()
  const { triggerRefresh } = useRefresh()

  return (
    <header className="h-16 bg-prussian-600 border-b border-prussian-500 px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggle}
          className="text-errorgrey hover:text-white transition-colors"
          aria-label={collapsed ? t('header.openMenu') : t('header.closeMenu')}
        >
          <Icon icon="ph:list" className="text-xl" />
        </button>

        <div>
          <h1 className="text-white font-bold text-base leading-tight">{pageInfo.title}</h1>
          {pageInfo.subtitle && (
            <p className="text-errorgrey text-xs leading-tight hidden sm:block">{pageInfo.subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">

        {/* ── Sélecteur de site ─────────────────────────── */}
        {sites.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 bg-prussian-500 border border-prussian-400 rounded-full px-3 py-1.5">
            <Icon icon="ph:globe" className="text-moonstone-400 text-sm shrink-0" />
            <select
              value={activeSiteId ?? ''}
              onChange={e => setActiveSiteId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="bg-prussian-500 text-white text-xs font-semibold focus:outline-none cursor-pointer max-w-[140px]"
            >
              <option value="">{t('header.allSites')}</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Toggle mode débutant ───────────────────────── */}
        <button
          onClick={toggle}
          className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 ${
            beginner
              ? 'bg-moonstone-400/15 border-moonstone-600 text-moonstone-300'
              : 'bg-prussian-500 border-prussian-400 text-errorgrey hover:text-white hover:border-prussian-300'
          }`}
          title={beginner ? t('header.beginnerActive') : t('header.beginnerInactive')}
        >
          <Icon icon={beginner ? 'ph:graduation-cap-fill' : 'ph:graduation-cap'} className="text-base" />
          <span className="hidden sm:block">{beginner ? t('header.beginner') : t('header.expert')}</span>

          {beginner && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-moonstone-400">
              <span className="absolute inset-0 rounded-full bg-moonstone-400 animate-ping opacity-75" />
            </span>
          )}
        </button>

        <AnimatePresence>
          {beginner && (
            <motion.div
              key="beginner-hint"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-16 right-6 z-50 hidden sm:block"
            />
          )}
        </AnimatePresence>

        {/* Badge version */}
        <span className="hidden md:inline-flex items-center gap-1 bg-prussian-500 text-moonstone-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-prussian-400">
          <Icon icon="ph:spider" className="text-sm" />
          v1.4.0
        </span>

        {/* ── Bouton Actualiser ─────────────────────────── */}
        <button
          onClick={triggerRefresh}
          className="flex items-center gap-1.5 bg-prussian-500 border border-prussian-400 hover:border-moonstone-500 hover:text-moonstone-300 text-errorgrey text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200"
          title={t('header.refresh')}
        >
          <Icon icon="ph:arrow-clockwise" className="text-base" />
          <span className="hidden sm:block">{t('header.refresh')}</span>
        </button>

        <LanguageSwitcher />

        {/* Utilisateur */}
        <div className="flex items-center gap-2 bg-prussian-500 px-3 py-1.5 rounded-full border border-prussian-400">
          <Icon icon="ph:user-circle" className="text-moonstone-400 text-lg" />
          <span className="text-white text-sm font-semibold hidden sm:block">{username}</span>
        </div>
      </div>
    </header>
  )
}
