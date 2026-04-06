import React, { useState } from 'react'
import { BeginnerModeContext } from '../hooks/useBeginnerMode'

export default function BeginnerModeProvider({ children }) {
  const [beginner, setBeginner] = useState(
    () => localStorage.getItem('spider_lens_wp_beginner') !== 'false'
  )

  function toggle() {
    setBeginner(b => {
      localStorage.setItem('spider_lens_wp_beginner', String(!b))
      return !b
    })
  }

  return (
    <BeginnerModeContext.Provider value={{ beginner, toggle }}>
      {children}
    </BeginnerModeContext.Provider>
  )
}
