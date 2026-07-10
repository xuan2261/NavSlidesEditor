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

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) return []
  return questions
    .filter((question) => question && typeof question === 'object' && !Array.isArray(question))
    .map((question) => ({
      ...question,
      timeLimit:
        question.timeLimit == null
          ? question.timeLimit
          : clampInteger(question.timeLimit, 5, 300, 30),
      points: clampInteger(question.points, 1, 1000, 10),
    }))
}

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
    questions: normalizeQuestions(options.questions),
    poll: normalizePollOptions(options.poll || options),
    pollVotes: new Map(), // playerId -> optionId
    wordCloud: normalizeWordCloudOptions(options.wordCloud || options),
    wordCloudCounts: new Map(), // normalized phrase -> count
    wordCloudSubmissions: new Map(), // playerId -> submission count
    matching: normalizeMatchingOptions(options.matching || options),
    matchingTargetOrder: null,
    matchingSubmissions: new Map(), // playerId -> { pairs, score, total }
    teams: options.teams || [],
    items: options.items ? [...options.items] : [], // mutable copy for name-picker
    excludeAfterPick: options.excludeAfterPick !== undefined ? options.excludeAfterPick : true,
    createdAt: Date.now(),
    cleanupTimer: null,
  }

  room.matchingTargetOrder = orderMatchingTargets(room.matching.pairs)
  rooms.set(gameId, room)
  return room
}

function normalizePollOptions(options = {}) {
  const rawOptions = Array.isArray(options.options) ? options.options : []
  return {
    prompt: options.prompt || 'What do you think?',
    options: rawOptions
      .slice(0, 6)
      .map((option, index) => ({
        id: String(option.id || `option-${index + 1}`),
        text: String(option.text || option.label || `Option ${index + 1}`),
      }))
      .filter((option) => option.text.trim()),
  }
}

function buildPollAggregate(room) {
  const optionIds = new Set(room.poll.options.map((option) => option.id))
  const counts = Object.fromEntries(room.poll.options.map((option) => [option.id, 0]))
  for (const optionId of room.pollVotes.values()) {
    if (optionIds.has(optionId)) counts[optionId] += 1
  }
  return {
    prompt: room.poll.prompt,
    options: room.poll.options.map((option) => ({
      ...option,
      votes: counts[option.id] || 0,
    })),
    totalVotes: room.pollVotes.size,
  }
}

function submitPollVote(gameId, playerId, optionId, options = {}) {
  const room = rooms.get(gameId)
  if (!room || room.gameType !== 'poll') return null
  if (room.status !== 'active') return { ok: false, error: 'poll-not-active' }

  const player = room.players.get(playerId)
  if (!player) return { ok: false, error: 'player-not-found' }
  if (options.socketId && player.socketId !== options.socketId) {
    return { ok: false, error: 'stale-player-session' }
  }
  if (!room.poll.options.some((option) => option.id === optionId)) {
    return { ok: false, error: 'invalid-poll-option' }
  }

  room.pollVotes.set(playerId, optionId)
  return { ok: true, aggregate: buildPollAggregate(room) }
}

function getPollAggregate(gameId) {
  const room = rooms.get(gameId)
  if (!room || room.gameType !== 'poll') return null
  return buildPollAggregate(room)
}

function normalizeWordCloudOptions(options = {}) {
  return {
    prompt: options.prompt || 'Share one word or short phrase',
    maxPhraseLength: Math.min(Math.max(Number(options.maxPhraseLength) || 40, 1), 40),
    maxSubmissionsPerPlayer: Math.min(Math.max(Number(options.maxSubmissionsPerPlayer) || 5, 1), 5),
    displayLimit: Math.min(Math.max(Number(options.displayLimit) || 50, 1), 50),
  }
}

function normalizeWordCloudText(text, limit = 40) {
  return String(text || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, limit)
}

