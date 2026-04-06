import { createContext, useContext } from 'react'

export const BeginnerModeContext = createContext({ beginner: false, toggle: () => {} })

export function useBeginnerMode() {
  return useContext(BeginnerModeContext)
}
