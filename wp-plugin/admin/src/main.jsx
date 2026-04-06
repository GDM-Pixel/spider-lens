import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import BeginnerModeProvider from './context/BeginnerModeProvider'
import './i18n'
import './index.css'

const container = document.getElementById('spider-lens-root')

if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <BeginnerModeProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </BeginnerModeProvider>
    </React.StrictMode>
  )
}
