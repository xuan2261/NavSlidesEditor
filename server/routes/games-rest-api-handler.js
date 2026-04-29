/**
 * Game REST API handlers (Phase 2).
 * Endpoints: create/join game, submit answer, leaderboard, next, random, end, state.
 */
const express = require('express')
const GameEngine = require('../services/game-room-manager-singleton-service')

const router = express.Router()

// POST /api/games — create or get existing game room
router.post('/', (req, res) => {
  const { gameId, gameType, options } = req.body
  if (!gameId || !gameType) {
    return res.status(400).json({ error: 'gameId and gameType are required' })
  }
  const room = GameEngine.getRoom(gameId)
  if (room) {
    return res.json({ gameId, status: room.status, players: room.players.size })
  }
  const created = GameEngine.createRoom(gameId, gameType, options || {})
  if (!created) {
    return res.status(409).json({ error: 'Game room already exists' })
  }
  res.json({ gameId, status: created.status, players: 0 })
})

// POST /api/games/:gameId/join — join a game room
router.post('/:gameId/join', (req, res) => {
  const { gameId } = req.params
  const { socketId, playerName } = req.body
  if (!socketId || !playerName) {
    return res.status(400).json({ error: 'socketId and playerName are required' })
  }
  const result = GameEngine.joinRoom(gameId, socketId, playerName)
  if (!result.ok) {
    return res.status(404).json({ error: result.error })
  }
  res.json({ ok: true, players: result.players.size, leaderboard: result.leaderboard })
})

// POST /api/games/:gameId/answer — submit an answer
router.post('/:gameId/answer', (req, res) => {
  const { gameId } = req.params
  const { socketId, answerIndex, timeSpentMs } = req.body
  if (socketId === undefined || answerIndex === undefined || timeSpentMs === undefined) {
    return res.status(400).json({ error: 'socketId, answerIndex, and timeSpentMs are required' })
  }
  const result = GameEngine.submitAnswer(gameId, socketId, answerIndex, timeSpentMs)
  if (result === null) {
    return res.status(404).json({ error: 'Room not found or no active question' })
  }
  res.json(result)
})

// GET /api/games/:gameId/leaderboard
router.get('/:gameId/leaderboard', (req, res) => {
  const { gameId } = req.params
  const lb = GameEngine.getLeaderboard(gameId)
  if (lb === null) {
    return res.status(404).json({ error: 'room-not-found' })
  }
  res.json(lb)
})

// POST /api/games/:gameId/next — presenter advances to next question
router.post('/:gameId/next', (req, res) => {
  const { gameId } = req.params
  const room = GameEngine.nextQuestion(gameId)
  if (room === null) {
    return res.status(404).json({ error: 'room-not-found' })
  }
  const question = room.questions[room.currentQuestion] || null
  res.json({ currentQuestion: room.currentQuestion, question })
})

// POST /api/games/:gameId/random — trigger random picker (name-picker game)
router.post('/:gameId/random', (req, res) => {
  const { gameId } = req.params
  const result = GameEngine.triggerRandom(gameId)
  if (result === null) {
    return res.status(404).json({ error: 'room-not-found' })
  }
  res.json({ winnerIndex: result })
})

// POST /api/games/:gameId/end — end the game
router.post('/:gameId/end', (req, res) => {
  const { gameId } = req.params
  const room = GameEngine.endGame(gameId)
  if (room === null) {
    return res.status(404).json({ error: 'room-not-found' })
  }
  const leaderboard = GameEngine.getLeaderboard(gameId)
  res.json({ status: room.status, leaderboard })
})

// DELETE /api/games/:gameId — cleanup game session
router.delete('/:gameId', (req, res) => {
  const { gameId } = req.params
  GameEngine.cleanup(gameId)
  res.json({ deleted: true })
})

// GET /api/games/:gameId/state — get current game state
router.get('/:gameId/state', (req, res) => {
  const { gameId } = req.params
  const room = GameEngine.getRoom(gameId)
  if (!room) {
    return res.status(404).json({ error: 'room-not-found' })
  }
  res.json({
    gameId: room.gameId,
    gameType: room.gameType,
    status: room.status,
    players: room.players.size,
    currentQuestion: room.currentQuestion,
    createdAt: room.createdAt,
  })
})

module.exports = router
