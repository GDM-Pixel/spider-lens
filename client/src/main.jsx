import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import BeginnerModeProvider from './context/BeginnerModeProvider'
import SiteProvider from './context/SiteContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <BeginnerModeProvider>
      <SiteProvider>
        <App />
      </SiteProvider>
    </BeginnerModeProvider>
  </BrowserRouter>
)
