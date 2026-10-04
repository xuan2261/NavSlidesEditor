import { useEffect, useRef } from 'react'
import { gameInstanceKey } from 'revealjs-shared'

/**
 * Subscribes to timer:sync and timer:ended events from the server.
 * Stores server timer state by effective slide/element identity.
 */
export function useLiveTimerSync(socket, onTimerEnded, onTimerStatesChanged) {
  const timerStatesRef = useRef({})
  const generationRef = useRef(0)
  const onTimerEndedRef = useRef(onTimerEnded)
  const onTimerStatesChangedRef = useRef(onTimerStatesChanged)

  useEffect(() => {
    onTimerEndedRef.current = onTimerEnded
    onTimerStatesChangedRef.current = onTimerStatesChanged
  }, [onTimerEnded, onTimerStatesChanged])

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    timerStatesRef.current = {}
    onTimerStatesChangedRef.current?.(timerStatesRef.current)

    const isCurrentGeneration = () => generationRef.current === generation
    const handleSync = (data) => {
      const key = gameInstanceKey(data)
      if (!isCurrentGeneration() || !key) return
      timerStatesRef.current = {
        ...timerStatesRef.current,
        [key]: data,
      }
      onTimerStatesChangedRef.current?.(timerStatesRef.current)
    }
    const handleEnded = (data) => {
      const key = gameInstanceKey(data)
      if (!isCurrentGeneration() || !key || !Object.hasOwn(timerStatesRef.current, key)) return
      const next = { ...timerStatesRef.current }
      delete next[key]
      timerStatesRef.current = next
      onTimerStatesChangedRef.current?.(next)
      onTimerEndedRef.current?.(data)
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
      onTimerStatesChangedRef.current?.(timerStatesRef.current)
    }
  }, [socket])

  return timerStatesRef
}
