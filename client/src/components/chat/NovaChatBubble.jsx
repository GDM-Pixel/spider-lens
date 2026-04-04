import React, { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@iconify/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useChat } from '../../context/ChatContext'
import { useSite } from '../../context/SiteContext'
import novaAvatar from '../../assets/nova-avatar.jpg'
import novaBubbleIcon from '../../assets/nova-bubble-icon.png'

// ── SSE streaming ─────────────────────────────────────────
async function streamSSE(url, body, onChunk, onDone, onError) {
  const token = localStorage.getItem('spider_token')
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch (err) { onError(err.message); return }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    onError(data.error || `HTTP ${response.status}`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (raw === '[DONE]') { onDone(); return }
      try {
        const parsed = JSON.parse(raw)
        if (parsed.error) { onError(parsed.error); return }
        if (parsed.text) onChunk(parsed.text)
      } catch {}
    }
  }
  onDone()
}

// ── Message bubble ─────────────────────────────────────────
function MsgBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={clsx('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <img src={novaAvatar} alt="Nova"
          className="nova-avatar w-7 h-7 rounded-full object-cover border border-moonstone-400/30 shrink-0 mt-1" />
      )}
      <div className={clsx(
        'max-w-[85%] rounded-xl px-3 py-2 text-xs border',
        isUser
          ? 'bg-moonstone-400/10 border-moonstone-400/20 text-white'
          : 'bg-prussian-500 border-prussian-400 text-lightgrey',
      )}>
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-xs max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.streaming && (
          <span className="inline-block w-1 h-3 bg-moonstone-400 rounded-sm animate-pulse ml-1 align-middle" />
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-prussian-500 border border-prussian-400 flex items-center justify-center shrink-0 mt-1">
          <Icon icon="ph:user" className="text-errorgrey text-xs" />
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export default function NovaChatBubble() {
  const { t } = useTranslation()
  const { activeSiteId } = useSite()
  const {
    messages, isOpen, setIsOpen,
    addMessage, updateLastAssistant, finalizeLastAssistant,
    removeLastMessage, clearMessages, getPageContext,
  } = useChat()

  const [input, setInput]         = useState('')
  const [streaming, setStreaming] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [apiError, setApiError]   = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Unread tracking
  useEffect(() => {
    if (!isOpen && messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      setHasUnread(true)
    }
  }, [messages, isOpen])

  function openPanel() {
    setIsOpen(true)
    setHasUnread(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function sendMessage() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setApiError(null)

    // Capturer le contexte de page AU MOMENT de l'envoi
    const pageContext = getPageContext()

    addMessage('user', text)
    addMessage('assistant', '', { streaming: true })
    setStreaming(true)

    // Historique : tous les messages précédents + le nouveau user message
    const history = [...messages, { role: 'user', content: text }].slice(-10)

    streamSSE(
      '/api/assistant/chat',
      {
        siteId: activeSiteId || null,
        messages: history,
        ...(pageContext ? { pageContext } : {}),
      },
      (chunk) => updateLastAssistant(chunk),
      () => { finalizeLastAssistant(); setStreaming(false) },
      (err) => {
        setStreaming(false)
        removeLastMessage()
        setApiError(err.includes('GEMINI_API_KEY') ? t('assistant.noApiKey') : err)
      },
    )
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
      {/* ── Panel chat ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="nova-panel"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-24 right-6 z-50 w-[360px] flex flex-col rounded-2xl bg-prussian-700 border border-prussian-500 shadow-2xl overflow-hidden"
            style={{ height: '500px' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-prussian-500 shrink-0">
              <img src={novaAvatar} alt="Nova"
                className="nova-avatar w-9 h-9 rounded-full object-cover border border-moonstone-400/30 shrink-0" />
              <div className="flex-1">
                <p className="text-white text-sm font-semibold leading-tight">Nova</p>
                <p className="text-errorgrey text-xs leading-tight">Assistante SEO IA</p>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={() => { clearMessages(); setApiError(null) }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-errorgrey hover:text-dustyred-400 hover:bg-prussian-500 transition-colors"
                    title={t('assistant.clearChat')}
                  >
                    <Icon icon="ph:trash" className="text-sm" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-errorgrey hover:text-white hover:bg-prussian-500 transition-colors"
                >
                  <Icon icon="ph:x" className="text-sm" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <img src={novaAvatar} alt="Nova"
                    className="nova-avatar w-12 h-12 rounded-full object-cover border border-moonstone-400/30" />
                  <p className="text-errorgrey text-xs max-w-[220px] leading-relaxed">
                    {t('assistant.welcome')}
                  </p>
                </div>
              )}
              {messages.map((msg, i) => <MsgBubble key={i} message={msg} />)}
              {apiError && (
                <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                  <Icon icon="ph:warning" className="text-amber-400 text-sm shrink-0 mt-0.5" />
                  <p className="text-amber-300 text-xs">{apiError}</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-prussian-500 shrink-0">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={streaming}
                  placeholder={t('assistant.chatPlaceholder')}
                  className="flex-1 bg-prussian-600 border border-prussian-400 rounded-xl px-3 py-2 text-xs text-white placeholder-errorgrey resize-none focus:outline-none focus:border-moonstone-400 transition-colors disabled:opacity-50"
                  style={{ maxHeight: '80px', overflowY: 'auto' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming}
                  className="w-9 h-9 rounded-xl bg-moonstone-400 text-prussian-700 flex items-center justify-center hover:bg-moonstone-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 self-end"
                >
                  {streaming
                    ? <Icon icon="ph:circle-notch" className="text-base animate-spin" />
                    : <Icon icon="ph:paper-plane-tilt" className="text-base" />}
                </button>
              </div>
            </div>

            {/* Footer */}
            <p className="text-center text-[10px] text-errorgrey pb-2 shrink-0">
              {t('assistant.poweredBy')}{' '}
              <a href="https://nova-mind.cloud" target="_blank" rel="noopener noreferrer"
                className="text-moonstone-400 hover:text-moonstone-300 transition-colors">
                Nova-Mind.cloud
              </a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bubble button ── */}
      <motion.button
        onClick={isOpen ? () => setIsOpen(false) : openPanel}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl overflow-hidden border-2 border-moonstone-400/40 focus:outline-none"
        title="Nova — Assistante SEO"
      >
        <img src={novaBubbleIcon} alt="Nova" className="w-full h-full object-cover" />

        {/* Unread badge */}
        <AnimatePresence>
          {hasUnread && !isOpen && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-dustyred-400 border-2 border-prussian-700"
            />
          )}
        </AnimatePresence>
      </motion.button>
    </>
  )
}
