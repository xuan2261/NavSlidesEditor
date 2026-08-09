import { useEffect, useRef } from 'react'

/**
 * Subscribes to timer:sync and timer:ended events from the server.
 * Stores timer states in a ref so iframe consumers can read via window.__timerStates.
 */
export function useLiveTimerSync(socket, onTimerEnded) {
  const timerStatesRef = useRef({})
  const generationRef = useRef(0)
  const onTimerEndedRef = useRef(onTimerEnded)

  useEffect(() => {
    onTimerEndedRef.current = onTimerEnded
  }, [onTimerEnded])

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    timerStatesRef.current = {}

    const isCurrentGeneration = () => generationRef.current === generation
    const handleSync = (data) => {
      if (!isCurrentGeneration() || !data?.elementId) return
      timerStatesRef.current = {
        ...timerStatesRef.current,
        [data.elementId]: data,
      }
    }
    const handleEnded = (data) => {
      if (!isCurrentGeneration() || !data?.elementId) return
      delete timerStatesRef.current[data.elementId]
      onTimerEndedRef.current?.(data.elementId)
    }

    if (socket) {
      socket.on('timer:sync', handleSync)
      socket.on('timer:ended', handleEnded)
    }

    return () => {
      if (isCurrentGeneration()) generationRef.current += 1
      if (socket) {
        socket.off('timer:sync', handleSync)
        socket.off('timer:ended', handleEnded)
      }
      timerStatesRef.current = {}
    }
  }, [socket])

  return timerStatesRef
}
