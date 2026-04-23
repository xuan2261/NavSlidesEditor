import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useRevealPreviewFrame } from '../hooks/use-reveal-preview-frame'

export default function LiveViewPage() {
  const { roomCode } = useParams()

  const [isConnected, setIsConnected] = useState(false)
  const [presenterLeft, setPresenterLeft] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')
  const [liveState, setLiveState] = useState({ slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 })
  const [cursorPos, setCursorPos] = useState(null)
  const [laserPos, setLaserPos] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [viewerCount, setViewerCount] = useState(0)
  const [roomNotFound, setRoomNotFound] = useState(false)
  const { iframeRef } = useRevealPreviewFrame(htmlContent, liveState)

  // 1. Socket.IO connection
  useEffect(() => {
    const socket = io({ path: '/ws' })

    socket.on('connect', () => {
      setIsConnected(true)
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

    socket.on('annotation', ({ type, data }) => {
      if (type === 'clear') {
        setAnnotations([])
      } else if (type === 'path') {
        setAnnotations((prev) => [...prev, data])
      }
    })

    socket.on('presenter-left', () => setPresenterLeft(true))
    socket.on('viewer-count', ({ count }) => setViewerCount(count))
    socket.on('room-not-found', () => setRoomNotFound(true))

    // When we receive presentation data (HTML), render it
    socket.on('presentation-data', (data) => {
      if (data.html) setHtmlContent(data.html)
    })

    // Check if the room exists
    const checkRoom = async () => {
      try {
        const roomRes = await fetch(`/api/live/room/${roomCode}`)
        const roomData = await roomRes.json()
        if (!roomData.exists) {
          setRoomNotFound(true)
        }
      } catch (err) {
        console.error('Failed to check room', err)
      }
    }
    checkRoom()

    return () => {
      socket.disconnect()
    }
  }, [roomCode])

  if (roomNotFound && !htmlContent) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-black text-white font-sans">
        <div className="text-center">
          <h2 className="text-2xl mb-2">Room not found</h2>
          <p className="text-text-secondary mb-4">
            This live session does not exist or has ended.
          </p>
          <a href="/" className="text-primary text-sm">
            ← Back to Home
          </a>
        </div>
      </div>
    )
  }

  return (
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

      {/* Annotation overlay — KEEP inline: dynamic SVG paths */}
      {annotations.length > 0 && (
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
          {annotations.map((a, i) => (
            <path
              key={i}
              d={a.d}
              stroke={a.stroke || '#ff0000'}
              strokeWidth={a.strokeWidth || 3}
              fill="none"
            />
          ))}
        </svg>
      )}

      {/* Presentation iframe — renders the full presentation HTML with all resources */}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-none block"
        title="Live Presentation"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
