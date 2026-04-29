import { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

export function useLivePresentation(
  presentationId,
  role = 'viewer',
  roomCode = null,
  presenterToken = null
) {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [viewersCount, setViewersCount] = useState(0)
  const [joinError, setJoinError] = useState(null)

  const socketRef = useRef(null)
  const presenterTokenRef = useRef(presenterToken)
  presenterTokenRef.current = presenterToken

  useEffect(() => {
    let cancelled = false

    const setupSocket = async () => {
      // If presenter, generate a room code first
      let currentCode = roomCode
      if (role === 'presenter' && !currentCode) {
        try {
          const res = await fetch('/api/live/room', { method: 'POST' })
          if (!res.ok) throw new Error('Failed to create live room')
          const data = await res.json()
          if (!data?.roomCode || !data?.presenterToken) {
            throw new Error('Invalid live room response')
          }
          currentCode = data.roomCode
        } catch (err) {
          console.error('Failed to create live room', err)
          if (cancelled) return
          setJoinError(err.message || 'Failed to create live room')
          return
        }
      }

      if (!currentCode) return

      const sock = io({ path: '/ws', reconnection: true })

      sock.on('connect_error', (err) => {
        if (cancelled) return
        setJoinError(err.message || 'Connection failed')
      })

      sock.on('connect', () => {
        if (cancelled) {
          sock.disconnect()
          return
        }
        setIsConnected(true)
        setJoinError(null)
        sock.emit('join-room', {
          roomId: currentCode,
          role,
          presentationId: role === 'presenter' ? presentationId : undefined,
          presenterToken: role === 'presenter' ? presenterTokenRef.current : undefined,
        })
      })

      sock.on('disconnect', () => {
        if (cancelled) return
        setIsConnected(false)
      })

      sock.on('viewer-count', ({ count }) => {
        if (cancelled) return
        setViewersCount(count)
      })

      sock.on('join-error', ({ message }) => {
        if (cancelled) return
        setJoinError(message || 'Failed to join live room')
      })

      if (cancelled) {
        sock.disconnect()
        return
      }
      socketRef.current = sock
      setSocket(sock)
    }

    setupSocket()

    return () => {
      cancelled = true
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [presentationId, role, roomCode])

  const navigate = (slideIndex, fragmentIndex = 0, verticalIndex = 0) => {
    if (socket && role === 'presenter' && isConnected) {
      socket.emit('navigate', { slideIndex, verticalIndex, fragmentIndex })
    }
  }

  const syncCursor = (x, y) => {
    if (socket && role === 'presenter' && isConnected) {
      socket.emit('cursor-move', { x, y })
    }
  }

  return { code: roomCode, navigate, socket, isConnected, viewersCount, syncCursor, joinError }
}
