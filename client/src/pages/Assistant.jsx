import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import clsx from 'clsx'
import BeginnerBanner from '../components/ui/BeginnerBanner'
import { useSite } from '../context/SiteContext'

// ── SSE streaming helper ──────────────────────────────────
async function streamSSE(url, body, onChunk, onDone, onError) {
  const token = localStorage.getItem('spider_token')
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    onError(err.message)
    return
  }

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

// ── Message bubble ────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={clsx('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-moonstone-400/20 border border-moonstone-400/30 flex items-center justify-center shrink-0 mt-1">
          <Icon icon="ph:sparkle" className="text-moonstone-400 text-sm" />
        </div>
      )}
      <div
        className={clsx(
          'max-w-[85%] rounded-xl px-4 py-3 text-sm border',
          isUser
            ? 'bg-moonstone-400/10 border-moonstone-400/20 text-white'
            : 'bg-prussian-500 border-prussian-400 text-lightgrey',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.streaming && (
          <span className="inline-block w-1.5 h-4 bg-moonstone-400 rounded-sm animate-pulse ml-1 align-middle" />
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-prussian-500 border border-prussian-400 flex items-center justify-center shrink-0 mt-1">
          <Icon icon="ph:user" className="text-errorgrey text-sm" />
        </div>
      )}
    </motion.div>
  )
}

