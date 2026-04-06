import React, { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import api from '../../api/client'
import { useChat } from '../../context/ChatContext'

// Rendu markdown minimal — échappe le HTML puis applique les styles
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInline(line) {
  const escaped = escapeHtml(line)
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(0,198,224,0.1);padding:0 4px;border-radius:3px;color:#00c6e0">$1</code>')
}

function MiniMarkdown({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <span key={i} className="h-1" />
        const html = renderInline(line)
        return (
          <p
            key={i}
            className="leading-relaxed"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </div>
  )
}

function MsgBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={clsx('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-moonstone-400/20 border border-moonstone-700 flex items-center justify-center shrink-0 mt-0.5">
          <Icon icon="ph:robot" className="text-moonstone-400 text-sm" />
        </div>
      )}
      <div className={clsx(
        'max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed',
        isUser
          ? 'bg-moonstone-400 text-prussian-800 rounded-tr-sm font-medium'
          : 'bg-prussian-500 border border-prussian-400 text-lightgrey rounded-tl-sm'
      )}>
        {msg.streaming ? (
          <div className="flex items-start gap-1">
            <div className="flex-1">
              <MiniMarkdown text={msg.content || '…'} />
            </div>
            <span className="inline-block w-1.5 h-3 bg-moonstone-400/70 rounded-sm animate-pulse ml-0.5 shrink-0 mt-0.5" />
          </div>
        ) : (
          <MiniMarkdown text={msg.content} />
        )}
      </div>
    </div>
  )
}

export default function NovaChatBubble() {
  const { t } = useTranslation()
  const {
    messages, isOpen, setIsOpen,
    addMessage, updateLastAssistant, finalizeLastAssistant,
    removeLastMessage, clearMessages, getPageContext,
  } = useChat()

  const [input, setInput]         = useState('')
  const [sending, setSending]     = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const messagesEndRef            = useRef(null)

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Badge unread quand panel fermé
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const last = messages[messages.length - 1]
      if (last?.role === 'assistant' && !last.streaming) {
        setHasUnread(true)
      }
    }
  }, [messages, isOpen])

  const openPanel = () => {
    setIsOpen(true)
    setHasUnread(false)
    if (messages.length === 0) {
      addMessage('assistant', t('assistant.welcome'))
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setSending(true)

    const pageContext = getPageContext()
    addMessage('user', text)
    addMessage('assistant', '', { streaming: true })

    try {
      const history = messages.concat({ role: 'user', content: text }).slice(-10)
      const r = await api.post('/assistant/chat', {
        messages:    history.map(m => ({ role: m.role, content: m.content })),
        pageContext,
      })

      const reply = r.data?.reply || t('assistant.errorGeneric')
      updateLastAssistant(reply)
      finalizeLastAssistant()
    } catch (err) {
      removeLastMessage()
      const msg = err.response?.data?.message || t('assistant.errorGeneric')
      addMessage('assistant', msg)
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Panel chat */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 w-80 h-[480px] bg-prussian-600 border border-prussian-400 rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-prussian-500 bg-prussian-700">
            <div className="w-7 h-7 rounded-full bg-moonstone-400/20 border border-moonstone-700 flex items-center justify-center shrink-0">
              <Icon icon="ph:robot" className="text-moonstone-400 text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-xs leading-tight">Nova</p>
              <p className="text-errorgrey text-xs">Spider-Lens AI</p>
            </div>
            <button
              onClick={clearMessages}
              className="text-errorgrey hover:text-white transition-colors p-1"
              title={t('assistant.clearChat')}
            >
              <Icon icon="ph:trash" className="text-sm" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-errorgrey hover:text-white transition-colors p-1"
            >
              <Icon icon="ph:x" className="text-sm" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {messages.length === 0 && (
              <p className="text-errorgrey text-xs text-center py-4">{t('assistant.welcome')}</p>
            )}
            {messages.map((msg, i) => (
              <MsgBubble key={i} msg={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-prussian-500 p-2.5 flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t('assistant.chatPlaceholder')}
              rows={1}
              disabled={sending}
              className="flex-1 bg-prussian-700 border border-prussian-500 rounded-lg px-2.5 py-2 text-white text-xs resize-none focus:outline-none focus:border-moonstone-400 placeholder-errorgrey/60 disabled:opacity-50"
              style={{ maxHeight: '80px', overflowY: 'auto' }}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="px-2.5 py-2 bg-moonstone-400 text-prussian-800 font-bold rounded-lg hover:bg-moonstone-300 transition-colors disabled:opacity-50 shrink-0"
            >
              {sending
                ? <Icon icon="ph:spinner" className="text-sm animate-spin" />
                : <Icon icon="ph:paper-plane-tilt" className="text-sm" />
              }
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-errorgrey/40 text-xs py-1.5 border-t border-prussian-500/50">
            {t('assistant.poweredBy')} Google Gemini
          </p>
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : openPanel}
        className="fixed bottom-5 right-5 w-12 h-12 bg-moonstone-400 text-prussian-800 rounded-full shadow-lg hover:bg-moonstone-300 transition-all duration-200 flex items-center justify-center z-[9999]"
        title="Nova AI"
      >
        <Icon icon={isOpen ? 'ph:x' : 'ph:robot'} className="text-xl" />
        {hasUnread && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-dustyred-400 rounded-full text-white text-xs flex items-center justify-center font-bold">
            !
          </span>
        )}
      </button>
    </>
  )
}
