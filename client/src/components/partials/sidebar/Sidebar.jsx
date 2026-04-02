import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { label: 'Dashboard', icon: 'ph:chart-pie-slice', path: '/dashboard' },
  { label: 'Codes HTTP', icon: 'ph:chart-line', path: '/http-codes' },
  { label: 'Top Pages', icon: 'ph:list-magnifying-glass', path: '/top-pages' },
  { label: 'Bots & Crawlers', icon: 'ph:robot', path: '/bots' },
  { label: 'Temps de chargement', icon: 'ph:gauge', path: '/ttfb' },
  { label: 'Réseau', icon: 'ph:network', path: '/network' },
  { label: 'Anomalies', icon: 'ph:warning-diamond', path: '/anomalies' },
  { label: 'Blocklist', icon: 'ph:prohibit', path: '/blocklist' },
  { label: 'Paramètres', icon: 'ph:gear-six', path: '/settings' },
]

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()

  function handleLogout() {
    localStorage.removeItem('spider_token')
    localStorage.removeItem('spider_username')
    navigate('/login')
  }

  return (
    <aside
      className={clsx(
        'fixed top-0 left-0 h-full bg-prussian-600 flex flex-col z-40 transition-all duration-200 border-r border-prussian-500',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-prussian-500 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Placeholder logo */}
          <div className="w-9 h-9 rounded-lg bg-prussian-500 flex items-center justify-center shrink-0 border border-moonstone-700">
            <Icon icon="ph:spider" className="text-moonstone-400 text-xl" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">Spider-Lens</p>
              <p className="text-errorgrey text-xs leading-tight">v0.7.0</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className={clsx(
            'ml-auto text-errorgrey hover:text-white transition-colors shrink-0',
            collapsed && 'hidden'
          )}
        >
          <Icon icon="ph:sidebar-simple" className="text-lg" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 flex flex-col gap-1">
        {!collapsed && (
          <p className="text-errorgrey text-xs font-semibold uppercase tracking-wider px-2 mb-2">
            Analyse
          </p>
        )}
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 group',
                isActive
                  ? 'bg-prussian-500 text-white border-l-2 border-dustyred-400 pl-[6px]'
                  : 'text-lightgrey hover:bg-prussian-500 hover:text-white border-l-2 border-transparent'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  icon={item.icon}
                  className={clsx('text-xl shrink-0', isActive ? 'text-moonstone-400' : 'text-errorgrey group-hover:text-moonstone-400')}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-prussian-500 p-2">
        <button
          onClick={handleLogout}
          className={clsx(
            'flex items-center gap-3 w-full px-2 py-2.5 rounded-lg text-sm text-errorgrey hover:bg-prussian-500 hover:text-dustyred-400 transition-colors',
            collapsed && 'justify-center'
          )}
        >
          <Icon icon="ph:sign-out" className="text-xl shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  )
}
