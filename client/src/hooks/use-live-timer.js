import { useState, useEffect } from 'react'

/**
 * Consumes timer state for a specific element from the timerStatesRef.
 * Returns the latest server-provided state for that element.
 */
export function useLiveTimer(elementId, timerStatesRef) {
  const [timerState, setTimerState] = useState({
    remaining: 0,
    duration: 30,
    running: false,
    endedAt: null,
  })

  useEffect(() => {
    const update = () => {
      const state = timerStatesRef.current[elementId]
      if (state) setTimerState(state)
    }
    update()
    const id = setInterval(update, 100)
    return () => clearInterval(id)
  }, [elementId, timerStatesRef])

  return timerState
}
