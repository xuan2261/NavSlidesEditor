import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

export function useLivePresentation(presentationId, role = 'viewer', roomCode = null) {
  const [socket, setSocket] = useState(null)
  const [code, setCode] = useState(roomCode)
  const [isConnected, setIsConnected] = useState(false)
  const [viewersCount, setViewersCount] = useState(0)

  useEffect(() => {
    let activeSocket = null

    const setupSocket = async () => {
      // If presenter, generate a room code first
      let currentCode = code
      if (role === 'presenter' && !currentCode) {
        try {
          const res = await fetch('/api/live/room', { method: 'POST' })
          const data = await res.json()
          currentCode = data.roomCode
          setCode(currentCode)
        } catch (err) {
          console.error('Failed to create live room', err)
          return
        }
      }

      if (!currentCode) return

      activeSocket = io({ path: '/ws' })

      activeSocket.on('connect', () => {
        setIsConnected(true)
        activeSocket.emit('join-room', {
          roomId: currentCode,
          role,
          presentationId: role === 'presenter' ? presentationId : undefined,
        })
      })

      activeSocket.on('disconnect', () => {
        setIsConnected(false)
      })

      activeSocket.on('viewer-count', ({ count }) => {
        setViewersCount(count)
      })

      setSocket(activeSocket)
    }

    setupSocket()

    return () => {
      if (activeSocket) {
        activeSocket.disconnect()
      }
    }
  }, [presentationId, role, code]) // only re-run if these change

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

  return { code, navigate, socket, isConnected, viewersCount, syncCursor }
}
