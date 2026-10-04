const {
  createQuizSession,
  reduceQuizSession,
} = require('revealjs-shared/src/education/quiz-session.js')
const { evaluateAnswer } = require('revealjs-shared/src/education/answer-evaluator.js')
const life = require('./room-lifecycle')
const { isId } = require('./room-store')
const { inspectAttempt, commitAttempt } = require('./attempt-ledger')
const { projectQuizFeedback } = require('./quiz-public-feedback')
function nextQuestion(room) {
  life.cancelRound(room)
  if (room.currentQuestion + 1 >= room.questions.length) return life.endGame(room.gameId)
  room.currentQuestion++
  room.roundId++
  room.status = 'active'
  room.phase = 'active'
  room.revealed = false
  room.attempts.clear()
  room.questionStartedAt = life.now()
  const question = room.questions[room.currentQuestion]
  for (const player of room.players.values()) {
    player.ownSubmission = null
    player.quiz = null
  }
  const deadline =
    question.timeLimit === null ? null : room.questionStartedAt + question.timeLimit * 1000
  life.armRound(room, deadline, (current) => {
    if (!current.allowLate) {
      current.phase = 'review'
      current.revealed = true
    }
  })
  return room
}
function submitQuiz(room, player, payload) {
  const question = room.questions[room.currentQuestion]
  if (!question || payload.questionId !== question.id) return { error: 'stale-question' }
  if (!isId(payload.attemptId)) return { error: 'invalid-attempt-id' }
  if (room.status !== 'active' || room.phase !== 'active') return { error: 'question-ended' }
  if (room.gameType === 'hot-potato') return submitPotato(room, player, question, payload)
  const session =
    player.quiz ||
    createQuizSession(
      { ...room.config, questions: [question], shuffleQuestions: false },
      { now: room.questionStartedAt, generation: room.generation }
    )
  const next = reduceQuizSession(session, {
    type: 'submit',
    generation: room.generation,
    now: life.now(),
    questionId: question.id,
    attemptId: payload.attemptId,
    answer: payload.answer,
  })
  const outcome = next.lastResult
  if (!outcome?.accepted) return { error: outcome?.error || 'invalid-answer' }
  if (next.attempts.length === session.attempts.length)
    return {
      duplicate: true,
      result: player.answers.find(
        (row) => row.questionId === question.id && row.attemptId === payload.attemptId
      ).publicResult,
    }
  const delta = next.score - session.score
  player.quiz = next
  player.score += delta
  const result = {
    accepted: true,
    valid: outcome.valid,
    correct: outcome.correct,
    points: outcome.pointsAwarded,
    pointsAwarded: outcome.pointsAwarded,
    totalScore: player.score,
    attemptsUsed: next.attempts.length,
    terminal: outcome.terminal,
    questionId: question.id,
    attemptId: payload.attemptId,
  }
  player.ownSubmission = {
    commandId: payload.commandId,
    questionId: question.id,
    attemptId: payload.attemptId,
    answer: structuredClone(payload.answer),
    result,
  }
  const publicResult = projectQuizFeedback(room, question, next, result).result
  player.answers.push({ questionId: question.id, ...result, publicResult })
  return { result: publicResult }
}
function submitPotato(room, player, question, payload) {
  if (
    payload.timeSpentMs !== undefined &&
    (typeof payload.timeSpentMs !== 'number' ||
      !Number.isFinite(payload.timeSpentMs) ||
      payload.timeSpentMs < 0)
  )
    return { error: 'invalid-time-spent' }
  if (
    !Number.isInteger(payload.answerIndex) ||
    payload.answerIndex < 0 ||
    payload.answerIndex >= question.options.length
  )
    return { error: 'invalid-answer' }
  const attempt = inspectAttempt(room, player.playerId, payload, payload.answerIndex)
  if (attempt.error || attempt.duplicate) return attempt
  const previous = player.answers.find((answer) => answer.questionId === question.id)
  if (previous) return { result: previous, duplicate: true }
  const elapsed = life.now() - room.questionStartedAt,
    limit = question.timeLimit * 1000
  if (!room.allowLate && room.deadlineMs !== null && life.now() >= room.deadlineMs)
    return { error: 'question-expired' }
  const answer = { optionId: question.options[payload.answerIndex].id },
    evaluated = evaluateAnswer(question, answer)
  const points = evaluated.correct
    ? question.points +
      (limit > 0 ? Math.round((Math.max(0, limit - elapsed) / limit) * question.points) : 0)
    : 0
  player.score += points
  const result = {
    accepted: true,
    valid: true,
    correct: evaluated.correct,
    selectedOptionId: answer.optionId,
    points,
    totalScore: player.score,
    questionId: question.id,
    attemptId: payload.attemptId,
    terminal: true,
  }
  commitAttempt(room, attempt, result)
  player.answers.push(result)
  player.ownSubmission = {
    commandId: payload.commandId,
    answer,
    questionId: question.id,
    attemptId: payload.attemptId,
    result,
  }
  return { result }
}
module.exports = { nextQuestion, submitQuiz }
