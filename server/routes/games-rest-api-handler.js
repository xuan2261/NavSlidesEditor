/**
 * Game REST API handlers (Phase 2).
 * Endpoints: create/join game, submit answer, leaderboard, next, random, end, state.
 */
const express = require('express')
const GameEngine = require('../services/game-room-manager-singleton-service')

const router = express.Router()

function getSessionActor(body = {}) {
  const { socketId, playerId = socketId, sessionToken, hostCapability } = body
  return { socketId, playerId, sessionToken, hostCapability }
}

function requireHost(req, res, gameId) {
  const { socketId, playerId, sessionToken, hostCapability } = getSessionActor(req.body)
  if (
    !socketId ||
    !playerId ||
    !sessionToken ||
    !hostCapability ||
    !GameEngine.isHost(gameId, playerId, socketId, sessionToken, hostCapability)
  ) {
    res.status(403).json({ error: 'host authorization required' })
    return null
  }
  return { socketId, playerId, sessionToken }
}

// POST /api/games — intentional local single-user bootstrap boundary.
// Multi-user or internet-facing deployments must add external authentication
// before exposing this router; host/player mutations remain capability/session guarded.
router.post('/', (req, res) => {
  const { gameId, gameType, options } = req.body
  if (!gameId || !gameType) {
    return res.status(400).json({ error: 'gameId and gameType are required' })
  }
  const room = GameEngine.getRoom(gameId)
  if (room) {
    const response = { gameId, status: room.status, players: room.players.size }
    const pendingCapability = GameEngine.peekHostCapability(gameId)
    if (pendingCapability) response.hostCapability = pendingCapability
    return res.json(response)
  }
  const created = GameEngine.createRoom(gameId, gameType, options || {})
  if (!created) {
    return res.status(409).json({ error: 'Game room already exists' })
  }
  res.json({
    gameId,
    status: created.status,
    players: 0,
    hostCapability: GameEngine.peekHostCapability(gameId),
  })
})

// POST /api/games/:gameId/join — join a game room
router.post('/:gameId/join', (req, res) => {
  const { gameId } = req.params
  const {
    socketId,
    playerId,
    playerName,
    role,
    sessionToken,
    hostCapability,
  } = req.body
  if (role === 'observer') {
    const observed = GameEngine.observeRoom(gameId)
    if (!observed.ok) return res.status(404).json({ error: observed.error })
    return res.json({
      ok: true,
      role: 'observer',
      players: observed.players.size,
      leaderboard: observed.leaderboard,
    })
  }
  const effectivePlayerId = playerId || socketId
  if (!socketId || !effectivePlayerId || !playerName) {
    return res.status(400).json({ error: 'socketId, playerId, and playerName are required' })
  }
  const result = GameEngine.joinRoom(gameId, effectivePlayerId, playerName, {
    socketId,
    role,
    sessionToken,
    hostCapability,
    requireSession: true,
  })
  if (!result.ok) {
    const status = ['invalid-player-session', 'invalid-host-capability'].includes(result.error)
      ? 403
      : 404
    return res.status(status).json({ error: result.error })
  }
  res.json({
    ok: true,
    playerId: effectivePlayerId,
    sessionToken: result.sessionToken,
    players: result.players.size,
    leaderboard: result.leaderboard,
  })
})

// POST /api/games/:gameId/answer — submit an answer
router.post('/:gameId/answer', (req, res) => {
  const { gameId } = req.params
  const { socketId, playerId, sessionToken, answerIndex, timeSpentMs } = req.body
  const effectivePlayerId = playerId || socketId
  if (
    !socketId ||
    !effectivePlayerId ||
    !sessionToken ||
    answerIndex === undefined ||
    timeSpentMs === undefined
  ) {
    return res.status(400).json({ error: 'socketId, playerId, sessionToken, answerIndex, and timeSpentMs are required' })
  }
  const result = GameEngine.submitAnswer(
    gameId,
    effectivePlayerId,
    answerIndex,
    timeSpentMs,
    { socketId, sessionToken, requireSession: true }
  )
  if (result === null) {
    return res.status(404).json({ error: 'Room not found or no active question' })
  }
  if (result.error) return res.status(403).json(result)
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
  if (!requireHost(req, res, gameId)) return
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
  if (!requireHost(req, res, gameId)) return
  const result = GameEngine.triggerRandom(gameId)
  if (result === null) {
    return res.status(404).json({ error: 'room-not-found' })
  }
  res.json({ winnerIndex: result })
})

// POST /api/games/:gameId/end — end the game
router.post('/:gameId/end', (req, res) => {
  const { gameId } = req.params
  if (!requireHost(req, res, gameId)) return
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
  if (!requireHost(req, res, gameId)) return
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
