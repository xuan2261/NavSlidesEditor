const express = require('express')
const engine = require('../services/game-room-manager-singleton-service')
const { envelope, validate } = require('../services/games/command-ledger')
const { getGameCapabilities } = require('revealjs-shared/src/education/game-registry.js')
const router = express.Router()
router.post('/', (req, res) => {
  const { gameId, gameType, options } = req.body || {}
  if (!gameId || !gameType || !getGameCapabilities(gameType).live)
    return res.status(400).json({ error: 'Unsupported live game or missing game ID' })
  const existing = engine.getRoom(gameId)
  // Presenter-owned authority is not part of the intentional ownerless provisioning boundary.
  if (existing?.owner) return res.status(403).json({ error: 'presenter-owned-room' })
  if (existing)
    return res.json({
      ...envelope(existing),
      status: existing.status,
      players: existing.players.size,
      ...(engine.peekHostCapability(gameId)
        ? { hostCapability: engine.peekHostCapability(gameId) }
        : {}),
    })
  try {
    const room = engine.createRoom(gameId, gameType, options === undefined ? {} : options)
    if (!room) return res.status(409).json({ error: 'room-exists' })
    return res.json({
      ...envelope(room),
      status: room.status,
      players: 0,
      hostCapability: engine.peekHostCapability(gameId),
    })
  } catch (error) {
    return res.status(400).json({ error: error.message, errors: error.errors })
  }
})
router.post('/:gameId/join', (req, res) => {
  const { gameId } = req.params,
    body = req.body || {}
  const playerId = body.playerId || body.socketId
  const result =
    body.role === 'observer'
      ? engine.observeRoom(gameId)
      : engine.joinRoom(gameId, playerId, body.playerName, { ...body, requireSession: true })
  if (!result.ok)
    return res.status(result.error === 'room-not-found' ? 404 : 403).json({ error: result.error })
  const room = engine.getRoom(gameId)
  return res.json({
    ...envelope(room),
    gameType: room.gameType,
    ok: true,
    playerId: body.role === 'observer' ? null : playerId,
    sessionToken: result.sessionToken,
    isHost: result.isHost,
    players: result.players.size,
    leaderboard: result.leaderboard,
    state: engine.getPublicState(gameId, body.role === 'observer' ? null : playerId),
  })
})
function mutate(event, req, res) {
  const body = req.body || {},
    { gameId } = req.params
  if (body.gameId !== gameId) return res.status(400).json({ error: 'game-id-mismatch' })
  const actor = {
    playerId: body.playerId || body.socketId,
    socketId: body.socketId,
    sessionToken: body.sessionToken,
    hostCapability: body.hostCapability,
  }
  const result = engine.command(event, body, actor)
  if (!result.accepted)
    return res
      .status(
        result.error === 'room-not-found'
          ? 404
          : ['host-only', 'stale-player-session', 'player-only'].includes(result.error)
            ? 403
            : 409
      )
      .json(result)
  return res.json({ ...result, state: engine.getPublicState(gameId, actor.playerId) })
}
for (const [route, event] of Object.entries({
  answer: 'game-answer',
  next: 'game-next',
  random: 'game-random',
  end: 'game-end',
  reset: 'game-reset',
}))
  router.post(`/:gameId/${route}`, (req, res) => mutate(event, req, res))
router.post('/:gameId/command', (req, res) => mutate(req.body?.event, req, res))
router.delete('/:gameId', (req, res) => {
  const body = req.body || {},
    room = engine.getRoom(req.params.gameId)
  const result = validate(
    room,
    'game-delete',
    body,
    { ...body, playerId: body.playerId || body.socketId },
    true
  )
  if (result.error)
    return res.status(result.error === 'room-not-found' ? 404 : 403).json({ error: result.error })
  engine.cleanup(req.params.gameId)
  return res.json({ deleted: true })
})
router.get('/:gameId/leaderboard', (req, res) => {
  const scores = engine.getLeaderboard(req.params.gameId)
  return scores === null ? res.status(404).json({ error: 'room-not-found' }) : res.json(scores)
})
router.get('/:gameId/state', (req, res) => {
  const state = engine.getPublicState(req.params.gameId)
  return state ? res.json(state) : res.status(404).json({ error: 'room-not-found' })
})
module.exports = router
