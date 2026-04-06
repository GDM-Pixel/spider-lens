import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layout/Layout'

const Dashboard  = lazy(() => import('./pages/Dashboard'))
const HttpCodes  = lazy(() => import('./pages/HttpCodes'))
const TopPages   = lazy(() => import('./pages/TopPages'))
const Bots       = lazy(() => import('./pages/Bots'))
const TTFB       = lazy(() => import('./pages/TTFB'))
const Network    = lazy(() => import('./pages/Network'))
const Anomalies  = lazy(() => import('./pages/Anomalies'))
const Blocklist  = lazy(() => import('./pages/Blocklist'))
const Settings   = lazy(() => import('./pages/Settings'))
const Crawler    = lazy(() => import('./pages/Crawler'))

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-moonstone-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"           element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/http-codes" element={<HttpCodes />} />
          <Route path="/top-pages"  element={<TopPages />} />
          <Route path="/bots"       element={<Bots />} />
          <Route path="/ttfb"       element={<TTFB />} />
          <Route path="/network"    element={<Network />} />
          <Route path="/anomalies"  element={<Anomalies />} />
          <Route path="/blocklist"  element={<Blocklist />} />
          <Route path="/crawler"    element={<Crawler />} />
          <Route path="/settings"   element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
