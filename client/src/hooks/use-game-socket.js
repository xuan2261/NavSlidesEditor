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

function getSessionStorageKey(gameId, playerId) {
  return `navslides-game-session:${gameId}:${playerId}`
}

function getStoredSessionToken(gameId, playerId) {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(getSessionStorageKey(gameId, playerId))
}

function storeSessionToken(gameId, playerId, sessionToken) {
  if (typeof sessionStorage === 'undefined' || !sessionToken) return
  sessionStorage.setItem(getSessionStorageKey(gameId, playerId), sessionToken)
}

function getHostCapabilityStorageKey(gameId) {
  return `navslides-game-host:${gameId}`
}

function getStoredHostCapability(gameId) {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(getHostCapabilityStorageKey(gameId))
}

function storeHostCapability(gameId, hostCapability) {
  if (typeof sessionStorage === 'undefined' || !hostCapability) return
  sessionStorage.setItem(getHostCapabilityStorageKey(gameId), hostCapability)
}

const DEFAULT_ROOM_NOT_FOUND_RETRIES = 5
const DEFAULT_HOST_BOOTSTRAP_RETRIES = 3
const hostBootstrapRequests = new Map()

function requestHostBootstrap(
  gameId,
  gameType,
  options,
  hostCapability,
  maxRetries = DEFAULT_HOST_BOOTSTRAP_RETRIES,
) {
  const inFlight = hostBootstrapRequests.get(gameId)
  if (inFlight) return inFlight

  const request = (async () => {
    let lastError
    const attempts = Math.max(0, Math.floor(Number(maxRetries) || 0)) + 1
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch('/api/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId,
            gameType,
            options: options || {},
            ...(hostCapability ? { hostCapability } : {}),
          }),
        })
        if (!response.ok) throw new Error('host-room-create-failed')
        return await response.json()
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('host-room-create-failed')
  })()

  hostBootstrapRequests.set(gameId, request)
  request.then(
    () => { if (hostBootstrapRequests.get(gameId) === request) hostBootstrapRequests.delete(gameId) },
    () => { if (hostBootstrapRequests.get(gameId) === request) hostBootstrapRequests.delete(gameId) },
  )
  return request
}

