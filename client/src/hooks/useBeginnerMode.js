import { createContext, useContext, useState } from 'react'

export const BeginnerModeContext = createContext({ beginner: false, toggle: () => {} })

export function useBeginnerMode() {
  return useContext(BeginnerModeContext)
}
