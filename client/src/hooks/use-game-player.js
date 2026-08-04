/**
 * useGamePlayer — Socket.IO hook for game player (HS) side.
 * Manages player join, answer submission, timer, and real-time game state.
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
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(getSessionStorageKey(gameId, playerId))
}

function storeSessionToken(gameId, playerId, sessionToken) {
  if (typeof localStorage === 'undefined' || !sessionToken) return
  localStorage.setItem(getSessionStorageKey(gameId, playerId), sessionToken)
}

export function useGamePlayer({ gameId, playerName }) {
  const [status, setStatus] = useState('joining') // joining | waiting | question | answered | result | finished
  const [players, setPlayers] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [pollState, setPollState] = useState(null)
  const [selectedPollOption, setSelectedPollOption] = useState(null)
  const [wordCloudState, setWordCloudState] = useState(null)
  const [wordCloudSubmissionCount, setWordCloudSubmissionCount] = useState(0)
  const [matchingState, setMatchingState] = useState(null)
  const [matchingResult, setMatchingResult] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [answerResult, setAnswerResult] = useState(null)
  const [myScore, setMyScore] = useState(0)
  const [myRank, setMyRank] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [playerIdentity] = useState(() => getPlayerId())
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)

  const socketRef = useRef(null)
  const playerIdRef = useRef(playerIdentity)
  const timerRef = useRef(null)
  const questionStartRef = useRef(null)

  const startTimer = useCallback((timeLimit) => {
    if (timerRef.current) clearInterval(timerRef.current)
    questionStartRef.current = Date.now()
    setTimeLeft(timeLimit)
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - questionStartRef.current) / 1000
      const left = Math.max(0, Math.ceil(timeLimit - elapsed))
      setTimeLeft(left)
      if (left <= 0) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }, 500)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const submitAnswer = useCallback((answerIndex) => {
    if (!socketRef.current || status !== 'question') return
    const timeSpent = questionStartRef.current ? (Date.now() - questionStartRef.current) / 1000 : 0
    socketRef.current.emit('game-answer', {
      gameId,
      answerIndex,
      timeSpentMs: Math.round(timeSpent * 1000),
    })
    setSelectedAnswer(answerIndex)
    setStatus('answered')
    stopTimer()
  }, [gameId, status, stopTimer])

  const submitPollVote = useCallback((optionId) => {
    if (!socketRef.current || status !== 'poll') return
    socketRef.current.emit('game-poll-submit', { gameId, optionId })
    setSelectedPollOption(optionId)
  }, [gameId, status])

  const submitWordCloudText = useCallback((text) => {
    if (!socketRef.current || status !== 'word-cloud') return
    socketRef.current.emit('game-word-cloud-submit', { gameId, text })
  }, [gameId, status])

  const submitMatchingPairs = useCallback((pairs) => {
    if (!socketRef.current || status !== 'matching') return
    socketRef.current.emit('game-matching-submit', { gameId, pairs })
  }, [gameId, status])

  useEffect(() => {
    if (!gameId || !playerName) return
    let cancelled = false

    // Player-game traffic lives on the '/games' namespace (the live default
    // namespace is reserved for EditorPage game-timer events).
    const playerId = playerIdRef.current
    let sessionToken = getStoredSessionToken(gameId, playerId)
    const sock = io('/games', { path: '/ws', reconnection: true })

    sock.on('connect', () => {
      if (cancelled) { sock.disconnect(); return }
      setIsConnected(true)
      setError(null)
      sock.emit('game-join', {
        gameId,
        playerName,
        playerId,
        role: 'player',
        ...(sessionToken ? { sessionToken } : {}),
      })
      setStatus('waiting')
    })

    sock.on('connect_error', (err) => {
      if (cancelled) return
      setError(err.message || 'Connection failed')
      setStatus('joining')
    })

    sock.on('disconnect', () => {
      if (cancelled) return
      setIsConnected(false)
      stopTimer()
    })

    sock.on('game-room-expired', () => {
      if (cancelled) return
      setIsConnected(false)
      setError('Game room expired. Reload to rejoin.')
      setStatus('joining')
      stopTimer()
      sock.disconnect()
    })

    sock.on('game-session', (data = {}) => {
      if (cancelled) return
      const { playerId: issuedPlayerId, sessionToken: issuedSessionToken } = data
      if (issuedPlayerId !== playerId || typeof issuedSessionToken !== 'string') return
      sessionToken = issuedSessionToken
      storeSessionToken(gameId, playerId, issuedSessionToken)
    })

    sock.on('game-player-joined', ({ players: p }) => {
      if (cancelled) return
      setPlayers(p || [])
    })

    sock.on('game-question', (data) => {
      if (cancelled) return
      setCurrentQuestion(data)
      setSelectedAnswer(null)
      setAnswerResult(null)
      setStatus('question')
      startTimer(data.timeLimit || 30)
    })

    sock.on('game-poll-started', (data) => {
      if (cancelled) return
      setPollState(data)
      setSelectedPollOption(null)
      setStatus('poll')
    })

    sock.on('game-poll-results', (data) => {
      if (cancelled) return
      setPollState(data)
      setStatus('poll')
    })

    sock.on('game-poll-vote-accepted', ({ optionId }) => {
      if (cancelled) return
      setSelectedPollOption(optionId)
    })

    sock.on('game-word-cloud-started', (data) => {
      if (cancelled) return
      setWordCloudState(data)
      setWordCloudSubmissionCount(0)
      setStatus('word-cloud')
    })

    sock.on('game-word-cloud-results', (data) => {
      if (cancelled) return
      setWordCloudState(data)
      setStatus('word-cloud')
    })

    sock.on('game-word-cloud-submit-accepted', () => {
      if (cancelled) return
      setWordCloudSubmissionCount((count) => count + 1)
    })

    sock.on('game-matching-started', (data) => {
      if (cancelled) return
      setMatchingState(data)
      setMatchingResult(null)
      setStatus('matching')
    })

    sock.on('game-matching-results', (data) => {
      if (cancelled) return
      setMatchingState(data)
      setStatus('matching')
    })

    sock.on('game-matching-submit-accepted', (data) => {
      if (cancelled) return
      setMatchingResult(data)
    })

    sock.on('game-answer-result', (data) => {
      if (cancelled) return
      const { correct, points, totalScore, rank } = data
      setAnswerResult({ correct, points })
      setMyScore(totalScore ?? 0)
      setMyRank(rank ?? null)
      setStatus('result')
    })

    sock.on('game-leaderboard', ({ scores }) => {
      if (cancelled) return
      setLeaderboard(scores || [])
      const me = (scores || []).find((entry) => entry.playerId === playerIdRef.current)
      if (me) setMyRank(scores.indexOf(me) + 1)
    })

    sock.on('game-ended', ({ finalScores }) => {
      if (cancelled) return
      setLeaderboard(finalScores || [])
      setStatus('finished')
      setCurrentQuestion(null)
      stopTimer()
    })

    sock.on('game-error', ({ message }) => {
      if (cancelled) return
      setError(message)
    })

    socketRef.current = sock

    return () => {
      cancelled = true
      stopTimer()
      sock.disconnect()
      socketRef.current = null
    }
  }, [gameId, playerName, startTimer, stopTimer])

  return {
    isConnected,
    error,
    status,
    players,
    playerCount: players.length,
    currentQuestion,
    pollState,
    wordCloudState,
    matchingState,
    timeLeft,
    selectedAnswer,
    answerResult,
    submitAnswer,
    submitPollVote,
    submitWordCloudText,
    submitMatchingPairs,
    selectedPollOption,
    wordCloudSubmissionCount,
    matchingResult,
    myScore,
    myRank,
    leaderboard,
    playerId: playerIdentity,
  }
}
