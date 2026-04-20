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
    timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000)
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

    return () => { socket.disconnect() }
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

  const btnStyle = {
    padding: '20px 32px', borderRadius: 12, fontSize: 18, fontWeight: 600,
    border: '2px solid var(--border)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--bg-card)', color: 'var(--text)',
    touchAction: 'manipulation', userSelect: 'none',
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary, #0f172a)', color: 'var(--text, #e2e8f0)',
      display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid var(--border, #334155)',
      }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Home size={16} /> Exit
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? '#22c55e' : '#ef4444' }} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} /> {viewersCount}</span>
        </div>
      </div>

      {/* Speaker Notes */}
      <div style={{
        flex: 1, padding: 16, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          background: 'var(--bg-card, #1e293b)', borderRadius: 12, padding: 16,
          flex: 1, minHeight: 100,
        }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Speaker Notes</h4>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
            {speakerNotes || 'No speaker notes for this slide.'}
          </p>
        </div>
      </div>

      {/* Slide counter */}
      <div style={{
        textAlign: 'center', padding: '8px 16px', fontSize: 20, fontWeight: 700,
        color: 'var(--text)', borderTop: '1px solid var(--border, #334155)',
      }}>
        Slide {slideIndex + 1}
      </div>

      {/* Navigation */}
      <div style={{ padding: '12px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={goPrev} style={{ ...btnStyle, flex: 1 }}>
            <ChevronLeft size={24} /> Prev
          </button>
          <button onClick={goNext} style={{ ...btnStyle, flex: 1, background: 'var(--accent, #6366f1)', color: '#fff', border: 'none' }}>
            Next <ChevronRight size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={toggleLaser}
            style={{
              ...btnStyle, flex: 1, fontSize: 14, padding: '12px 16px',
              background: laserActive ? 'rgba(239,68,68,0.2)' : 'var(--bg-card)',
              borderColor: laserActive ? '#ef4444' : 'var(--border)',
              color: laserActive ? '#ef4444' : 'var(--text)',
            }}
          >
            <Pointer size={16} /> Laser
          </button>
          <div style={{
            ...btnStyle, flex: 1, fontSize: 14, padding: '12px 16px',
            cursor: 'default', justifyContent: 'center',
          }}>
            <Clock size={16} /> {formatTime(elapsedTime)}
          </div>
        </div>
      </div>

      {presenterLeft && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <h2>Session Ended</h2>
            <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: 12 }}>Go Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
