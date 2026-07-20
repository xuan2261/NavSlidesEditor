import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useRevealPreviewFrame } from '../hooks/use-reveal-preview-frame'
import { useAnnotationSync } from '../hooks/use-annotation-sync.js'
import { useLiveTimerSync } from '../hooks/use-live-timer-sync.js'
import { TimerContext } from '../contexts/timer-context-state-provider.jsx'
import { BlackScreenOverlay } from '../components/black-screen-overlay.jsx'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry.js'

export default function LiveViewPage() {
  const { roomCode } = useParams()

  // Socket reference shared across callbacks
  const socketRef = useRef(null)

  // Annotation strokes keyed by slide index so strokes never bleed across
  // slides. The displayed set is derived from the current slide.
  const [strokesBySlide, setStrokesBySlide] = useState({})

  // Slideshow overlay
  const [overlayColor, setOverlayColor] = useState(null) // 'black' | 'white' | null

  const [isConnected, setIsConnected] = useState(false)
  const [presenterLeft, setPresenterLeft] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')
  const [liveState, setLiveState] = useState({ slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 })
  const [cursorPos, setCursorPos] = useState(null)
  const [laserPos, setLaserPos] = useState(null)
  const [viewerCount, setViewerCount] = useState(0)
  const [roomNotFound, setRoomNotFound] = useState(false)
  const [joinError, setJoinError] = useState('')
  const { iframeRef } = useRevealPreviewFrame(htmlContent, liveState)
  const [iframeElement, setIframeElement] = useState(null)

  const handleIframeRef = useCallback((node) => {
    iframeRef.current = node
    setIframeElement(node)
  }, [iframeRef])

  const handleOverlayKeyDown = useCallback((event) => {
    if (event.defaultPrevented || event.isComposing) return

    const target = event.target
    const tag = target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return

    const shortcuts = getShortcuts({})

    const normalizeKey = (keyboardEvent) => {
      const mods = []
      if (keyboardEvent.ctrlKey || keyboardEvent.metaKey) mods.push('Ctrl')
      if (keyboardEvent.shiftKey) mods.push('Shift')
      if (keyboardEvent.altKey) mods.push('Alt')
      const key = keyboardEvent.key.length === 1 ? keyboardEvent.key.toUpperCase() : keyboardEvent.key
      return mods.length > 0 ? [...mods, key].join('+') : key
    }

    const shortcut = shortcuts.find((item) => item.activeKey === normalizeKey(event))
    if (!shortcut) return

    if (shortcut.id === 'blackScreen') { event.preventDefault(); setOverlayColor('black'); return }
    if (shortcut.id === 'whiteScreen') { event.preventDefault(); setOverlayColor('white'); return }
    if (shortcut.id === 'escape') {
      event.preventDefault()
      setOverlayColor((currentOverlayColor) => currentOverlayColor ? null : currentOverlayColor)
    }
  }, [])

  // A focused same-origin presentation iframe does not bubble keyboard events to its parent.
  useEffect(() => {
    document.addEventListener('keydown', handleOverlayKeyDown)

    const iframe = iframeElement
    let iframeDocument = null
    const attachIframeKeyboardHandler = () => {
      const nextDocument = iframe?.contentDocument
      if (!nextDocument || nextDocument === iframeDocument) return

      iframeDocument?.removeEventListener('keydown', handleOverlayKeyDown)
      nextDocument.addEventListener('keydown', handleOverlayKeyDown)
      iframeDocument = nextDocument
    }

    attachIframeKeyboardHandler()
    iframe?.addEventListener('load', attachIframeKeyboardHandler)

    return () => {
      document.removeEventListener('keydown', handleOverlayKeyDown)
      iframe?.removeEventListener('load', attachIframeKeyboardHandler)
      iframeDocument?.removeEventListener('keydown', handleOverlayKeyDown)
    }
  }, [handleOverlayKeyDown, iframeElement])

  // 1. Socket.IO connection
  useEffect(() => {
    const socket = io({ path: '/ws', reconnection: true })
    socketRef.current = socket  // make available for timer/event bridge hooks immediately

    socket.on('connect_error', (err) => {
      setJoinError(err.message || 'Connection failed')
    })

    socket.on('connect', () => {
      setIsConnected(true)
      setJoinError('')
      socket.emit('join-room', { roomId: roomCode, role: 'viewer' })
    })

    socket.on('disconnect', () => setIsConnected(false))

    socket.on('sync-state', (state) => {
      setLiveState({
        slideIndex: state.slideIndex || 0,
        verticalIndex: state.verticalIndex || 0,
        fragmentIndex: state.fragmentIndex || 0,
      })
    })

    socket.on('navigate', ({ slideIndex, verticalIndex = 0, fragmentIndex = 0 }) => {
      setLiveState({ slideIndex: slideIndex || 0, verticalIndex, fragmentIndex })
    })

    socket.on('cursor-move', ({ x, y }) => setCursorPos({ x, y }))

    socket.on('laser', ({ x, y, active }) => {
      setLaserPos(active ? { x, y } : null)
    })

    // Presenter disconnected (room survives, may reconnect) or left (room ended)
    socket.on('presenter-disconnected', () => setPresenterLeft(true))
    socket.on('presenter-left', () => setPresenterLeft(true))

    socket.on('viewer-count', ({ count }) => setViewerCount(count))
    socket.on('room-not-found', () => setRoomNotFound(true))
    socket.on('join-error', ({ message }) => {
      setJoinError(message || 'Failed to join live room')
      setRoomNotFound(true)
    })

    // When we receive presentation data (HTML), render it
    socket.on('presentation-data', (data) => {
      if (data.html) setHtmlContent(data.html)
    })

    // Check if the room exists
    const checkRoom = async () => {
      try {
        const roomRes = await fetch(`/api/live/room/${roomCode}`)
        if (!roomRes.ok) throw new Error('Failed to check room')
        const roomData = await roomRes.json()
        if (!roomData.exists) {
          setRoomNotFound(true)
        }
      } catch (err) {
        console.error('Failed to check room', err)
        setRoomNotFound(true)
      }
    }
    checkRoom()

    return () => {
      socket.disconnect()
    }
  }, [roomCode])

  useEffect(() => {
    if (!isConnected || !htmlContent || presenterLeft) return undefined
    let cancelled = false

    const checkPresenter = async () => {
      try {
        const res = await fetch(`/api/live/room/${roomCode}`)
        if (!res.ok) return
        const room = await res.json()
        if (!cancelled && room.exists && room.hasPresenter === false) {
          setPresenterLeft(true)
        }
      } catch {
        // Socket events remain primary; this poll is only a missed-event fallback.
      }
    }

    const interval = setInterval(checkPresenter, 2000)
    checkPresenter()
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [htmlContent, isConnected, presenterLeft, roomCode])


  // Annotation sync — handlers operate on the current slide's stroke bucket.
  const slideIndex = liveState.slideIndex

  const handleAnnotationAdd = useCallback((annotation, targetSlideIndex = slideIndex) => {
    setStrokesBySlide((prev) => ({
      ...prev,
      [targetSlideIndex]: [...(prev[targetSlideIndex] || []), annotation],
    }))
  }, [slideIndex])

  const handleAnnotationRemove = useCallback((annotationId, targetSlideIndex = slideIndex) => {
    setStrokesBySlide((prev) => ({
      ...prev,
      [targetSlideIndex]: (prev[targetSlideIndex] || []).filter((a) => a.id !== annotationId),
    }))
  }, [slideIndex])

  const handleAnnotationsClear = useCallback((targetSlideIndex = slideIndex) => {
    setStrokesBySlide((prev) => ({ ...prev, [targetSlideIndex]: [] }))
  }, [slideIndex])

  useAnnotationSync({
    socket: socketRef.current,
    slideIndex,
    onAnnotationAdd: handleAnnotationAdd,
    onAnnotationRemove: handleAnnotationRemove,
    onAnnotationsClear: handleAnnotationsClear,
  })

  const annotationStrokes = strokesBySlide[slideIndex] || []
  const normalizedAnnotationStrokes = annotationStrokes.filter(
    (annotation) => annotation.coordinateSpace === 'normalized'
  )
  const legacyAnnotationStrokes = annotationStrokes.filter(
    (annotation) => annotation.coordinateSpace !== 'normalized'
  )

  // Timer sync (Phase 2): subscribe to server timer events
  const timerStatesRef = useLiveTimerSync(socketRef.current, (elementId) => {
    // Optional: handle timer end (e.g., log or notify)
    console.log('[timer] ended:', elementId)
  })

  // Expose timer states via window for iframe consumers (game renderers)
  useEffect(() => {
    const interval = setInterval(() => {
      const states = {}
      for (const [id, state] of Object.entries(timerStatesRef.current)) {
        states[id] = {
          remaining: state.running && state.endedAt
            ? Math.max(0, Math.ceil((state.endedAt - Date.now()) / 1000))
            : (state.pausedRemaining ?? state.duration),
          duration: state.duration,
          running: state.running,
          endedAt: state.endedAt,
        }
      }
      window.__timerStates = states
    }, 100)
    return () => clearInterval(interval)
  }, [timerStatesRef])

  // Bridge: iframe game renderers emit timer events via postMessage
  useEffect(() => {
    const handler = (event) => {
      if (!socketRef.current?.connected) return
      const [type, data] = event.data || []
      if (type === '__timer-event' && data) {
        socketRef.current.emit(data.event, data.payload)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Expose emit bridge on window for iframe children
  useEffect(() => {
    window.__emitTimerEvent = (event, payload) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(event, payload)
      }
    }
    return () => { delete window.__emitTimerEvent }
  }, [])

  if (roomNotFound && !htmlContent) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white font-sans">
        <div className="text-center">
          <h2 className="text-2xl mb-2">Room not found</h2>
          <p className="text-text-secondary mb-4">
            {joinError || 'This live session does not exist or has ended.'}
          </p>
          <a href="/" className="text-primary text-sm">
            ← Back to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <TimerContext.Provider value={timerStatesRef}>
    <div className="w-screen h-screen relative bg-black overflow-hidden">
      {/* Connection status */}
      {!isConnected && (
        <div className="absolute top-3 left-3 z-[1000] bg-danger/90 text-white px-3.5 py-1.5 rounded-md text-[13px] font-medium">
          Connecting to live session...
        </div>
      )}

      {/* Waiting for presenter */}
      {isConnected && !htmlContent && !presenterLeft && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black">
          <div className="text-center text-white font-sans">
            <div className="w-12 h-12 rounded-full border-[3px] border-primary-light border-t-primary animate-spin mx-auto mb-4" />
            <h2 className="text-xl mb-2">Waiting for presenter...</h2>
            <p className="text-text-secondary text-sm">Room: {roomCode}</p>
          </div>
        </div>
      )}

      {/* Viewer count badge */}
      {isConnected && !presenterLeft && htmlContent && (
        <div className="absolute top-3 right-3 z-[1000] bg-primary/85 text-white px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
          {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
        </div>
      )}

      {presenterLeft && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/80">
          <div className="text-center text-white font-sans">
            <h2 className="text-2xl mb-2">Presenter has left</h2>
            <p className="text-text-secondary">The live session has ended.</p>
            <a href="/" className="text-primary text-sm">
              ← Back to Home
            </a>
          </div>
        </div>
      )}

      {/* Cursor dot overlay — KEEP inline: dynamic runtime positions */}
      {cursorPos && (
        <div
          style={{
            position: 'absolute',
            left: `${cursorPos.x * 100}%`,
            top: `${cursorPos.y * 100}%`,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'rgba(99,102,241,0.8)',
            border: '2px solid #fff',
            pointerEvents: 'none',
            zIndex: 9999,
            transform: 'translate(-50%, -50%)',
            transition: 'all 0.08s linear',
          }}
        />
      )}

      {/* Laser pointer overlay — KEEP inline: dynamic runtime positions */}
      {laserPos && (
        <div
          style={{
            position: 'absolute',
            left: `${laserPos.x * 100}%`,
            top: `${laserPos.y * 100}%`,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,0,0,0.8), rgba(255,0,0,0) 70%)',
            pointerEvents: 'none',
            zIndex: 9999,
            transform: 'translate(-50%, -50%)',
            transition: 'all 0.05s linear',
            boxShadow: '0 0 20px rgba(255,0,0,0.5)',
          }}
        />
      )}

      {/* Black screen overlay */}
      <BlackScreenOverlay
        visible={overlayColor !== null}
        color={overlayColor}
        onDismiss={() => setOverlayColor(null)}
      />



      {/* Annotation overlay — KEEP inline: dynamic SVG paths */}
      {legacyAnnotationStrokes.length > 0 && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9998,
          }}
        >
          {legacyAnnotationStrokes.map((a, i) => (
            <path
              key={a.id || i}
              d={a.d}
              stroke={a.color || '#ff0000'}
              strokeWidth={a.strokeWidth || 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={a.type === 'highlighter' ? 0.3 : 1}
            />
          ))}
        </svg>
      )}
      {normalizedAnnotationStrokes.length > 0 && (
        <svg
          data-testid="live-annotation-overlay"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9998,
          }}
        >
          {normalizedAnnotationStrokes.map((a, i) => (
            <path
              key={a.id || i}
              d={a.d}
              stroke={a.color || '#ff0000'}
              strokeWidth={a.strokeWidth || 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={a.type === 'highlighter' ? 0.3 : 1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}

      {/* Presentation iframe — renders the full presentation HTML with all resources */}
      <iframe
        ref={handleIframeRef}
        className="w-full h-full border-none block"
        title="Live Presentation"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
    </TimerContext.Provider>
  )
}
