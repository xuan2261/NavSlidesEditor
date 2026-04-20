import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { Home, Clock, Users, Layers } from 'lucide-react'

export default function SpeakerViewPage() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)

  const [isConnected, setIsConnected] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [totalSlides, setTotalSlides] = useState(0)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [viewersCount, setViewersCount] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [speakerNotes, setSpeakerNotes] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(t => t + 1)
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  useEffect(() => {
    const socket = io({ path: '/ws' })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join-room', { roomId: roomCode, role: 'viewer' })
    })

    socket.on('disconnect', () => setIsConnected(false))

    socket.on('sync-state', (state) => {
      setSlideIndex(state.slideIndex || 0)
    })

    // eslint-disable-next-line unused-imports/no-unused-vars
    socket.on('navigate', ({ slideIndex: si, fragmentIndex }) => {
      setSlideIndex(si || 0)
    })

    return () => { socket.disconnect() }
  }, [roomCode])

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#0a0a0f', color: '#e2e8f0',
      display: 'grid', gridTemplateRows: 'auto 1fr auto',
      fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #1e293b', background: '#0f172a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            <Home size={14} /> Exit
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
            <Layers size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Slide {slideIndex + 1}{totalSlides > 0 ? ` / ${totalSlides}` : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
            <Clock size={14} /> {formatTime(elapsedTime)}
          </span>
          <span style={{ color: '#64748b' }}>
            {currentTime.toLocaleTimeString()}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
            <Users size={14} /> {viewersCount}
          </span>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isConnected ? '#22c55e' : '#ef4444',
          }} />
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 1, overflow: 'hidden' }}>
        {/* Current slide (large) */}
        <div style={{
          padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <h4 style={{ margin: 0, fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Current Slide</h4>
          <div style={{
            flex: 1, borderRadius: 8, background: '#1e293b', border: '1px solid #334155',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#64748b', overflow: 'hidden',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 8, opacity: 0.3 }}>{slideIndex + 1}</div>
              <div style={{ fontSize: 14 }}>Slide preview</div>
            </div>
          </div>

          {/* Next slide preview */}
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Next Slide</h4>
            <div style={{
              height: 100, borderRadius: 8, background: '#1e293b', border: '1px solid #334155',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: '#475569',
            }}>
              Slide {slideIndex + 2}
            </div>
          </div>
        </div>

        {/* Speaker notes */}
        <div style={{
          padding: 16, borderLeft: '1px solid #1e293b',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Speaker Notes</h4>
          <div style={{
            flex: 1, overflowY: 'auto', fontSize: 16, lineHeight: 1.8,
            color: '#e2e8f0', whiteSpace: 'pre-wrap',
          }}>
            {speakerNotes || 'No speaker notes for this slide.'}
          </div>
        </div>
      </div>

      {/* Bottom bar — slide thumbnails */}
      <div style={{
        padding: '8px 16px', borderTop: '1px solid #1e293b', background: '#0f172a',
        display: 'flex', gap: 4, overflowX: 'auto',
      }}>
        {Array.from({ length: Math.max(totalSlides, 12) }, (_, i) => (
          <button
            key={i}
            onClick={() => {
              setSlideIndex(i)
              socketRef.current?.emit('navigate', { slideIndex: i, fragmentIndex: 0 })
            }}
            style={{
              width: 40, height: 28, borderRadius: 4, flexShrink: 0,
              border: i === slideIndex ? '2px solid #6366f1' : '1px solid #334155',
              background: i === slideIndex ? 'rgba(99,102,241,0.15)' : '#1e293b',
              color: i === slideIndex ? '#6366f1' : '#64748b',
              cursor: 'pointer', fontSize: 11, fontWeight: i === slideIndex ? 700 : 400,
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}
