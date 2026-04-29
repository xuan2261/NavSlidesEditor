/**
 * useGamePlayer — Socket.IO hook for game player (HS) side.
 * Manages player join, answer submission, timer, and real-time game state.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

export function useGamePlayer({ gameId, playerName }) {
  const [status, setStatus] = useState('joining') // joining | waiting | question | answered | result | finished
  const [players, setPlayers] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [answerResult, setAnswerResult] = useState(null)
  const [myScore, setMyScore] = useState(0)
  const [myRank, setMyRank] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)

  const socketRef = useRef(null)
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
      roomId: gameId,
      answer: answerIndex,
      timeSpent: Math.round(timeSpent),
    })
    setSelectedAnswer(answerIndex)
    setStatus('answered')
    stopTimer()
  }, [gameId, status, stopTimer])

  useEffect(() => {
    if (!gameId || !playerName) return
    let cancelled = false

    const sock = io({ path: '/ws', reconnection: true })

    sock.on('connect', () => {
      if (cancelled) { sock.disconnect(); return }
      setIsConnected(true)
      setError(null)
      sock.emit('game-join', {
        roomId: gameId,
        playerName,
        role: 'player',
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
      if (playerName) {
        const me = (scores || []).find(p => p.name === playerName)
        if (me) setMyRank(scores.indexOf(me) + 1)
      }
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
    timeLeft,
    selectedAnswer,
    answerResult,
    submitAnswer,
    myScore,
    myRank,
    leaderboard,
  }
}
