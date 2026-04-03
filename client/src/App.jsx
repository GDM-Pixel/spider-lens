import React, { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layout/Layout'
import AuthLayout from './layout/AuthLayout'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const HttpCodes = lazy(() => import('./pages/HttpCodes'))
const TopPages = lazy(() => import('./pages/TopPages'))
const Bots = lazy(() => import('./pages/Bots'))
const TTFBPage = lazy(() => import('./pages/TTFB'))
const Network = lazy(() => import('./pages/Network'))
const Anomalies = lazy(() => import('./pages/Anomalies'))
const Blocklist = lazy(() => import('./pages/Blocklist'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/http-codes" element={<HttpCodes />} />
        <Route path="/top-pages" element={<TopPages />} />
        <Route path="/bots" element={<Bots />} />
        <Route path="/ttfb" element={<TTFBPage />} />
        <Route path="/network" element={<Network />} />
        <Route path="/anomalies" element={<Anomalies />} />
        <Route path="/blocklist" element={<Blocklist />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
