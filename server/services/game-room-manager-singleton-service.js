/**
 * GameEngine — singleton service managing all game rooms.
 * Handles: room creation, player join/leave, answer submission, random picker,
 * scoring, leaderboard, and TTL-based cleanup.
 */
const rooms = new Map() // gameId -> room object

const ROOM_TTL_MS = 5 * 60 * 1000 // 5 minutes after game ends

function createRoom(gameId, gameType, options = {}) {
  if (rooms.has(gameId)) return null

  const room = {
    gameId,
    gameType,
    status: 'waiting', // 'waiting' | 'active' | 'finished'
    players: new Map(), // socketId -> { name, score, answers[] }
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

function joinRoom(gameId, socketId, playerName) {
  const room = rooms.get(gameId)
  if (!room) return { ok: false, error: 'room-not-found' }

  room.players.set(socketId, {
    name: playerName,
    score: 0,
    answers: [],
  })

  return {
    ok: true,
    players: room.players,
    leaderboard: buildLeaderboard(room),
  }
}

function submitAnswer(gameId, socketId, answerIndex, timeSpentMs) {
  const room = rooms.get(gameId)
  if (!room) return null

  const question = room.questions[room.currentQuestion]
  if (!question) return null

  const player = room.players.get(socketId)
  if (!player) return null

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
  return Array.from(room.players.entries())
    .map(([socketId, player]) => ({ socketId, name: player.name, score: player.score }))
    .sort((a, b) => b.score - a.score)
}

function leaveRoom(gameId, socketId) {
  const room = rooms.get(gameId)
  if (!room) return { ok: false, error: 'room-not-found' }

  room.players.delete(socketId)
  return { ok: true, players: room.players }
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
  leaveRoom,
  cleanup,
  _reset,
}
