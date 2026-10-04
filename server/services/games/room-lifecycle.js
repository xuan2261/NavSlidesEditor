const { performance } = require('node:perf_hooks')
const store = require('./room-store')
const now = () => performance.now()
let emptyTtl = 30000,
  unclaimedTtl = 300000
function cancelRound(room) {
  clearTimeout(room.roundTimer)
  room.roundTimer = null
  room.deadlineMs = null
}
function cleanup(gameId) {
  const room = store.rooms.get(gameId)
  if (!room) return
  for (const timer of ['roundTimer', 'cleanupTimer', 'unclaimedCleanupTimer'])
    clearTimeout(room[timer])
  store.rooms.delete(gameId)
  store.pendingHostCapabilities.delete(gameId)
  room.receipts.clear()
  room.attempts.clear()
  room.scatterSubmissions.clear()
  room.players.clear()
  room.roster = []
  room.teamCursors = {}
  for (const listener of store.cleanupListeners) {
    try {
      listener(gameId, room)
    } catch (error) {
      console.error('Game cleanup listener failed:', error.message)
    }
  }
}
function armCleanup(room, kind, duration) {
  const field = kind === 'unclaimed' ? 'unclaimedCleanupTimer' : 'cleanupTimer'
  clearTimeout(room[field])
  if (kind !== 'unclaimed') room.cleanupKind = kind
  const generation = room.generation
  const timer = setTimeout(() => {
    if (
      store.rooms.get(room.gameId) === room &&
      room.generation === generation &&
      room[field] === timer
    )
      cleanup(room.gameId)
  }, duration)
  room[field] = timer
  timer.unref?.()
}
function scheduleEmptyCleanup(gameId) {
  const room = store.rooms.get(gameId)
  if (room && room.status !== 'finished' && store.unoccupied(room))
    armCleanup(room, 'empty', emptyTtl)
}
function scheduleUnclaimed(room) {
  armCleanup(room, 'unclaimed', unclaimedTtl)
}
function endGame(gameId) {
  const room = store.rooms.get(gameId)
  if (!room) return null
  cancelRound(room)
  room.status = 'finished'
  room.phase = 'ended'
  room.questionStartedAt = null
  clearTimeout(room.unclaimedCleanupTimer)
  room.unclaimedCleanupTimer = null
  armCleanup(room, 'finished', 300000)
  return room
}
function armRound(room, deadline, expire) {
  clearTimeout(room.roundTimer)
  room.deadlineMs = Number.isFinite(deadline) ? deadline : null
  if (room.deadlineMs === null) return
  const generation = room.generation,
    roundId = room.roundId
  room.roundTimer = setTimeout(
    () => {
      if (
        store.rooms.get(room.gameId) !== room ||
        room.generation !== generation ||
        room.roundId !== roundId ||
        room.deadlineMs !== deadline
      )
        return
      if (now() < room.deadlineMs) {
        armRound(room, room.deadlineMs, expire)
        return
      }
      expire(room)
      room.stateVersion++
      store.publish(room)
    },
    Math.max(1, deadline - now())
  )
  room.roundTimer.unref?.()
}
function resetAll() {
  for (const gameId of store.rooms.keys()) cleanup(gameId)
  store.cleanupListeners.clear()
  store.stateListeners.clear()
  emptyTtl = 30000
  unclaimedTtl = 300000
}
module.exports = {
  now,
  cleanup,
  cancelRound,
  armRound,
  endGame,
  scheduleEmptyCleanup,
  scheduleUnclaimed,
  resetAll,
  setEmptyTtl: (value) => {
    emptyTtl = value
  },
  setUnclaimedTtl: (value) => {
    unclaimedTtl = value
  },
}
