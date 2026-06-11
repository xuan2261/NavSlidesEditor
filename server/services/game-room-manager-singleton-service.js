/**
 * GameEngine — singleton service managing all game rooms.
 * Handles: room creation, player join/leave, answer submission, random picker,
 * scoring, leaderboard, host identity/authorization, and TTL-based cleanup.
 *
 * Players are keyed by a stable playerId (client-supplied, persisted in
 * localStorage; falls back to socket.id). This survives reconnects so the
 * host designation and the reconnect grace window remain valid.
 */
const rooms = new Map() // gameId -> room object

const ROOM_TTL_MS = 5 * 60 * 1000 // 5 minutes after game ends
let emptyRoomTtlMs = 30 * 1000 // grace window before an emptied room is reaped

function createRoom(gameId, gameType, options = {}) {
  if (rooms.has(gameId)) return null

  const room = {
    gameId,
    gameType,
    status: 'waiting', // 'waiting' | 'active' | 'finished'
    players: new Map(), // playerId -> { playerId, socketId, name, score, answers[], role }
    hostPlayerId: null,
    hostExplicit: false, // true once a role==='host' joiner claimed it
    currentQuestion: 0,
    questions: options.questions || [],
    teams: options.teams || [],
    items: options.items ? [...options.items] : [], // mutable copy for name-picker
    excludeAfterPick: options.excludeAfterPick !== undefined ? options.excludeAfterPick : true,
    createdAt: Date.now(),
    cleanupTimer: null,
  }

  rooms.set(gameId, room)
  return room
}

function getRoom(gameId) {
  return rooms.get(gameId)
}

function joinRoom(gameId, playerId, playerName, options = {}) {
  const room = rooms.get(gameId)
  if (!room) return { ok: false, error: 'room-not-found' }

  // Rejoin within the grace window cancels a pending empty-room cleanup.
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
  }

  const existing = room.players.get(playerId)
  const player = existing || { playerId, name: playerName, score: 0, answers: [] }
  player.name = playerName
  player.socketId = options.socketId || playerId
  if (options.role) player.role = options.role
  room.players.set(playerId, player)

  // Host designation: an explicit role==='host' always wins; otherwise the
  // first joiner overall becomes the fallback host until a real host claims it.
  if (options.role === 'host' && !room.hostExplicit) {
    room.hostPlayerId = playerId
    room.hostExplicit = true
  } else if (!room.hostPlayerId) {
    room.hostPlayerId = playerId
  }

  return {
    ok: true,
    players: room.players,
    leaderboard: buildLeaderboard(room),
    isHost: room.hostPlayerId === playerId,
  }
}

function submitAnswer(gameId, playerId, answerIndex, timeSpentMs) {
  const room = rooms.get(gameId)
  if (!room) return null

  const question = room.questions[room.currentQuestion]
  if (!question) return null

  const player = room.players.get(playerId)
  if (!player) return null

  // Anti-cheat: a player may answer each question only once. A repeat for the
  // same question id is ignored — no score change, signalled to the caller.
  if (player.answers.some((a) => a.questionId === question.id)) {
    return { duplicate: true, correct: false, points: 0, totalScore: player.score }
  }

  const correct = answerIndex === question.correctIndex

  // Speed bonus: extra points for fast correct answers
  let points = correct ? question.points : 0
  if (correct && question.timeLimit) {
    const remaining = Math.max(0, question.timeLimit * 1000 - timeSpentMs)
    const speedBonus = Math.round((remaining / (question.timeLimit * 1000)) * question.points)
    points += speedBonus
  }

  player.score += points
  player.answers.push({ questionId: question.id, answerIndex, correct, timeSpentMs })

  return { correct, points, totalScore: player.score }
}

function triggerRandom(gameId) {
  const room = rooms.get(gameId)
  if (!room) return null

  if (room.items.length === 0) return -1

  const index = Math.floor(Math.random() * room.items.length)

  if (room.excludeAfterPick) {
    room.items.splice(index, 1)
  }

  return index
}

function nextQuestion(gameId) {
  const room = rooms.get(gameId)
  if (!room) return null

  room.currentQuestion += 1
  return room
}

function endGame(gameId) {
  const room = rooms.get(gameId)
  if (!room) return null

  room.status = 'finished'

  // Schedule cleanup after TTL
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupTimer = setTimeout(() => {
    cleanup(gameId)
  }, ROOM_TTL_MS)

  return room
}

function getLeaderboard(gameId) {
  const room = rooms.get(gameId)
  if (!room) return null
  return buildLeaderboard(room)
}

function buildLeaderboard(room) {
  return Array.from(room.players.values())
    .map((player) => ({ playerId: player.playerId, name: player.name, score: player.score }))
    .sort((a, b) => b.score - a.score)
}

function isHost(gameId, playerId) {
  const room = rooms.get(gameId)
  return !!room && room.hostPlayerId === playerId
}

function leaveRoom(gameId, playerId) {
  const room = rooms.get(gameId)
  if (!room) return { ok: false, error: 'room-not-found' }

  room.players.delete(playerId)
  return { ok: true, players: room.players }
}

// Arm a grace-window cleanup for a room that just became empty. A rejoin
// (joinRoom) within the window clears this timer.
function scheduleEmptyCleanup(gameId) {
  const room = rooms.get(gameId)
  if (!room || room.players.size > 0) return
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupTimer = setTimeout(() => cleanup(gameId), emptyRoomTtlMs)
}

function cleanup(gameId) {
  const room = rooms.get(gameId)
  if (room && room.cleanupTimer) {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
  }
  rooms.delete(gameId)
}

function _reset() {
  for (const room of rooms.values()) {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  }
  rooms.clear()
  emptyRoomTtlMs = 30 * 1000
}

// Test seam: shrink the empty-room grace window so cleanup tests run fast.
function _setEmptyRoomTtl(ms) {
  emptyRoomTtlMs = ms
}

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  submitAnswer,
  triggerRandom,
  nextQuestion,
  endGame,
  getLeaderboard,
  isHost,
  leaveRoom,
  scheduleEmptyCleanup,
  cleanup,
  _reset,
  _setEmptyRoomTtl,
}