function normalizeRetryLimit(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : DEFAULT_ROOM_NOT_FOUND_RETRIES
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
  const playerIdRef = useRef(null)

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data)
  }, [])

  useEffect(() => {
    if (!gameId || !playerName) return
    let cancelled = false
    let retryTimer = null
    let roomNotFoundRetries = 0
    const {
      retryOnRoomNotFound = false,
      maxRoomNotFoundRetries = DEFAULT_ROOM_NOT_FOUND_RETRIES,
      maxHostBootstrapRetries = DEFAULT_HOST_BOOTSTRAP_RETRIES,
      hostCapability: providedHostCapability,
      ...joinOptions
    } = gameOptions || {}
    const retryLimit = normalizeRetryLimit(maxRoomNotFoundRetries)
    const playerId = playerIdRef.current || getPlayerId()
    playerIdRef.current = playerId
    let sessionToken = role === 'observer' ? null : getStoredSessionToken(gameId, playerId)
    let hostCapability = role === 'host'
      ? providedHostCapability || getStoredHostCapability(gameId)
      : null
    if (hostCapability) storeHostCapability(gameId, hostCapability)

    const bootstrapHost = async () => {
      if (role !== 'host' || !joinOptions.gameType || typeof fetch !== 'function') return true
      const result = await requestHostBootstrap(
        gameId,
        joinOptions.gameType,
        joinOptions.options,
        hostCapability,
        maxHostBootstrapRetries,
      )
      if (typeof result.hostCapability === 'string' && result.hostCapability) {
        hostCapability = result.hostCapability
        storeHostCapability(gameId, hostCapability)
        return true
      }
      // A valid stored capability remains usable when the room is already
      // claimed and the idempotent create response has no pending secret.
      if (hostCapability) return true
      throw new Error('host-capability-required')
    }
    const needsHostBootstrap = role === 'host' && Boolean(joinOptions.gameType) && typeof fetch === 'function'
    const hostReady = needsHostBootstrap
      ? bootstrapHost().catch((error) => {
          if (!cancelled) setJoinError(error.message)
          return false
        })
      : null

    // Player-game traffic lives on the '/games' namespace (the live default
    // namespace is reserved for EditorPage game-timer events).
    const sock = io('/games', { path: '/ws', reconnection: true })
    const joinGame = (refreshHostRoom = false) => {
      const emitJoin = (ready) => {
        if (cancelled || ready === false) return
        sock.emit('game-join', {
          gameId,
          playerName,
          playerId,
          role,
          ...joinOptions,
          ...(sessionToken ? { sessionToken } : {}),
          ...(hostCapability ? { hostCapability } : {}),
        })
      }
      if (refreshHostRoom && needsHostBootstrap) {
        bootstrapHost().then(emitJoin).catch((error) => {
          if (!cancelled) setJoinError(error.message)
        })
        return
      }
      if (!hostReady) {
        emitJoin(true)
        return
      }
      hostReady.then(emitJoin)
    }

    let hasConnected = false
    let joined = false
    sock.on('connect', () => {
      if (cancelled) { sock.disconnect(); return }
      joined = false
      setIsConnected(false)
      if (!needsHostBootstrap) setJoinError(null)
      joinGame(hasConnected)
      hasConnected = true
    })

    sock.on('connect_error', (err) => {
      if (cancelled) return
      setJoinError(err.message || 'Connection failed')
    })

    sock.on('disconnect', () => {
      if (cancelled) return
      joined = false
      setIsConnected(false)
    })

    sock.on('game-session', (data = {}) => {
      if (cancelled || role === 'observer') return
      const { playerId: issuedPlayerId, sessionToken: issuedSessionToken } = data
      if (issuedPlayerId !== playerId || typeof issuedSessionToken !== 'string') return
      sessionToken = issuedSessionToken
      storeSessionToken(gameId, playerId, issuedSessionToken)
    })

    sock.on('game-player-joined', ({ players: p }) => {
      if (cancelled) return
      joined = true
      setIsConnected(true)
      setJoinError(null)
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
      joined = true
      setIsConnected(true)
      setJoinError(null)
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      roomNotFoundRetries = 0
      const nextScores = scores || []
      setLeaderboard(nextScores)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('navslides:game-leaderboard', {
          detail: { gameId, scores: nextScores },
        }))
      }
      setLastEvent({ type: 'leaderboard', scores: nextScores })
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

    sock.on('game-room-expired', ({ gameId: expiredGameId } = {}) => {
      if (cancelled) return
      joined = false
      setIsConnected(false)
      setJoinError('room-expired')
      setLastEvent({ type: 'room-expired', gameId: expiredGameId || gameId })
      if (
        retryOnRoomNotFound &&
        roomNotFoundRetries < retryLimit &&
        !retryTimer
      ) {
        roomNotFoundRetries += 1
        retryTimer = setTimeout(() => {
          retryTimer = null
          if (!cancelled && sock.connected) joinGame(needsHostBootstrap)
        }, 1000)
      }
    })

    sock.on('game-error', ({ message } = {}) => {
      if (cancelled) return
      if (!joined) setIsConnected(false)
      setJoinError(message)
      setLastEvent({ type: 'error', message })
      if (
        retryOnRoomNotFound &&
        message === 'room-not-found' &&
        roomNotFoundRetries < retryLimit &&
        !retryTimer
      ) {
        roomNotFoundRetries += 1
        retryTimer = setTimeout(() => {
          retryTimer = null
          if (!cancelled && sock.connected) joinGame(true)
        }, 1000)
      }
    })

    socketRef.current = sock
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(sock)

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
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
