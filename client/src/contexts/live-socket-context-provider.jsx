import { createContext } from 'react'

// Shares the Socket.IO socket instance across components to avoid a second connection
export const LiveSocketContext = createContext(null)
