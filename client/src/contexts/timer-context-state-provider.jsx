import { createContext } from 'react'

// elementId -> TimerState (server-provided, read via window.__timerStates inside iframe)
export const TimerContext = createContext({})
