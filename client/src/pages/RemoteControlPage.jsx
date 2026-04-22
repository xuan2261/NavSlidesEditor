import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { ChevronLeft, ChevronRight, Pointer, Clock, Users, Home } from 'lucide-react'

export default function RemoteControlPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const timerRef = useRef(null)

  const [isConnected, setIsConnected] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [totalSlides, setTotalSlides] = useState(0)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [speakerNotes, setSpeakerNotes] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [laserActive, setLaserActive] = useState(false)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [viewersCount, setViewersCount] = useState(0)
  const [presenterLeft, setPresenterLeft] = useState(false)

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  useEffect(() => {
    const socket = io({ path: '/ws' })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join-room', { roomId: roomCode, role: 'presenter' })
    })

    socket.on('disconnect', () => setIsConnected(false))

    socket.on('sync-state', (state) => {
      setSlideIndex(state.slideIndex || 0)
    })

    socket.on('presenter-left', () => setPresenterLeft(true))

    return () => {
      socket.disconnect()
    }
  }, [roomCode])

  const goNext = () => {
    const next = slideIndex + 1
    setSlideIndex(next)
    socketRef.current?.emit('navigate', { slideIndex: next, fragmentIndex: 0 })
  }

  const goPrev = () => {
    const prev = Math.max(0, slideIndex - 1)
    setSlideIndex(prev)
    socketRef.current?.emit('navigate', { slideIndex: prev, fragmentIndex: 0 })
  }

  const toggleLaser = () => {
    setLaserActive(!laserActive)
    socketRef.current?.emit('laser', { x: 0.5, y: 0.5, active: !laserActive })
  }

  return (
    <div className="min-h-screen bg-workspace text-text-primary flex flex-col font-[Inter,system-ui,sans-serif]">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-border">
        <button
          onClick={() => navigate('/')}
          className="bg-transparent border-none text-slate-400 cursor-pointer flex items-center gap-1 text-[13px] hover:text-white transition-colors"
        >
          <Home size={16} /> Exit
        </button>
        <div className="flex items-center gap-4 text-[13px] text-text-muted">
          <span className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`}
            />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="flex items-center gap-1">
            <Users size={14} /> {viewersCount}
          </span>
        </div>
      </div>

      {/* Speaker Notes */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
        <div className="bg-card rounded-xl p-4 flex-1 min-h-[100px]">
          <h4 className="mb-2 text-[13px] text-text-muted font-medium">
            Speaker Notes
          </h4>
          <p className="text-[15px] leading-relaxed text-text-primary whitespace-pre-wrap">
            {speakerNotes || 'No speaker notes for this slide.'}
          </p>
        </div>
      </div>

      {/* Slide counter */}
      <div className="text-center px-4 py-2 text-xl font-bold text-text-primary border-t border-border">
        Slide {slideIndex + 1}
      </div>

      {/* Navigation */}
      <div className="px-4 pt-3 pb-6 flex flex-col gap-3">
        <div className="flex gap-3">
          <button onClick={goPrev} className="flex-1 px-8 py-5 rounded-xl text-lg font-semibold border-2 border-border cursor-pointer flex items-center justify-center gap-2 bg-card text-text-primary touch-manipulation select-none hover:bg-hover transition-colors">
            <ChevronLeft size={24} /> Prev
          </button>
          <button
            onClick={goNext}
            className="flex-1 px-8 py-5 rounded-xl text-lg font-semibold border-none cursor-pointer flex items-center justify-center gap-2 bg-accent text-white touch-manipulation select-none hover:bg-accent-hover transition-colors"
          >
            Next <ChevronRight size={24} />
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={toggleLaser}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold border-2 cursor-pointer flex items-center justify-center gap-2 touch-manipulation select-none transition-colors ${laserActive ? 'bg-danger/20 border-danger text-danger' : 'bg-card border-border text-text-primary hover:bg-hover'}`}
          >
            <Pointer size={16} /> Laser
          </button>
          <div className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold border-2 border-border cursor-default flex items-center justify-center gap-2 bg-card text-text-primary touch-manipulation select-none">
            <Clock size={16} /> {formatTime(elapsedTime)}
          </div>
        </div>
      </div>

      {presenterLeft && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center">
          <div className="text-center text-white">
            <h2>Session Ended</h2>
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
