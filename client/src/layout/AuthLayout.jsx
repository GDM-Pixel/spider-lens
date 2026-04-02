import React from 'react'
import { Outlet, Navigate } from 'react-router-dom'

export default function AuthLayout() {
  const token = localStorage.getItem('spider_token')
  if (token) return <Navigate to="/dashboard" replace />
  return (
    <div className="min-h-screen bg-prussian-700 flex items-center justify-center px-4">
      <Outlet />
    </div>
  )
}