// ── Analysis panel ────────────────────────────────────────
function AnalysisPanel({ content, isStreaming, onStart, hasApiKey }) {
  const { t } = useTranslation()

  if (!content && !isStreaming) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 rounded-2xl bg-moonstone-400/10 border border-moonstone-400/20 flex items-center justify-center">
          <Icon icon="ph:sparkle" className="text-moonstone-400 text-3xl" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold mb-1">{t('assistant.analyzeBtn')}</p>
          <p className="text-errorgrey text-sm">{t('assistant.tip3')}</p>
        </div>
        <button
          onClick={onStart}
          disabled={!hasApiKey}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all',
            hasApiKey
              ? 'bg-moonstone-400 text-prussian-700 hover:bg-moonstone-300'
              : 'bg-prussian-500 text-errorgrey cursor-not-allowed',
          )}
        >
          <Icon icon="ph:sparkle" className="text-base" />
          {t('assistant.analyzeBtn')}
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      {isStreaming && (
        <div className="flex items-center gap-2 mb-3 text-moonstone-400 text-sm">
          <Icon icon="ph:circle-notch" className="animate-spin" />
          {t('assistant.analyzing')}
        </div>
      )}
      <div className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-moonstone-400 rounded-sm animate-pulse ml-1 align-middle" />
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function Assistant() {
  const { t } = useTranslation()
  const { activeSiteId } = useSite()

  // Analysis state
  const [analysisContent, setAnalysisContent] = useState('')
  const [analysisStreaming, setAnalysisStreaming] = useState(false)

  // Chat state
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [chatStreaming, setChatStreaming] = useState(false)
  const [apiKeyMissing, setApiKeyMissing] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Auto-analysis ──────────────────────────────────────
  const runAnalysis = useCallback(() => {
    if (analysisStreaming) return
    setAnalysisContent('')
    setAnalysisStreaming(true)
    setApiKeyMissing(false)

    streamSSE(
      '/api/assistant/analyze',
      { siteId: activeSiteId || null },
      (chunk) => setAnalysisContent((prev) => prev + chunk),
      () => setAnalysisStreaming(false),
      (err) => {
        setAnalysisStreaming(false)
        if (err.includes('GEMINI_API_KEY') || err.includes('503')) {
          setApiKeyMissing(true)
        } else {
          setAnalysisContent(`**Erreur :** ${err}`)
        }
      },
    )
  }, [activeSiteId, analysisStreaming])

  // ── Chat send ──────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || chatStreaming) return
    setInput('')
    setApiKeyMissing(false)

    const userMsg = { role: 'user', content: text }
    const assistantMsg = { role: 'assistant', content: '', streaming: true }

    setMessages((prev) => {
      const next = [...prev, userMsg, assistantMsg]
      return next
    })
    setChatStreaming(true)

    // Build history to send (max 10 messages)
    const history = [...messages, userMsg].slice(-10)

    streamSSE(
      '/api/assistant/chat',
      { siteId: activeSiteId || null, messages: history },
      (chunk) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + chunk }
          }
          return next
        })
      },
      () => {
        setChatStreaming(false)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, streaming: false }
          }
          return next
        })
      },
      (err) => {
        setChatStreaming(false)
        if (err.includes('GEMINI_API_KEY') || err.includes('503')) {
          setApiKeyMissing(true)
          setMessages((prev) => prev.slice(0, -1)) // remove empty assistant bubble
        } else {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last?.role === 'assistant') {
              next[next.length - 1] = { ...last, content: `**Erreur :** ${err}`, streaming: false }
            }
            return next
          })
        }
      },
    )
  }, [input, chatStreaming, messages, activeSiteId])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function clearChat() {
    setMessages([])
    setApiKeyMissing(false)
    inputRef.current?.focus()
  }

  const hasApiKey = !apiKeyMissing

  return (
    <div className="flex flex-col gap-6">
      {/* Beginner banner */}
      <BeginnerBanner
        icon="ph:sparkle"
        title={t('assistant.welcomeTitle')}
        tips={[t('assistant.tip1'), t('assistant.tip2'), t('assistant.tip3')]}
      />

      {/* API key warning */}
      <AnimatePresence>
        {apiKeyMissing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3"
          >
            <Icon icon="ph:warning" className="text-amber-400 text-lg shrink-0 mt-0.5" />
            <p className="text-amber-300 text-sm">{t('assistant.noApiKey')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.4fr] gap-6 items-start">
        {/* ── Auto-analysis panel ── */}
        <div className="bg-prussian-600 rounded-xl border border-prussian-500 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="ph:sparkle" className="text-moonstone-400 text-lg" />
              <h2 className="text-white font-semibold text-sm">Analyse SEO automatique</h2>
            </div>
            {analysisContent && !analysisStreaming && (
              <button
                onClick={runAnalysis}
                className="flex items-center gap-1.5 text-xs text-errorgrey hover:text-moonstone-400 transition-colors"
              >
                <Icon icon="ph:arrow-clockwise" className="text-sm" />
                Relancer
              </button>
            )}
          </div>

          <AnalysisPanel
            content={analysisContent}
            isStreaming={analysisStreaming}
            onStart={runAnalysis}
            hasApiKey={hasApiKey}
          />
        </div>

        {/* ── Chat panel ── */}
        <div className="bg-prussian-600 rounded-xl border border-prussian-500 flex flex-col" style={{ minHeight: '520px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-prussian-500">
            <div className="flex items-center gap-2">
              <Icon icon="ph:chat-circle-dots" className="text-moonstone-400 text-lg" />
              <h2 className="text-white font-semibold text-sm">Chat IA</h2>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="flex items-center gap-1.5 text-xs text-errorgrey hover:text-dustyred-400 transition-colors"
              >
                <Icon icon="ph:trash" className="text-sm" />
                {t('assistant.clearChat')}
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-3 text-center py-8"
              >
                <Icon icon="ph:chat-circle-dots" className="text-4xl text-errorgrey" />
                <p className="text-errorgrey text-sm max-w-xs">{t('assistant.welcome')}</p>
              </motion.div>
            )}
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-prussian-500">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatStreaming || apiKeyMissing}
                placeholder={t('assistant.chatPlaceholder')}
                className="flex-1 bg-prussian-700 border border-prussian-400 rounded-xl px-4 py-2.5 text-sm text-white placeholder-errorgrey resize-none focus:outline-none focus:border-moonstone-400 transition-colors disabled:opacity-50"
                style={{ maxHeight: '120px', overflowY: 'auto' }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || chatStreaming || apiKeyMissing}
                className="w-10 h-10 rounded-xl bg-moonstone-400 text-prussian-700 flex items-center justify-center hover:bg-moonstone-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 self-end"
              >
                {chatStreaming ? (
                  <Icon icon="ph:circle-notch" className="text-lg animate-spin" />
                ) : (
                  <Icon icon="ph:paper-plane-tilt" className="text-lg" />
                )}
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-errorgrey pb-3">
            {t('assistant.poweredBy')}{' '}
            <a
              href="https://nova-mind.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="text-moonstone-400 hover:text-moonstone-300 transition-colors"
            >
              Nova-Mind.cloud
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
