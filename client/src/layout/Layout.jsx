import React, { useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import Sidebar from '../components/partials/sidebar/Sidebar'
import Header from '../components/partials/header/Header'
import { motion, AnimatePresence } from 'framer-motion'

export default function Layout() {
  const token = localStorage.getItem('spider_token')
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

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
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
