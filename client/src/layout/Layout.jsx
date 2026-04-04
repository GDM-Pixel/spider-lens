import React, { useState, useEffect, Suspense } from 'react'
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../components/partials/sidebar/Sidebar'
import Header from '../components/partials/header/Header'
import NovaChatBubble from '../components/chat/NovaChatBubble'

export default function Layout() {
  const token = localStorage.getItem('spider_token')
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    function handleUnauthorized() {
      navigate('/login', { replace: true })
    }
    window.addEventListener('spider:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('spider:unauthorized', handleUnauthorized)
  }, [navigate])

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-prussian-700">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-200 ${
          collapsed ? 'ml-[72px]' : 'ml-[260px]'
        }`}
      >
        <Header collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

        <main className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <NovaChatBubble />
    </div>
  )
}
