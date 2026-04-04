import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import BeginnerModeProvider from './context/BeginnerModeProvider'
import SiteProvider from './context/SiteContext'
import { ChatProvider } from './context/ChatContext'
import './i18n'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return React.createElement('pre', { style: { color: 'red', padding: 20 } }, String(this.state.error))
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <ChatProvider>
        <BeginnerModeProvider>
          <SiteProvider>
            <App />
          </SiteProvider>
        </BeginnerModeProvider>
      </ChatProvider>
    </BrowserRouter>
  </ErrorBoundary>
)
