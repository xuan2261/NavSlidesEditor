import { useEffect, useRef } from 'react'

export function useRevealPreviewFrame(htmlContent, state = null) {
  const iframeRef = useRef(null)
  const deckRef = useRef(null)
  const revealCheckRef = useRef(null)
  const latestStateRef = useRef(state)

  useEffect(() => {
    latestStateRef.current = state
  }, [state])

  useEffect(() => {
    if (!htmlContent || !iframeRef.current) return

    deckRef.current = null
    if (revealCheckRef.current) {
      clearInterval(revealCheckRef.current)
      revealCheckRef.current = null
    }

    iframeRef.current.srcdoc = htmlContent
    iframeRef.current.onload = () => {
      const iframeWindow = iframeRef.current?.contentWindow
      if (!iframeWindow) return

      revealCheckRef.current = setInterval(() => {
        try {
          const deck = iframeWindow.Reveal
          if (deck && typeof deck.isReady === 'function' && deck.isReady()) {
            clearInterval(revealCheckRef.current)
            revealCheckRef.current = null
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

      setTimeout(() => {
        if (revealCheckRef.current) {
          clearInterval(revealCheckRef.current)
          revealCheckRef.current = null
        }
      }, 15000)
    }

    return () => {
      if (revealCheckRef.current) {
        clearInterval(revealCheckRef.current)
        revealCheckRef.current = null
      }
    }
  }, [htmlContent])

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
