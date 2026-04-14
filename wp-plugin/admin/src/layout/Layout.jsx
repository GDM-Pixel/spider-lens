import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Icon } from '@iconify/react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useBeginnerMode } from '../hooks/useBeginnerMode'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'
import NovaChatBubble from '../components/chat/NovaChatBubble'
import { RefreshProvider, useRefresh } from '../context/RefreshContext'

const NAV_ITEMS = [
  { labelKey: 'nav.dashboard',      icon: 'ph:chart-pie-slice',       path: '/dashboard' },
  { labelKey: 'nav.httpCodes',      icon: 'ph:chart-line',            path: '/http-codes' },
  { labelKey: 'nav.topPages',       icon: 'ph:list-magnifying-glass', path: '/top-pages' },
  { labelKey: 'nav.bots',           icon: 'ph:robot',                 path: '/bots' },
  { labelKey: 'nav.ttfb',           icon: 'ph:gauge',                 path: '/ttfb' },
  { labelKey: 'nav.network',        icon: 'ph:network',               path: '/network' },
  { labelKey: 'nav.anomalies',      icon: 'ph:warning-diamond',       path: '/anomalies' },
  { labelKey: 'nav.blocklist',      icon: 'ph:prohibit',              path: '/blocklist' },
  { labelKey: 'nav.crawler',        icon: 'ph:magnifying-glass-plus', path: '/crawler' },
  { labelKey: 'nav.analyzeAI',      icon: 'ph:sparkle',               path: '/assistant' },
  { labelKey: 'nav.settings',       icon: 'ph:gear-six',              path: '/settings' },
]

function LayoutInner() {
  const [collapsed, setCollapsed] = useState(false)
  const { t } = useTranslation()
  const { beginner, toggle: toggleBeginner } = useBeginnerMode()
  const { triggerRefresh } = useRefresh()

  return (
    <div className="flex h-screen overflow-hidden bg-prussian-700 font-sans">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col h-full bg-prussian-600 border-r border-prussian-500 transition-all duration-200 shrink-0',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}>
        {/* Logo */}
        <div className="flex items-center h-14 px-3 border-b border-prussian-500 gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-prussian-500 flex items-center justify-center shrink-0 border border-moonstone-700">
            <Icon icon="ph:spider" className="text-moonstone-400 text-lg" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm leading-tight truncate">Spider-Lens</p>
              <p className="text-errorgrey text-xs">{window.spiderLens?.version || 'dev'}</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className={clsx('text-errorgrey hover:text-white transition-colors shrink-0', collapsed && 'hidden')}
          >
            <Icon icon="ph:sidebar-simple" className="text-base" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-1.5 flex flex-col gap-0.5">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => clsx(
                'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold transition-all group',
                isActive
                  ? 'bg-prussian-500 text-white border-l-2 border-dustyred-400 pl-[6px]'
                  : 'text-lightgrey hover:bg-prussian-500 hover:text-white border-l-2 border-transparent'
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    icon={item.icon}
                    className={clsx('text-lg shrink-0', isActive ? 'text-moonstone-400' : 'text-errorgrey group-hover:text-moonstone-400')}
                  />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Toggle débutant / LanguageSwitcher / Site info */}
        <div className="border-t border-prussian-500 p-3 flex flex-col gap-2">
          {!collapsed && (
            <button
              onClick={toggleBeginner}
              className={clsx(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors w-full',
                beginner
                  ? 'bg-moonstone-400/15 text-moonstone-400 border border-moonstone-700'
                  : 'text-errorgrey hover:text-white hover:bg-prussian-500'
              )}
              title={t('header.beginnerActive')}
            >
              <Icon icon={beginner ? 'ph:student-fill' : 'ph:student'} className="text-base shrink-0" />
              <span>{beginner ? t('header.beginner') : t('header.expert')}</span>
            </button>
          )}
          {!collapsed && <LanguageSwitcher />}
          {!collapsed && window.spiderLens?.siteName && (
            <p className="text-errorgrey text-xs truncate" title={window.spiderLens.siteUrl}>
              {window.spiderLens.siteName}
            </p>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar avec bouton Actualiser */}
        <header className="flex items-center justify-end h-10 px-4 border-b border-prussian-500 bg-prussian-600 shrink-0 gap-2">
          <button
            onClick={triggerRefresh}
            title={t('common.refresh')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-errorgrey hover:text-white hover:bg-prussian-500 transition-colors"
          >
            <Icon icon="ph:arrow-clockwise" className="text-sm" />
            {t('common.refresh')}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>

      {/* Nova chat bubble — global */}
      <NovaChatBubble />
    </div>
  )
}

export default function Layout() {
  return (
    <RefreshProvider>
      <LayoutInner />
    </RefreshProvider>
  )
}
