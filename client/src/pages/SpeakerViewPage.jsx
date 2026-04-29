import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { Clock, Home, Layers, Users } from 'lucide-react'
import { useRevealPreviewFrame } from '../hooks/use-reveal-preview-frame'

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

function PreviewFrame({ htmlContent, state, title }) {
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
      </div>
    </div>
  )
}

export default function SpeakerViewPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)

  const [isConnected, setIsConnected] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')
  const [meta, setMeta] = useState({ slideCount: 0, slides: [] })
  const [liveState, setLiveState] = useState(initialState)
  const [viewersCount, setViewersCount] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [presenterLeft, setPresenterLeft] = useState(false)
  const [roomNotFound, setRoomNotFound] = useState(false)

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
      socket.emit('join-room', { roomId: roomCode, role: 'controller' })
    })

    socket.on('disconnect', () => setIsConnected(false))
    socket.on('room-not-found', () => setRoomNotFound(true))
    socket.on('presenter-left', () => setPresenterLeft(true))
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

  const navigateToSlide = (slide) => {
    socketRef.current?.emit('control-navigate', {
      slideIndex: slide.slideIndex,
      verticalIndex: slide.verticalIndex || 0,
      fragmentIndex: 0,
    })
  }

  return (
    <div className="w-screen h-screen bg-surface-0 text-text-primary grid grid-rows-[auto_1fr_auto] font-sans overflow-hidden">
      <div className="px-4 py-2 flex justify-between items-center border-b border-border-strong bg-surface-1">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="bg-transparent border-none text-slate-400 cursor-pointer flex items-center gap-1 text-[13px] hover:text-white transition-colors"
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

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-px overflow-hidden">
        <div className="p-4 grid grid-rows-[minmax(0,1fr)_140px] gap-3 min-h-0">
          <PreviewFrame htmlContent={htmlContent} state={liveState} title="Current Slide" />
          <PreviewFrame htmlContent={htmlContent} state={nextState} title="Next Slide" />
        </div>

        <div className="p-4 border-l border-border-strong flex flex-col overflow-hidden">
          <h4 className="label-caps m-0 mb-3">Speaker Notes</h4>
          <div className="flex-1 overflow-y-auto text-base leading-[1.8] text-text-primary whitespace-pre-wrap">
            {currentSlide?.notes || 'No speaker notes for this slide.'}
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-border-strong bg-surface-1 flex gap-1 overflow-x-auto">
        {flatSlides.map((slide) => {
          const active =
            slide.slideIndex === liveState.slideIndex && slide.verticalIndex === liveState.verticalIndex
          return (
            <button
              key={`${slide.slideIndex}-${slide.verticalIndex}`}
              onClick={() => navigateToSlide(slide)}
              className={`min-w-12 h-8 rounded shrink-0 text-[11px] cursor-pointer px-2 ${
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

      {(presenterLeft || roomNotFound) && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center">
          <div className="text-center text-white">
            <h2>{roomNotFound ? 'Room not found' : 'Presenter has left'}</h2>
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
  )
}
