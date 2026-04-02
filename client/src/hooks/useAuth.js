import { useState, useEffect } from 'react'

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem('spider_token'))
  const [username, setUsername] = useState(() => localStorage.getItem('spider_username'))

  const login = (newToken, user) => {
    localStorage.setItem('spider_token', newToken)
    localStorage.setItem('spider_username', user)
    setToken(newToken)
    setUsername(user)
  }

  const logout = () => {
    localStorage.removeItem('spider_token')
    localStorage.removeItem('spider_username')
    setToken(null)
    setUsername(null)
  }

  return { token, username, isAuth: !!token, login, logout }
}