function buildWordCloudAggregate(room) {
  const entries = Array.from(room.wordCloudCounts.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
    .slice(0, room.wordCloud.displayLimit)

  return {
    prompt: room.wordCloud.prompt,
    entries,
    totalSubmissions: Array.from(room.wordCloudCounts.values()).reduce((sum, count) => sum + count, 0),
  }
}

function submitWordCloudText(gameId, playerId, text, options = {}) {
  const room = rooms.get(gameId)
  if (!room || room.gameType !== 'word-cloud') return null
  if (room.status !== 'active') return { ok: false, error: 'word-cloud-not-active' }

  const player = room.players.get(playerId)
  if (!player) return { ok: false, error: 'player-not-found' }
  if (options.socketId && player.socketId !== options.socketId) {
    return { ok: false, error: 'stale-player-session' }
  }

  const normalized = normalizeWordCloudText(text, room.wordCloud.maxPhraseLength)
  if (!normalized) return { ok: false, error: 'empty-word-cloud-text' }

  const submitted = room.wordCloudSubmissions.get(playerId) || 0
  if (submitted >= room.wordCloud.maxSubmissionsPerPlayer) {
    return { ok: false, error: 'word-cloud-rate-limit' }
  }

  room.wordCloudSubmissions.set(playerId, submitted + 1)
  room.wordCloudCounts.set(normalized, (room.wordCloudCounts.get(normalized) || 0) + 1)
  return { ok: true, text: normalized, aggregate: buildWordCloudAggregate(room) }
}

function getWordCloudAggregate(gameId) {
  const room = rooms.get(gameId)
  if (!room || room.gameType !== 'word-cloud') return null
  return buildWordCloudAggregate(room)
}

function clearWordCloud(gameId) {
  const room = rooms.get(gameId)
  if (!room || room.gameType !== 'word-cloud') return null
  room.wordCloudCounts.clear()
  room.wordCloudSubmissions.clear()
  return buildWordCloudAggregate(room)
}

function normalizeMatchingOptions(options = {}) {
  const pairs = (Array.isArray(options.pairs) ? options.pairs : [])
    .slice(0, 8)
    .map((pair, index) => ({
      promptId: String(pair.promptId || `prompt-${index + 1}`),
      prompt: String(pair.prompt || pair.term || `Term ${index + 1}`),
      targetId: String(pair.targetId || `target-${index + 1}`),
      target: String(pair.target || pair.answer || `Definition ${index + 1}`),
    }))
    .filter((pair) => pair.prompt.trim() && pair.target.trim())

  const fallbackPairs = [
    { promptId: 'prompt-1', prompt: 'Term 1', targetId: 'target-1', target: 'Definition 1' },
    { promptId: 'prompt-2', prompt: 'Term 2', targetId: 'target-2', target: 'Definition 2' },
  ]

  return {
    prompt: options.prompt || 'Match each item to its answer',
    pairs: pairs.length >= 2 ? pairs : fallbackPairs,
  }
}

function orderMatchingTargets(pairs) {
  const targets = pairs.map((pair) => ({
    id: pair.targetId,
    text: pair.target,
  }))
  if (targets.length <= 1) return targets
  return [...targets.slice(1), targets[0]]
}

function buildMatchingPublicState(room, revealed = false) {
  const prompts = room.matching.pairs.map((pair) => ({
    id: pair.promptId,
    text: pair.prompt,
  }))
  const targets = room.matchingTargetOrder || orderMatchingTargets(room.matching.pairs)
  return {
    prompt: room.matching.prompt,
    prompts,
    targets,
    submissions: room.matchingSubmissions.size,
    ...(revealed
      ? {
          answerKey: room.matching.pairs.map((pair) => ({
            promptId: pair.promptId,
            targetId: pair.targetId,
          })),
        }
      : {}),
  }
}

function submitMatchingPairs(gameId, playerId, submittedPairs, options = {}) {
  const room = rooms.get(gameId)
  if (!room || room.gameType !== 'matching') return null
  if (room.status !== 'active') return { ok: false, error: 'matching-not-active' }

  const player = room.players.get(playerId)
  if (!player) return { ok: false, error: 'player-not-found' }
  if (options.socketId && player.socketId !== options.socketId) {
    return { ok: false, error: 'stale-player-session' }
  }
  if (!Array.isArray(submittedPairs)) return { ok: false, error: 'invalid-matching-pairs' }

  const promptIds = new Set(room.matching.pairs.map((pair) => pair.promptId))
  const targetIds = new Set(room.matching.pairs.map((pair) => pair.targetId))
  const answerKey = new Map(room.matching.pairs.map((pair) => [pair.promptId, pair.targetId]))
  const seenPrompts = new Set()
  const seenTargets = new Set()
  const normalizedPairs = []

  for (const pair of submittedPairs) {
    const promptId = String(pair?.promptId || '')
    const targetId = String(pair?.targetId || '')
    if (
      !promptIds.has(promptId) ||
      !targetIds.has(targetId) ||
      seenPrompts.has(promptId) ||
      seenTargets.has(targetId)
    ) {
      return { ok: false, error: 'invalid-matching-pairs' }
    }
    seenPrompts.add(promptId)
    seenTargets.add(targetId)
    normalizedPairs.push({ promptId, targetId })
  }

  const score = normalizedPairs.reduce(
    (sum, pair) => sum + (answerKey.get(pair.promptId) === pair.targetId ? 1 : 0),
    0
  )
  const total = room.matching.pairs.length
  room.matchingSubmissions.set(playerId, { pairs: normalizedPairs, score, total })

  return {
    ok: true,
    score,
    total,
    correct: score === total,
    summary: buildMatchingPublicState(room),
  }
}

function getMatchingState(gameId, options = {}) {
  const room = rooms.get(gameId)
  if (!room || room.gameType !== 'matching') return null
  return buildMatchingPublicState(room, options.revealed)
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
  if (room.pollVotes) room.pollVotes.delete(playerId)
  if (room.matchingSubmissions) room.matchingSubmissions.delete(playerId)
  return { ok: true, players: room.players }
}

function disconnectRoom(gameId, playerId, socketId) {
  const room = rooms.get(gameId)
  if (!room) return { ok: false, error: 'room-not-found' }
  const player = room.players.get(playerId)
  if (player && (!socketId || player.socketId === socketId)) {
    player.socketId = null
  }
  return { ok: true, players: room.players }
}

// Arm a grace-window cleanup for a room that just became empty. A rejoin
// (joinRoom) within the window clears this timer.
function scheduleEmptyCleanup(gameId) {
  const room = rooms.get(gameId)
  if (!room || Array.from(room.players.values()).some((player) => player.socketId)) return
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
  submitPollVote,
  getPollAggregate,
  submitWordCloudText,
  getWordCloudAggregate,
  clearWordCloud,
  submitMatchingPairs,
  getMatchingState,
  triggerRandom,
  nextQuestion,
  endGame,
  getLeaderboard,
  isHost,
  leaveRoom,
  disconnectRoom,
  scheduleEmptyCleanup,
  cleanup,
  _reset,
  _setEmptyRoomTtl,
}
