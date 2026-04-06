import React, { createContext, useContext, useRef, useState } from 'react'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([])
  const [isOpen, setIsOpen]     = useState(false)
  const pageContextRef          = useRef(null)

  const addMessage = (role, content, extra = {}) => {
    setMessages(prev => [...prev, { role, content, ...extra }])
  }

  const updateLastAssistant = (chunk) => {
    setMessages(prev => {
      const updated = [...prev]
      const last    = updated[updated.length - 1]
      if (last && last.role === 'assistant') {
        updated[updated.length - 1] = { ...last, content: last.content + chunk }
      }
      return updated
    })
  }

  const finalizeLastAssistant = () => {
    setMessages(prev => {
      const updated = [...prev]
      const last    = updated[updated.length - 1]
      if (last && last.role === 'assistant') {
        updated[updated.length - 1] = { ...last, streaming: false }
      }
      return updated
    })
  }

  const removeLastMessage = () => {
    setMessages(prev => prev.slice(0, -1))
  }

  const clearMessages = () => setMessages([])

  const setPageContext  = (ctx) => { pageContextRef.current = ctx }
  const clearPageContext = ()   => { pageContextRef.current = null }
  const getPageContext  = ()    => pageContextRef.current

  return (
    <ChatContext.Provider value={{
      messages, isOpen, setIsOpen,
      addMessage, updateLastAssistant, finalizeLastAssistant,
      removeLastMessage, clearMessages,
      setPageContext, clearPageContext, getPageContext,
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
