import { useEffect, useCallback, useRef } from 'react'

/**
 * Subscribes to timer:sync and timer:ended events from the server.
 * Stores timer states in a ref so iframe consumers can read via window.__timerStates.
 */
export function useLiveTimerSync(socket, onTimerEnded) {
  const timerStatesRef = useRef({})

  const handleSync = useCallback((data) => {
    timerStatesRef.current = {
      ...timerStatesRef.current,
      [data.elementId]: data,
    }
  }, [])

  const handleEnded = useCallback(
    (data) => {
      delete timerStatesRef.current[data.elementId]
      onTimerEnded?.(data.elementId)
    },
    [onTimerEnded]
  )

  useEffect(() => {
    if (!socket) return
    socket.on('timer:sync', handleSync)
    socket.on('timer:ended', handleEnded)
    return () => {
      socket.off('timer:sync', handleSync)
      socket.off('timer:ended', handleEnded)
    }
  }, [socket, handleSync, handleEnded])

  return timerStatesRef
}
