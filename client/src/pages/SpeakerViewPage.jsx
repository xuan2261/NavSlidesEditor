import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { Clock, Home, Layers, Users } from 'lucide-react'
import { useRevealPreviewFrame } from '../hooks/use-reveal-preview-frame'
import { useAnnotationSync } from '../hooks/use-annotation-sync.js'
import { useKeyboard } from '../hooks/use-keyboard'

import { AnnotationCanvas } from '../components/annotation-canvas.jsx'
import { AnnotationToolbar } from '../components/annotation-toolbar.jsx'
import { LiveSocketContext } from '../contexts/live-socket-context-provider.jsx'

const initialState = { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 }

function formatElapsed(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function findSlide(slides, state) {
  return (slides || []).find(
    (slide) => slide.slideIndex === state.slideIndex && slide.verticalIndex === state.verticalIndex
  )
}

function PreviewFrame({ htmlContent, state, title, children }) {
  const { iframeRef } = useRevealPreviewFrame(htmlContent, state)

  return (
    <div className="flex flex-col min-h-0">
      <h4 className="label-caps m-0 mb-2">{title}</h4>
      <div className="relative flex-1 min-h-[120px] rounded-lg bg-card border border-border-strong overflow-hidden">
        {!state ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
            No next slide
          </div>
        ) : htmlContent ? (
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none block bg-black"
            title={title}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">
            Waiting for presentation...
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

function LegacyAnnotationOverlay({ strokes }) {
  if (strokes.length === 0) return null
  return (
    <svg
      data-testid="speaker-legacy-annotation-overlay"
      className="absolute inset-0 w-full h-full pointer-events-none z-[99989]"
    >
      {strokes.map((stroke, index) => (
        <path
          key={stroke.id || index}
          d={stroke.d}
          stroke={stroke.color || '#ff0000'}
          strokeWidth={stroke.strokeWidth || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={stroke.type === 'highlighter' ? 0.3 : 1}
        />
      ))}
    </svg>
  )
}

export default function SpeakerViewPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const [socket, setSocket] = useState(null)

  const [isConnected, setIsConnected] = useState(false)
  const [hasPresenter, setHasPresenter] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')
  const [meta, setMeta] = useState({ slideCount: 0, slides: [] })
  const [liveState, setLiveState] = useState(initialState)
  const [viewersCount, setViewersCount] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [presenterLeft, setPresenterLeft] = useState(false)
  const [presenterReconnecting, setPresenterReconnecting] = useState(false)
  const [roomNotFound, setRoomNotFound] = useState(false)
  const [roomEnded, setRoomEnded] = useState(false)

  // Annotation state
  const [annotationTool, setAnnotationTool] = useState('none') // 'none'|'pen'|'laser'|'highlighter'|'eraser'
  const [annotationColor, setAnnotationColor] = useState('#FF0000')
  const [annotationStrokes, setAnnotationStrokes] = useState([])

  const flatSlides = useMemo(() => meta.slides || [], [meta.slides])
  const currentSlide = useMemo(() => findSlide(flatSlides, liveState), [flatSlides, liveState])
  const currentFlatIndex = Math.max(
    0,
    flatSlides.findIndex(
      (slide) =>
        slide.slideIndex === liveState.slideIndex && slide.verticalIndex === liveState.verticalIndex
    )
  )
  const nextSlide = flatSlides[currentFlatIndex + 1] || null
  const nextState = nextSlide
    ? {
        slideIndex: nextSlide.slideIndex,
        verticalIndex: nextSlide.verticalIndex,
        fragmentIndex: 0,
      }
    : null

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((time) => time + 1)
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const socket = io({ path: '/ws', reconnection: true })
    socketRef.current = socket

    socket.on('connect_error', (err) => {
      console.error('Speaker socket connection error:', err.message)
    })

    socket.on('connect', () => {
      setIsConnected(true)
      setSocket(socket)
      socket.emit('join-room', { roomId: roomCode, role: 'controller' })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      setHasPresenter(false)
    })
    socket.on('room-not-found', () => setRoomNotFound(true))
    socket.on('presenter-status', ({ hasPresenter: nextHasPresenter, presenterConnected }) => {
      setHasPresenter(nextHasPresenter === true)
      setPresenterReconnecting(presenterConnected === true && nextHasPresenter === false)
    })
    socket.on('presenter-disconnected', () => {
      setHasPresenter(false)
      setPresenterReconnecting(true)
    })
    socket.on('presenter-reconnected', () => {
      setHasPresenter(true)
      setPresenterReconnecting(false)
    })
    socket.on('presenter-left', () => {
      setHasPresenter(false)
      setPresenterLeft(true)
      setPresenterReconnecting(false)
    })
    socket.on('room-ended', () => {
      setHasPresenter(false)
      setRoomEnded(true)
      setPresenterReconnecting(false)
    })
    socket.on('viewer-count', ({ count }) => setViewersCount(count))
    socket.on('presentation-meta', setMeta)
    socket.on('presentation-data', (data) => {
      if (data.html) setHtmlContent(data.html)
    })

    const applyState = (state) => {
      setLiveState({
        slideIndex: state.slideIndex || 0,
        verticalIndex: state.verticalIndex || 0,
        fragmentIndex: state.fragmentIndex || 0,
      })
    }

    socket.on('sync-state', applyState)
    socket.on('navigate', applyState)

    return () => socket.disconnect()
  }, [roomCode])

  const controlsDisabled =
    !isConnected || !hasPresenter || presenterReconnecting || presenterLeft || roomEnded
  const canControl = !controlsDisabled

  // Annotation event handlers
  const handleAnnotationAdd = useCallback((annotation) => {
    setAnnotationStrokes((prev) => (
      prev.some((existing) => existing.id === annotation.id) ? prev : [...prev, annotation]
    ))
  }, [])

  const handleAnnotationRemove = useCallback((annotationId) => {
    setAnnotationStrokes((prev) => prev.filter((a) => a.id !== annotationId))
  }, [])

  const handleAnnotationsClear = useCallback(() => {
    setAnnotationStrokes([])
  }, [])

  const { registerAnnotationId } = useAnnotationSync({
    socket,
    slideIndex: liveState.slideIndex,
    verticalIndex: liveState.verticalIndex,
    onAnnotationAdd: handleAnnotationAdd,
    onAnnotationRemove: handleAnnotationRemove,
    onAnnotationsClear: handleAnnotationsClear,
  })

  // Emit annotation:add on stroke complete
  const handleStrokeComplete = useCallback((stroke) => {
    if (!socket || !canControl) return
    const d = stroke.points.reduce((acc, p, i) =>
      acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), '')
    const annotation = {
      id: crypto.randomUUID(),
      d,
      color: stroke.color,
      strokeWidth: stroke.strokeWidth,
      type: stroke.type || 'path',
      coordinateSpace: stroke.coordinateSpace,
      createdAt: new Date().toISOString(),
      createdBy: 'presenter',
    }
    registerAnnotationId(annotation.id)
    socket.emit('annotation:add', {
      slideIndex: liveState.slideIndex,
      verticalIndex: liveState.verticalIndex,
      annotation,
    })
    setAnnotationStrokes((prev) => [...prev, annotation])
  }, [canControl, liveState.slideIndex, liveState.verticalIndex, registerAnnotationId, socket])

  const handleLaserChange = useCallback((position) => {
    if (!canControl) return
    socketRef.current?.emit('laser', position)
  }, [canControl])

  useKeyboard({
    isPresenting: canControl,
    onPenTool: () => setAnnotationTool('pen'),
    onLaserPointer: () => setAnnotationTool('laser'),
    onHighlighterTool: () => setAnnotationTool('highlighter'),
    onEraseAnnotations: () => setAnnotationTool('eraser'),
  })

  const navigateToSlide = (slide) => {
    if (!hasPresenter) return
    socketRef.current?.emit('control-navigate', {
      slideIndex: slide.slideIndex,
      verticalIndex: slide.verticalIndex || 0,
      fragmentIndex: 0,
    })
  }

  const normalizedAnnotationStrokes = annotationStrokes.filter(
    (annotation) => annotation.coordinateSpace === 'normalized'
  )
  const legacyAnnotationStrokes = annotationStrokes.filter(
    (annotation) => annotation.coordinateSpace !== 'normalized'
  )
  const slideControlsDisabled = controlsDisabled

  return (
    <LiveSocketContext.Provider value={socket}>
    <div className="w-screen h-screen min-w-0 bg-surface-0 text-text-primary grid grid-rows-[auto_1fr_auto] font-sans overflow-hidden">
      <div className="px-4 py-2 flex flex-wrap justify-between items-center gap-2 border-b border-border-strong bg-surface-1">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="bg-transparent border-none text-text-secondary cursor-pointer flex items-center gap-1 text-[13px] hover:text-text-primary transition-colors"
          >
            <Home size={14} /> Exit
          </button>
          <span className="text-sm font-semibold text-text-primary">
            <Layers size={14} className="inline-block align-middle mr-1" />
            Slide {currentSlide?.label || liveState.slideIndex + 1}
            {meta.slideCount > 0 ? ` / ${meta.slideCount}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-5 text-[13px]">
          <span className="flex items-center gap-1 text-text-secondary">
            <Clock size={14} /> {formatElapsed(elapsedTime)}
          </span>
          <span className="text-text-muted">{currentTime.toLocaleTimeString()}</span>
          <span className="flex items-center gap-1 text-text-secondary">
            <Users size={14} /> {viewersCount}
          </span>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`} />
        </div>
      </div>

      {presenterReconnecting && !presenterLeft && !roomEnded && (
        <div className="absolute top-14 left-1/2 z-[900] -translate-x-1/2 rounded-md bg-warning/90 px-3 py-1.5 text-sm font-medium text-white">
          Presenter reconnecting...
        </div>
      )}
      {isConnected && !hasPresenter && !presenterReconnecting && !presenterLeft && !roomEnded && (
        <div className="absolute top-14 left-1/2 z-[900] -translate-x-1/2 rounded-md bg-card px-3 py-1.5 text-sm text-text-muted">
          Waiting for presenter...
        </div>
      )}

      <div
        data-testid="speaker-main"
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-px overflow-y-auto lg:overflow-hidden min-h-0"
      >
        <div
          data-testid="speaker-previews"
          className="p-4 grid grid-rows-[minmax(240px,1fr)_140px] gap-3 min-h-[420px] lg:min-h-0"
        >
          <PreviewFrame htmlContent={htmlContent} state={liveState} title="Current Slide">
            <LegacyAnnotationOverlay strokes={legacyAnnotationStrokes} />
            <AnnotationCanvas
              tool={canControl ? annotationTool : 'none'}
              color={annotationColor}
              strokeWidth={3}
              strokes={normalizedAnnotationStrokes}
              onStrokeComplete={handleStrokeComplete}
              onLaserChange={handleLaserChange}
              onErase={(strokeId) => {
                if (!canControl) return
                socketRef.current?.emit('annotation:remove', {
                  slideIndex: liveState.slideIndex,
                  verticalIndex: liveState.verticalIndex,
                  annotationId: strokeId,
                })
              }}
            />
          </PreviewFrame>
          <PreviewFrame htmlContent={htmlContent} state={nextState} title="Next Slide" />
        </div>

        <div
          data-testid="speaker-notes"
          className="p-4 min-h-[240px] lg:min-h-0 border-t lg:border-t-0 lg:border-l border-border-strong flex flex-col overflow-hidden"
        >
          <h4 className="label-caps m-0 mb-3">Speaker Notes</h4>
          <div className="flex-1 overflow-y-auto text-base leading-[1.8] text-text-primary whitespace-pre-wrap">
            {currentSlide?.notes || 'No speaker notes for this slide.'}
          </div>
        </div>
      </div>

      {/* Annotation toolbar */}
      <AnnotationToolbar
        tool={annotationTool}
        color={annotationColor}
        onToolChange={canControl ? setAnnotationTool : undefined}
        onColorChange={canControl ? setAnnotationColor : undefined}
        onClear={() => {
          if (!canControl) return
          if (socketRef.current) {
            socketRef.current.emit('annotation:clear', {
              slideIndex: liveState.slideIndex,
              verticalIndex: liveState.verticalIndex,
            })
          }
          setAnnotationStrokes([])
        }}
        visible={canControl && annotationTool !== 'none'}
      />

      <div className="px-4 py-2 border-t border-border-strong bg-surface-1 flex gap-1 overflow-x-auto">
        {flatSlides.map((slide) => {
          const active =
            slide.slideIndex === liveState.slideIndex && slide.verticalIndex === liveState.verticalIndex
          return (
            <button
              key={`${slide.slideIndex}-${slide.verticalIndex}`}
              onClick={() => navigateToSlide(slide)}
              disabled={slideControlsDisabled}
              className={`min-w-12 h-8 rounded shrink-0 text-[11px] cursor-pointer px-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? 'border-2 border-primary bg-primary-light text-primary font-bold'
                  : 'border border-border-strong bg-card text-text-muted hover:text-text-primary'
              }`}
              title={slide.title}
            >
              {slide.label}
            </button>
          )
        })}
      </div>

      {(presenterLeft || roomNotFound || roomEnded) && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center">
          <div className="text-center text-white">
            <h2>{presenterLeft ? 'Presenter has left' : roomEnded ? 'Session ended' : roomNotFound ? 'Room not found' : 'Presenter has left'}</h2>
            <button
              onClick={() => navigate('/')}
              className="bg-accent text-white px-4 py-2 rounded font-medium hover:bg-accent/90 transition-colors border-none mt-3"
            >
              Go Home
            </button>
          </div>
        </div>
      )}
    </div>
    </LiveSocketContext.Provider>
  )
}
