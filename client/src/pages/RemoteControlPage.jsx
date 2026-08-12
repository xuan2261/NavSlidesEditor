import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { ChevronLeft, ChevronRight, Clock, Home, Pointer, Users } from 'lucide-react'
import { consumeLiveCapability } from '../utils/live-capability-url'
const initialState = { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 }

function findFlatSlideIndex(slides, state) {
  return (slides || []).findIndex(
    (slide) => slide.slideIndex === state.slideIndex && slide.verticalIndex === state.verticalIndex
  )
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function RemoteControlPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)

  const [isConnected, setIsConnected] = useState(false)
  const [hasPresenter, setHasPresenter] = useState(false)
  const [liveState, setLiveState] = useState(initialState)
  const [meta, setMeta] = useState({ slideCount: 0, slides: [] })
  const [elapsedTime, setElapsedTime] = useState(0)
  const [laserActive, setLaserActive] = useState(false)
  const [viewersCount, setViewersCount] = useState(0)
  const [presenterLeft, setPresenterLeft] = useState(false)
  const [presenterReconnecting, setPresenterReconnecting] = useState(false)
  const [roomNotFound, setRoomNotFound] = useState(false)
  const [roomEnded, setRoomEnded] = useState(false)
  const flatSlides = useMemo(() => meta.slides || [], [meta.slides])
  const currentFlatIndex = useMemo(
    () => findFlatSlideIndex(flatSlides, liveState),
    [flatSlides, liveState]
  )

  const currentSlide = useMemo(
    () =>
      currentFlatIndex >= 0 ? flatSlides[currentFlatIndex] : null,
    [currentFlatIndex, flatSlides]
  )

  useEffect(() => {
    const timer = setInterval(() => setElapsedTime((time) => time + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const capability = consumeLiveCapability('remote', window.location.hash)
    if (!capability) {
      queueMicrotask(() => setRoomNotFound(true))
      return undefined
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset controller state before subscribing to a new room
    setIsConnected(false)
    setHasPresenter(false)
    setLiveState(initialState)
    setMeta({ slideCount: 0, slides: [] })
    setElapsedTime(0)
    setLaserActive(false)
    setViewersCount(0)
    setPresenterLeft(false)
    setPresenterReconnecting(false)
    setRoomNotFound(false)
    setRoomEnded(false)

    const socket = io({ path: '/ws', reconnection: true })
    socketRef.current = socket
    let cancelled = false
    const isCurrentSocket = () => !cancelled && socketRef.current === socket

    socket.on('connect_error', (err) => {
      if (!isCurrentSocket()) return
      console.error('Remote control socket connection error:', err.message)
    })

    socket.on('connect', () => {
      if (!isCurrentSocket()) return
      setIsConnected(true)
      socket.emit('join-room', { roomId: roomCode, role: 'remote', capability })
    })

    socket.on('disconnect', () => {
      if (!isCurrentSocket()) return
      setIsConnected(false)
      setHasPresenter(false)
    })
    socket.on('room-not-found', () => {
      if (isCurrentSocket()) setRoomNotFound(true)
    })
    socket.on('presenter-status', ({ hasPresenter: nextHasPresenter, presenterConnected }) => {
      if (!isCurrentSocket()) return
      setHasPresenter(nextHasPresenter === true)
      setPresenterReconnecting(presenterConnected === true && nextHasPresenter === false)
    })
    socket.on('presenter-disconnected', () => {
      if (!isCurrentSocket()) return
      setHasPresenter(false)
      setPresenterReconnecting(true)
    })
    socket.on('presenter-reconnected', () => {
      if (!isCurrentSocket()) return
      setHasPresenter(true)
      setPresenterReconnecting(false)
    })
    socket.on('presenter-left', () => {
      if (!isCurrentSocket()) return
      setHasPresenter(false)
      setPresenterLeft(true)
      setPresenterReconnecting(false)
    })
    socket.on('room-ended', () => {
      if (!isCurrentSocket()) return
      setHasPresenter(false)
      setRoomEnded(true)
      setPresenterReconnecting(false)
    })
    socket.on('viewer-count', ({ count }) => {
      if (isCurrentSocket()) setViewersCount(count)
    })
    socket.on('presentation-meta', (nextMeta) => {
      if (isCurrentSocket()) setMeta(nextMeta)
    })

    const applyState = (state) => {
      if (!isCurrentSocket()) return
      setLiveState({
        slideIndex: state.slideIndex || 0,
        verticalIndex: state.verticalIndex || 0,
        fragmentIndex: state.fragmentIndex || 0,
      })
    }

    socket.on('sync-state', applyState)
    socket.on('navigate', applyState)

    return () => {
      cancelled = true
      socket.disconnect()
    }
  }, [roomCode])

  const sendNavigation = (nextState) => {
    if (!hasPresenter) return
    socketRef.current?.emit('control-navigate', {
      slideIndex: nextState.slideIndex,
      verticalIndex: nextState.verticalIndex || 0,
      fragmentIndex: nextState.fragmentIndex || 0,
    })
  }

  const getAdjacentState = (offset) => {
    if (flatSlides.length > 0) {
      const fallbackIndex = currentFlatIndex >= 0 ? currentFlatIndex : 0
      const target = flatSlides[Math.min(flatSlides.length - 1, Math.max(0, fallbackIndex + offset))]
      if (target) {
        return {
          slideIndex: target.slideIndex,
          verticalIndex: target.verticalIndex || 0,
          fragmentIndex: 0,
        }
      }
    }

    const maxIndex = Math.max(0, (meta.slideCount || 1) - 1)
    return {
      slideIndex: Math.min(maxIndex, Math.max(0, liveState.slideIndex + offset)),
      verticalIndex: 0,
      fragmentIndex: 0,
    }
  }

  const goNext = () => {
    sendNavigation(getAdjacentState(1))
  }

  const goPrev = () => {
    sendNavigation(getAdjacentState(-1))
  }

  const toggleLaser = () => {
    const next = !laserActive
    setLaserActive(next)
    socketRef.current?.emit('laser', { x: 0.5, y: 0.5, active: next })
  }

  const controlsDisabled = !isConnected || !hasPresenter || presenterReconnecting || presenterLeft || roomEnded

  return (
    <div className="min-h-screen bg-workspace text-text-primary flex flex-col font-[Inter,system-ui,sans-serif]">
      <div className="px-4 py-3 flex justify-between items-center border-b border-border">
        <button
          onClick={() => navigate('/')}
          className="bg-transparent border-none text-text-secondary cursor-pointer flex items-center gap-1 text-[13px] hover:text-text-primary transition-colors"
        >
          <Home size={16} /> Exit
        </button>
        <div className="flex items-center gap-4 text-[13px] text-text-muted">
          <span className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="flex items-center gap-1" data-testid="remote-viewer-count">
            <Users size={14} /> {viewersCount}
          </span>
        </div>
      </div>

      {presenterReconnecting && !presenterLeft && !roomEnded && (
        <div className="mx-4 mt-3 rounded-md bg-warning/90 px-3 py-2 text-center text-sm font-medium text-white">
          Presenter reconnecting...
        </div>
      )}
      {isConnected && !hasPresenter && !presenterReconnecting && !presenterLeft && !roomEnded && (
        <div className="mx-4 mt-3 rounded-md bg-card px-3 py-2 text-center text-sm text-text-muted">
          Waiting for presenter...
        </div>
      )}

      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        <div className="bg-card rounded-lg p-4 flex-1 min-h-[160px] border border-border">
          <h4 className="mb-2 text-[13px] text-text-muted font-medium">Speaker Notes</h4>
          <p className="text-[15px] leading-relaxed text-text-primary whitespace-pre-wrap">
            {currentSlide?.notes || 'No speaker notes for this slide.'}
          </p>
        </div>
      </div>

      <div className="text-center px-4 py-2 text-xl font-bold text-text-primary border-t border-border">
        Slide {currentSlide?.label || liveState.slideIndex + 1}
        {meta.slideCount > 0 ? ` / ${meta.slideCount}` : ''}
      </div>

      <div className="px-4 pt-3 pb-6 flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            onClick={goPrev}
            disabled={controlsDisabled}
            className="flex-1 px-8 py-5 rounded-lg text-lg font-semibold border-2 border-border cursor-pointer flex items-center justify-center gap-2 bg-card text-text-primary touch-manipulation select-none hover:bg-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={24} /> Prev
          </button>
          <button
            onClick={goNext}
            disabled={controlsDisabled}
            className="flex-1 px-8 py-5 rounded-lg text-lg font-semibold border-none cursor-pointer flex items-center justify-center gap-2 bg-accent text-white touch-manipulation select-none hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next <ChevronRight size={24} />
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={toggleLaser}
            disabled={controlsDisabled}
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold border-2 cursor-pointer flex items-center justify-center gap-2 touch-manipulation select-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${laserActive ? 'bg-danger/20 border-danger text-danger' : 'bg-card border-border text-text-primary hover:bg-hover'}`}
          >
            <Pointer size={16} /> Laser
          </button>
          <div className="flex-1 px-4 py-3 rounded-lg text-sm font-semibold border-2 border-border cursor-default flex items-center justify-center gap-2 bg-card text-text-primary touch-manipulation select-none">
            <Clock size={16} /> {formatTime(elapsedTime)}
          </div>
        </div>
      </div>

      {(presenterLeft || roomNotFound || roomEnded) && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center">
          <div className="text-center text-white">
            <h2>{presenterLeft ? 'Presenter has left' : roomEnded ? 'Session ended' : roomNotFound ? 'Room not found' : 'Session Ended'}</h2>
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
