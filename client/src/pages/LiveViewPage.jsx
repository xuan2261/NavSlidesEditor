import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { io } from 'socket.io-client'

export default function LiveViewPage() {
  const { roomCode } = useParams()
  const iframeRef = useRef(null)
  const deckRef = useRef(null)
  const socketRef = useRef(null)
  const revealCheckRef = useRef(null)

  const [isConnected, setIsConnected] = useState(false)
  const [presenterLeft, setPresenterLeft] = useState(false)
  const [htmlContent, setHtmlContent] = useState('')
  const [cursorPos, setCursorPos] = useState(null)
  const [laserPos, setLaserPos] = useState(null)
  const [annotations, setAnnotations] = useState([])
  const [viewerCount, setViewerCount] = useState(0)
  const [roomNotFound, setRoomNotFound] = useState(false)

  // 1. Socket.IO connection
  useEffect(() => {
    const socket = io({ path: '/ws' })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join-room', { roomId: roomCode, role: 'viewer' })
    })

    socket.on('disconnect', () => setIsConnected(false))

    socket.on('sync-state', (state) => {
      if (deckRef.current) {
        try { deckRef.current.slide(state.slideIndex || 0, 0, state.fragmentIndex || 0) } catch {}
      }
    })

    socket.on('navigate', ({ slideIndex, fragmentIndex }) => {
      if (deckRef.current) {
        try { deckRef.current.slide(slideIndex || 0, 0, fragmentIndex || 0) } catch {}
      }
    })

    socket.on('cursor-move', ({ x, y }) => setCursorPos({ x, y }))

    socket.on('laser', ({ x, y, active }) => {
      setLaserPos(active ? { x, y } : null)
    })

    socket.on('annotation', ({ type, data }) => {
      if (type === 'clear') {
        setAnnotations([])
      } else if (type === 'path') {
        setAnnotations(prev => [...prev, data])
      }
    })

    socket.on('presenter-left', () => setPresenterLeft(true))
    socket.on('viewer-count', ({ count }) => setViewerCount(count))

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

    return () => { socket.disconnect() }
  }, [roomCode])

  // 2. Render presentation in iframe when HTML is received
  useEffect(() => {
    if (!htmlContent || !iframeRef.current) return

    // Clear previous Reveal ref and interval
    deckRef.current = null
    if (revealCheckRef.current) {
      clearInterval(revealCheckRef.current)
      revealCheckRef.current = null
    }

    // Write the full presentation HTML into the iframe via srcdoc.
    // The generated HTML loads all resources (Reveal.js CSS/JS, KaTeX, highlight.js)
    // from /vendor/ paths which resolve correctly against the parent origin.
    // The ?live= presenter code won't activate because srcdoc has no URL params.
    iframeRef.current.srcdoc = htmlContent

    iframeRef.current.onload = () => {
      try {
        const iframeWindow = iframeRef.current?.contentWindow
        if (!iframeWindow) return

        // Poll until Reveal.js initializes inside the iframe
        revealCheckRef.current = setInterval(() => {
          try {
            const R = iframeWindow.Reveal
            if (R && typeof R.isReady === 'function' && R.isReady()) {
              clearInterval(revealCheckRef.current)
              revealCheckRef.current = null
              deckRef.current = R

              // Disable interactivity for viewers — read-only
              R.configure({
                keyboard: false,
                touch: false,
                controls: false,
                progress: true,
                overview: false,
              })

              // Hide the fullscreen button inside iframe
              try {
                const fsBtn = iframeWindow.document.getElementById('fs-btn')
                if (fsBtn) fsBtn.style.display = 'none'
              } catch {}
            }
          } catch {}
        }, 100)

        // Safety timeout: stop polling after 15s
        setTimeout(() => {
          if (revealCheckRef.current) {
            clearInterval(revealCheckRef.current)
            revealCheckRef.current = null
          }
        }, 15000)
      } catch (err) {
        console.error('Failed to access iframe Reveal', err)
      }
    }

    return () => {
      if (revealCheckRef.current) {
        clearInterval(revealCheckRef.current)
        revealCheckRef.current = null
      }
    }
  }, [htmlContent])

  if (roomNotFound && !htmlContent) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 24, marginBottom: 8 }}>Room not found</h2>
          <p style={{ color: '#94a3b8', marginBottom: 16 }}>This live session does not exist or has ended.</p>
          <a href="/" style={{ color: '#6366f1', fontSize: 14 }}>← Back to Home</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000', overflow: 'hidden' }}>
      {/* Connection status */}
      {!isConnected && (
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          background: 'rgba(239,68,68,0.9)', color: '#fff', padding: '6px 14px',
          borderRadius: 6, fontSize: 13, fontWeight: 500,
        }}>
          Connecting to live session...
        </div>
      )}

      {/* Waiting for presenter */}
      {isConnected && !htmlContent && !presenterLeft && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#000',
        }}>
          <div style={{ textAlign: 'center', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.3)',
              borderTopColor: '#6366f1', animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Waiting for presenter...</h2>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Room: {roomCode}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        </div>
      )}

      {/* Viewer count badge */}
      {isConnected && !presenterLeft && htmlContent && (
        <div style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          background: 'rgba(99,102,241,0.85)', color: '#fff', padding: '4px 12px',
          borderRadius: 20, fontSize: 12, fontWeight: 500, backdropFilter: 'blur(6px)',
        }}>
          {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
        </div>
      )}

      {presenterLeft && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)',
        }}>
          <div style={{ textAlign: 'center', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
            <h2 style={{ fontSize: 24, marginBottom: 8 }}>Presenter has left</h2>
            <p style={{ color: '#94a3b8' }}>The live session has ended.</p>
            <a href="/" style={{ color: '#6366f1', fontSize: 14 }}>← Back to Home</a>
          </div>
        </div>
      )}

      {/* Cursor dot overlay */}
      {cursorPos && (
        <div style={{
          position: 'absolute',
          left: `${cursorPos.x * 100}%`, top: `${cursorPos.y * 100}%`,
          width: 12, height: 12, borderRadius: '50%',
          background: 'rgba(99,102,241,0.8)', border: '2px solid #fff',
          pointerEvents: 'none', zIndex: 9999,
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.08s linear',
        }} />
      )}

      {/* Laser pointer overlay */}
      {laserPos && (
        <div style={{
          position: 'absolute',
          left: `${laserPos.x * 100}%`, top: `${laserPos.y * 100}%`,
          width: 20, height: 20, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,0,0,0.8), rgba(255,0,0,0) 70%)',
          pointerEvents: 'none', zIndex: 9999,
          transform: 'translate(-50%, -50%)',
          transition: 'all 0.05s linear',
          boxShadow: '0 0 20px rgba(255,0,0,0.5)',
        }} />
      )}

      {/* Annotation overlay */}
      {annotations.length > 0 && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9998 }}>
          {annotations.map((a, i) => (
            <path key={i} d={a.d} stroke={a.stroke || '#ff0000'} strokeWidth={a.strokeWidth || 3} fill="none" />
          ))}
        </svg>
      )}

      {/* Presentation iframe — renders the full presentation HTML with all resources */}
      <iframe
        ref={iframeRef}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Live Presentation"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
