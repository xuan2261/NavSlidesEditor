import { useEffect, useRef } from 'react'

export function useRevealPreviewFrame(htmlContent, state = null, frameKey = 0) {
  const iframeRef = useRef(null)
  const deckRef = useRef(null)
  const generationRef = useRef(0)
  const latestStateRef = useRef(state)

  useEffect(() => {
    latestStateRef.current = state
  }, [state])

  useEffect(() => {
    const frame = iframeRef.current
    if (!htmlContent || !frame) return

    const generation = generationRef.current + 1
    generationRef.current = generation
    let intervalId = null
    let timeoutId = null
    const isCurrent = () => generationRef.current === generation && iframeRef.current === frame
    const clearTimers = () => {
      if (intervalId !== null) {
        clearInterval(intervalId)
        intervalId = null
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    deckRef.current = null
    const handleLoad = () => {
      if (!isCurrent()) return
      clearTimers()
      const iframeWindow = frame.contentWindow
      if (!iframeWindow) return

      intervalId = setInterval(() => {
        if (!isCurrent()) {
          clearTimers()
          return
        }
        try {
          const deck = iframeWindow.Reveal
          if (deck && typeof deck.isReady === 'function' && deck.isReady()) {
            clearTimers()
            deckRef.current = deck
            deck.configure({
              keyboard: false,
              touch: false,
              controls: false,
              progress: true,
              overview: false,
            })
            const fsBtn = iframeWindow.document.getElementById('fs-btn')
            if (fsBtn) fsBtn.style.display = 'none'
            if (latestStateRef.current) {
              deck.slide(
                latestStateRef.current.slideIndex || 0,
                latestStateRef.current.verticalIndex || 0,
                latestStateRef.current.fragmentIndex || 0
              )
            }
          }
        } catch {
          /* iframe can be temporarily inaccessible while srcdoc loads */
        }
      }, 100)

      timeoutId = setTimeout(() => {
        if (isCurrent()) clearTimers()
      }, 15000)
    }

    frame.onload = handleLoad
    frame.srcdoc = htmlContent

    return () => {
      if (generationRef.current === generation) generationRef.current += 1
      clearTimers()
      if (frame.onload === handleLoad) frame.onload = null
    }
  }, [htmlContent, frameKey])

  useEffect(() => {
    if (!deckRef.current || !state) return
    try {
      deckRef.current.slide(state.slideIndex || 0, state.verticalIndex || 0, state.fragmentIndex || 0)
    } catch {
      /* ignore invalid transient reveal state */
    }
  }, [state])

  return { iframeRef, deckRef }
}
