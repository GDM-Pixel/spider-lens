import React, { createContext, useContext, useState, useRef, useCallback } from 'react'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([])
  const [isOpen, setIsOpen]     = useState(false)
  const pageContextRef          = useRef(null)

  const setPageContext   = useCallback((ctx) => { pageContextRef.current = ctx }, [])
  const clearPageContext = useCallback(() => { pageContextRef.current = null }, [])
  const getPageContext   = useCallback(() => pageContextRef.current, [])

  const addMessage = useCallback((role, content, extra = {}) => {
    setMessages(prev => [...prev, { role, content, ...extra }])
  }, [])

  const updateLastAssistant = useCallback((chunk) => {
    setMessages(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last?.role === 'assistant') {
        next[next.length - 1] = { ...last, content: last.content + chunk }
      }
      return next
    })
  }, [])

  const finalizeLastAssistant = useCallback(() => {
    setMessages(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last?.role === 'assistant') {
        next[next.length - 1] = { ...last, streaming: false }
      }
      return next
    })
  }, [])

  const removeLastMessage = useCallback(() => {
    setMessages(prev => prev.slice(0, -1))
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  return (
    <ChatContext.Provider value={{
      messages,
      isOpen,
      setIsOpen,
      addMessage,
      updateLastAssistant,
      finalizeLastAssistant,
      removeLastMessage,
      clearMessages,
      setPageContext,
      clearPageContext,
      getPageContext,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
