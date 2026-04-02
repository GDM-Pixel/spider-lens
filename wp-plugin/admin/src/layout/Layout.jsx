import React, { useState } from 'react'
import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { Icon } from '@iconify/react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { label: 'Dashboard',       icon: 'ph:chart-pie-slice',       path: '/dashboard' },
  { label: 'Codes HTTP',      icon: 'ph:chart-line',            path: '/http-codes' },
  { label: 'Top Pages',       icon: 'ph:list-magnifying-glass', path: '/top-pages' },
  { label: 'Bots & Crawlers', icon: 'ph:robot',                 path: '/bots' },
  { label: 'Performances',    icon: 'ph:gauge',                 path: '/ttfb' },
  { label: 'Réseau',          icon: 'ph:network',               path: '/network' },
  { label: 'Anomalies',       icon: 'ph:warning-diamond',       path: '/anomalies' },
  { label: 'Blocklist',       icon: 'ph:prohibit',              path: '/blocklist' },
  { label: 'Paramètres',      icon: 'ph:gear-six',              path: '/settings' },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

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
              <p className="text-errorgrey text-xs">v0.7.0</p>
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
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Site info */}
        {!collapsed && window.spiderLens?.siteName && (
          <div className="border-t border-prussian-500 p-3">
            <p className="text-errorgrey text-xs truncate" title={window.spiderLens.siteUrl}>
              {window.spiderLens.siteName}
            </p>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
