/**
 * Socket.IO hook for game element interactions.
 * Players join a game room and receive real-time game events.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

export function useGameSocket(gameId, playerName, role = 'player') {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [joinError, setJoinError] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [players, setPlayers] = useState([])
  const [lastEvent, setLastEvent] = useState(null)

  const socketRef = useRef(null)

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data)
  }, [])

  useEffect(() => {
    if (!gameId || !playerName) return
    let cancelled = false

    const sock = io({ path: '/ws', reconnection: true })

    sock.on('connect', () => {
      if (cancelled) { sock.disconnect(); return }
      setIsConnected(true)
      setJoinError(null)
      sock.emit('game-join', {
        roomId: gameId,
        playerName,
        role,
      })
    })

    sock.on('connect_error', (err) => {
      if (cancelled) return
      setJoinError(err.message || 'Connection failed')
    })

    sock.on('disconnect', () => {
      if (cancelled) return
      setIsConnected(false)
    })

    sock.on('game-player-joined', ({ players: p }) => {
      if (cancelled) return
      setPlayers(p || [])
      setLastEvent({ type: 'player-joined', players: p })
    })

    sock.on('game-answer-result', (data) => {
      if (cancelled) return
      setLastEvent({ type: 'answer-result', ...data })
    })

    sock.on('game-random-result', (data) => {
      if (cancelled) return
      setLastEvent({ type: 'random-result', ...data })
    })

    sock.on('game-leaderboard', ({ scores }) => {
      if (cancelled) return
      setLeaderboard(scores || [])
      setLastEvent({ type: 'leaderboard', scores })
    })

    sock.on('game-question', (data) => {
      if (cancelled) return
      setGameState(data)
      setLastEvent({ type: 'question', ...data })
    })

    sock.on('game-ended', (data) => {
      if (cancelled) return
      setGameState(null)
      setLastEvent({ type: 'game-ended', ...data })
    })

    sock.on('game-error', ({ message }) => {
      if (cancelled) return
      setJoinError(message)
      setLastEvent({ type: 'error', message })
    })

    socketRef.current = sock
    setSocket(sock)

    return () => {
      cancelled = true
      sock.disconnect()
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
    }
  }, [gameId, playerName, role])

  return {
    socket,
    isConnected,
    joinError,
    gameState,
    leaderboard,
    players,
    lastEvent,
    emit,
  }
}
