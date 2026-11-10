import { useEffect, useRef, useState } from 'react'

export function useRevealPreviewFrame(htmlContent, state = null, frameKey = 0) {
  const iframeRef = useRef(null)
  const deckRef = useRef(null)
  const generationRef = useRef(0)
  const latestStateRef = useRef(state)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  useEffect(() => {
    latestStateRef.current = state
  }, [state])

  useEffect(() => {
    const frame = iframeRef.current
    if (!htmlContent || !frame) return

    const generation = generationRef.current + 1
    generationRef.current = generation
    let timeoutId = null
    let deck = null
    let output = null
    let readyListener = null
    let failed = false
    const isCurrent = () => !failed && generationRef.current === generation && iframeRef.current === frame
    const clearTimers = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }

    deckRef.current = null
    setStatus('loading')
    setError(null)
    const fail = (cause) => {
      if (!isCurrent()) return
      failed = true
      clearTimers()
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('error')
    }
    const handleLoad = async () => {
      if (!isCurrent()) return
      clearTimers()
      const iframeWindow = frame.contentWindow
      if (!iframeWindow) return
      timeoutId = setTimeout(() => {
        fail(new Error('Preview readiness deadline'))
      }, 15000)
      try {
        output = iframeWindow.__navslidesSemanticOutput
        if (output) {
          await output.ready
          if (!isCurrent()) return
          if (output.state !== 'ready') throw new Error('Semantic preview is not ready')
        }
        if (!isCurrent()) return
        deck = iframeWindow.Reveal
        if (!deck) throw new Error('Reveal preview runtime unavailable')
        readyListener = () => {
          if (!isCurrent() || (output && output.state !== 'ready')) return
          clearTimers()
          deckRef.current = deck
          deck.configure({
            keyboard: false, touch: false, controls: false, progress: true, overview: false,
          })
          const fsBtn = iframeWindow.document.getElementById('fs-btn')
          if (fsBtn) fsBtn.style.display = 'none'
          if (latestStateRef.current) deck.slide(
            latestStateRef.current.slideIndex || 0,
            latestStateRef.current.verticalIndex || 0,
            latestStateRef.current.fragmentIndex || 0
          )
          setStatus('ready')
        }
        if (deck.isReady?.()) readyListener()
        else deck.on('ready', readyListener)
      } catch (cause) { fail(cause) }
    }

    frame.onload = handleLoad
    frame.srcdoc = htmlContent

    return () => {
      if (generationRef.current === generation) generationRef.current += 1
      clearTimers()
      deck?.off?.('ready', readyListener)
      output?.dispose?.()
      deckRef.current = null
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

  return { iframeRef, deckRef, status, error }
}
