/**
 * Socket.IO hook for game element interactions.
 * Players join a game room and receive real-time game events.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

// Stable per-browser player identity. Survives reconnects so the server can
// keep host designation and the room reconnect-grace window valid.
function getPlayerId() {
  if (typeof localStorage === 'undefined') {
    return `p-${Math.random().toString(36).slice(2)}`
  }
  let id = localStorage.getItem('navslides-game-player-id')
  if (!id) {
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem('navslides-game-player-id', id)
  }
  return id
}

export function useGameSocket(gameId, playerName, role = 'player', gameOptions = null) {
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

    // Player-game traffic lives on the '/games' namespace (the live default
    // namespace is reserved for EditorPage game-timer events).
    const sock = io('/games', { path: '/ws', reconnection: true })

    sock.on('connect', () => {
      if (cancelled) { sock.disconnect(); return }
      setIsConnected(true)
      setJoinError(null)
      sock.emit('game-join', {
        gameId,
        playerName,
        playerId: getPlayerId(),
        role,
        ...(gameOptions || {}),
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

    sock.on('game-poll-started', (data) => {
      if (cancelled) return
      setGameState({ type: 'poll', ...data })
      setLastEvent({ type: 'poll-started', ...data })
    })

    sock.on('game-poll-results', (data) => {
      if (cancelled) return
      setGameState({ type: 'poll', ...data })
      setLastEvent({ type: 'poll-results', ...data })
    })

    sock.on('game-poll-vote-accepted', (data) => {
      if (cancelled) return
      setLastEvent({ type: 'poll-vote-accepted', ...data })
    })

    sock.on('game-word-cloud-started', (data) => {
      if (cancelled) return
      setGameState({ type: 'word-cloud', ...data })
      setLastEvent({ type: 'word-cloud-started', ...data })
    })

    sock.on('game-word-cloud-results', (data) => {
      if (cancelled) return
      setGameState({ type: 'word-cloud', ...data })
      setLastEvent({ type: 'word-cloud-results', ...data })
    })

    sock.on('game-word-cloud-submit-accepted', (data) => {
      if (cancelled) return
      setLastEvent({ type: 'word-cloud-submit-accepted', ...data })
    })

    sock.on('game-matching-started', (data) => {
      if (cancelled) return
      setGameState({ type: 'matching', ...data })
      setLastEvent({ type: 'matching-started', ...data })
    })

    sock.on('game-matching-results', (data) => {
      if (cancelled) return
      setGameState({ type: 'matching', ...data })
      setLastEvent({ type: 'matching-results', ...data })
    })

    sock.on('game-matching-submit-accepted', (data) => {
      if (cancelled) return
      setLastEvent({ type: 'matching-submit-accepted', ...data })
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(sock)

    return () => {
      cancelled = true
      sock.disconnect()
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
    }
  }, [gameId, playerName, role, gameOptions])

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
