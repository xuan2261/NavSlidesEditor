import { useCallback, useEffect, useRef, useState } from 'react'
import { createLivePlayerClock } from 'revealjs-shared'
import { useGameSocket } from './use-game-socket.js'
export function useGamePlayer({ gameId, playerName }) {
  const game = useGameSocket(gameId, playerName, 'player'),
    state = game.snapshot
  const [timeLeft, setTimeLeft] = useState(null)
  const countdown = useRef(null)
  if (!countdown.current) countdown.current = createLivePlayerClock()
  useEffect(() => {
    countdown.current.hydrate(state)
    const update = () => setTimeLeft(countdown.current.seconds())
    update()
    const timer = setInterval(update, 250)
    return () => clearInterval(timer)
  }, [
    state.roomInstanceId,
    state.generation,
    state.roundId,
    state.deadlineRevision,
    state.timeRemainingMs,
  ])
  const submitAnswer = useCallback(
    (answer) => {
      const snapshot = game.connection?.getSnapshot()
      if (!snapshot?.question) return false
      const typed = typeof answer === 'string' ? { optionId: answer } : answer
      game.connection.setDraft({ questionId: snapshot.question.id, answer: typed })
      return game.emit('game-answer', { questionId: snapshot.question.id, answer: typed })
    },
    [game.connection, game.emit]
  )
  const submitPollVote = useCallback(
    (optionId) => game.emit('game-poll-submit', { optionId }),
    [game.emit]
  )
  const submitWordCloudText = useCallback(
    (text) => game.emit('game-word-cloud-submit', { text }),
    [game.emit]
  )
  const submitMatchingPairs = useCallback(
    (pairs) => game.emit('game-matching-submit', { pairs }),
    [game.emit]
  )
  const own = state.ownSubmission,
    answerResult = state.receipt?.result || own?.result || null
  const me = state.leaderboard.find((row) => row.playerId === state.playerId)
  const finished = ['finished', 'ended', 'complete'].includes(state.phase)
  const status = !state.hydrated
    ? state.phase === 'joining'
      ? 'joining'
      : 'waiting'
    : finished
      ? 'finished'
      : state.poll
        ? 'poll'
        : state.wordCloud
          ? 'word-cloud'
          : state.matching
            ? 'matching'
            : state.pending
              ? 'answered'
              : answerResult
                ? 'result'
                : state.question
                  ? 'question'
                  : 'waiting'
  return {
    ...game,
    status,
    error: state.error,
    playerId: state.playerId,
    playerCount: state.players.length,
    currentQuestion: state.question || null,
    pollState: state.poll || null,
    wordCloudState: state.wordCloud || null,
    matchingState: state.matching || null,
    timeLeft,
    selectedAnswer: state.draft?.answer || own?.answer || null,
    answerResult,
    selectedPollOption: own?.optionId || null,
    wordCloudSubmissionCount: own?.count || 0,
    matchingResult: state.matching ? own || null : null,
    myScore: me?.score || 0,
    myRank: me ? state.leaderboard.indexOf(me) + 1 : null,
    submitAnswer,
    submitPollVote,
    submitWordCloudText,
    submitMatchingPairs,
  }
}
