/**
 * GameEngine — singleton service managing all game rooms.
 * Handles: room creation, player join/leave, answer submission, random picker,
 * scoring, leaderboard, host identity/authorization, and TTL-based cleanup.
 *
 * Players are keyed by a stable playerId (client-supplied, persisted in
 * localStorage; falls back to socket.id). This survives reconnects so player
 * scores and the reconnect grace window remain valid. Host authority is a
 * separate server-issued room capability.
 */
const crypto = require('crypto')

const rooms = new Map() // stable public gameId -> room object
const pendingHostCapabilities = new Map() // gameId -> raw capability until trusted create returns it
const roomCleanupListeners = new Set()

const ROOM_TTL_MS = 5 * 60 * 1000 // 5 minutes after game ends
let emptyRoomTtlMs = 30 * 1000 // grace window before an emptied room is reaped
let unclaimedRoomTtlMs = ROOM_TTL_MS // abandoned create responses must not pin IDs forever

function normalizeRoomOwner(owner) {
  if (!owner || typeof owner !== 'object') return null
  const presentationId = typeof owner.presentationId === 'string'
    ? owner.presentationId.trim()
    : ''
  const liveRoomCode = typeof owner.liveRoomCode === 'string'
    ? owner.liveRoomCode.trim()
    : ''
  const presentationGeneration = Number(owner.presentationGeneration)
  if (!presentationId || !liveRoomCode || !Number.isInteger(presentationGeneration)) {
    return null
  }
  return { presentationId, liveRoomCode, presentationGeneration }
}

function roomOwnerMatches(room, owner) {
  const expected = normalizeRoomOwner(owner)
  return Boolean(
    expected &&
    room?.owner?.presentationId === expected.presentationId &&
    room.owner.liveRoomCode === expected.liveRoomCode
  )
}

function updateRoomOwner(gameId, owner) {
  const room = rooms.get(gameId)
  const normalized = normalizeRoomOwner(owner)
  if (!room || !normalized || !roomOwnerMatches(room, normalized)) return false
  room.owner = normalized
  return true
}

function isRoomUnoccupied(room) {
  return Boolean(
    room &&
    !Array.from(room.players.values()).some((player) => player.socketId)
  )
}

function canReplaceUnoccupiedRoom(gameId, owner) {
  const room = rooms.get(gameId)
  const normalized = normalizeRoomOwner(owner)
  return Boolean(
    room &&
    room.owner &&
    normalized &&
    room.owner.presentationId === normalized.presentationId &&
    !roomOwnerMatches(room, normalized) &&
    !pendingHostCapabilities.has(gameId) &&
    isRoomUnoccupied(room)
  )
}

function replaceUnoccupiedRoom(gameId, owner) {
  if (!canReplaceUnoccupiedRoom(gameId, owner)) return false
  cleanup(gameId)
  return true
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

function createRoomChannel(gameId) {
  return `game:${gameId}:${crypto.randomBytes(16).toString('hex')}`
}

function subscribeRoomCleanup(listener) {
  if (typeof listener !== 'function') return () => {}
  roomCleanupListeners.add(listener)
  return () => roomCleanupListeners.delete(listener)
}

function hasValidSession(player, sessionToken) {
  return Boolean(
    player?.sessionTokenHash &&
    typeof sessionToken === 'string' &&
    sessionToken.length > 0 &&
    player.sessionTokenHash === hashSessionToken(sessionToken)
  )
}

function hasValidHostCapability(room, hostCapability) {
  return Boolean(
    room?.hostCapabilityHash &&
    typeof hostCapability === 'string' &&
    hostCapability.length > 0 &&
    room.hostCapabilityHash === hashSessionToken(hostCapability)
  )
}

function hasValidPlayerSession(player, options = {}) {
  if (options.socketId && player?.socketId !== options.socketId) return false
  if (options.requireSession && !hasValidSession(player, options.sessionToken)) return false
  return true
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function normalizeQuestionOption(option) {
  if (typeof option === 'string') return option
  if (typeof option === 'number' || typeof option === 'boolean') return String(option)
  if (!option || typeof option !== 'object' || Array.isArray(option)) return ''

  const text = option.text ?? option.label ?? option.value
  return typeof text === 'string' || typeof text === 'number' ? String(text) : ''
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) return []
  const validQuestions = questions.filter((question) => (
    question &&
    typeof question === 'object' &&
    !Array.isArray(question) &&
    (!Object.prototype.hasOwnProperty.call(question, 'options') || Array.isArray(question.options))
  ))
  const seenIds = new Set()
  return validQuestions.map((question, index) => {
    const rawId = question.id
    const baseId = typeof rawId === 'string' && rawId.trim()
      ? rawId.trim()
      : typeof rawId === 'number' && Number.isFinite(rawId)
        ? String(rawId)
        : `question-${index + 1}`
    let id = baseId
    let suffix = 2
    while (seenIds.has(id)) id = `${baseId}-${suffix++}`
    seenIds.add(id)
    const normalizedQuestion = {
      ...question,
      id,
      timeLimit:
        question.timeLimit == null
          ? question.timeLimit
          : clampInteger(question.timeLimit, 5, 300, 30),
      points: clampInteger(question.points, 1, 1000, 10),
    }
    if (Array.isArray(normalizedQuestion.options)) {
      normalizedQuestion.options = normalizedQuestion.options.map(normalizeQuestionOption)
    }
    return normalizedQuestion
  })
}

function createRoom(gameId, gameType, options = {}, owner = null) {
  if (rooms.has(gameId)) return null

  const hostCapability = createSessionToken()
  const room = {
    gameId,
    gameType,
    owner: normalizeRoomOwner(owner),
    socketRoomId: createRoomChannel(gameId),
    status: 'waiting', // 'waiting' | 'active' | 'finished'
    players: new Map(), // playerId -> { playerId, socketId, name, score, answers[], role }
    hostCapabilityHash: hashSessionToken(hostCapability),
    hostPlayerId: null,
    hostSocketId: null,
    // -1 means the host has not advanced to the first question yet.
    currentQuestion: -1,
    questionStartedAt: null,
    allowLate: options.allowLate === true,
    questions: normalizeQuestions(options.questions),
    poll: normalizePollOptions(options.poll || options),
    pollVotes: new Map(), // playerId -> optionId
    wordCloud: normalizeWordCloudOptions(options.wordCloud || options),
    wordCloudCounts: new Map(), // normalized phrase -> count
    wordCloudSubmissions: new Map(), // playerId -> submission count
    matching: normalizeMatchingOptions(options.matching || options),
    matchingRevealed: false,
    matchingTargetOrder: null,
    matchingSubmissions: new Map(), // playerId -> { pairs, score, total }
    teams: options.teams || [],
    items: options.items ? [...options.items] : [], // mutable copy for name-picker
    excludeAfterPick: options.excludeAfterPick !== undefined ? options.excludeAfterPick : true,
    createdAt: Date.now(),
    cleanupTimer: null,
    cleanupKind: null,
    unclaimedCleanupTimer: null,
  }

  room.matchingTargetOrder = orderMatchingTargets(room.matching.pairs)
  rooms.set(gameId, room)
  pendingHostCapabilities.set(gameId, hostCapability)
  scheduleUnclaimedRoomCleanup(gameId)
  return room
}

// The capability remains recoverable while the unclaimed room is inside its
// empty-room grace window. It is removed when a host successfully joins or the
// room is cleaned up, which makes create requests safe to retry after a lost
// response without retaining authority indefinitely.
function peekHostCapability(gameId) {
  return pendingHostCapabilities.get(gameId) || null
}

function claimHostCapability(gameId) {
  pendingHostCapabilities.delete(gameId)
}

// Test/integration seam for callers that need to consume a pending capability
// before joining directly. Normal REST creation uses peekHostCapability so a
// concurrent or retried create can recover the same pending value.
function takeHostCapability(gameId) {
  const capability = peekHostCapability(gameId)
  pendingHostCapabilities.delete(gameId)
  return capability
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
  if (!hasValidPlayerSession(player, options)) {
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
  if (!hasValidPlayerSession(player, options)) {
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

function buildMatchingPublicState(room, revealed = room.matchingRevealed) {
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
  if (!hasValidPlayerSession(player, options)) {
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

function setMatchingRevealed(gameId, revealed = true) {
  const room = rooms.get(gameId)
  if (!room || room.gameType !== 'matching') return null
  room.matchingRevealed = revealed === true
  return buildMatchingPublicState(room)
}

function revealMatching(gameId) {
  return setMatchingRevealed(gameId, true)
}

function getRoom(gameId) {
  return rooms.get(gameId)
}

function hasHostCapability(gameId, hostCapability) {
  return hasValidHostCapability(rooms.get(gameId), hostCapability)
}

function observeRoom(gameId) {
  const room = rooms.get(gameId)
  if (!room) return { ok: false, error: 'room-not-found' }
  return {
    ok: true,
    players: room.players,
    leaderboard: buildLeaderboard(room),
    isHost: false,
  }
}

function joinRoom(gameId, playerId, playerName, options = {}) {
  const room = rooms.get(gameId)
  if (!room) return { ok: false, error: 'room-not-found' }
  if (typeof playerId !== 'string' || !playerId || typeof playerName !== 'string' || !playerName) {
    return { ok: false, error: 'invalid-player' }
  }

  const hasHostCapability = hasValidHostCapability(room, options.hostCapability)
  if (options.role === 'host' && !hasHostCapability) {
    return { ok: false, error: 'invalid-host-capability' }
  }

  const existing = room.players.get(playerId)
  const isKnownHost = existing && room.hostPlayerId === playerId
  const canRecoverHostSession = Boolean(
    existing &&
    options.role === 'host' &&
    hasHostCapability &&
    isKnownHost
  )
  if (
    options.role === 'host' &&
    existing &&
    room.hostPlayerId &&
    room.hostPlayerId !== playerId
  ) {
    return { ok: false, error: 'invalid-host-session' }
  }
  if (
    existing &&
    options.requireSession &&
    !hasValidSession(existing, options.sessionToken) &&
    !canRecoverHostSession
  ) {
    return { ok: false, error: 'invalid-player-session' }
  }

  // Any player rejoin cancels only the short empty-room reconnect grace.
  // The independent unclaimed timer remains until the host successfully
  // claims the room, so ordinary players cannot pin an unowned room.
  if (room.cleanupTimer && room.cleanupKind === 'empty') {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
    room.cleanupKind = null
  }
  if (options.role === 'host' && room.unclaimedCleanupTimer) {
    clearTimeout(room.unclaimedCleanupTimer)
    room.unclaimedCleanupTimer = null
  }

  const sessionToken = existing
    ? (canRecoverHostSession ? createSessionToken() : null)
    : createSessionToken()
  const player = existing || {
    playerId,
    name: playerName,
    score: 0,
    answers: [],
    sessionTokenHash: hashSessionToken(sessionToken),
  }
  player.name = playerName
  if (sessionToken) player.sessionTokenHash = hashSessionToken(sessionToken)
  player.socketId = options.socketId || playerId
  if (options.role) player.role = options.role
  room.players.set(playerId, player)

  if (options.role === 'host') {
    if (room.hostPlayerId && room.hostPlayerId !== playerId) {
      const previousHost = room.players.get(room.hostPlayerId)
      if (previousHost) previousHost.role = 'player'
    }
    room.hostPlayerId = playerId
    room.hostSocketId = options.socketId || playerId
    player.role = 'host'
    claimHostCapability(gameId)
  }

  return {
    ok: true,
    players: room.players,
    leaderboard: buildLeaderboard(room),
    isHost: room.hostPlayerId === playerId,
    sessionToken: sessionToken || (options.requireSession ? options.sessionToken : undefined),
  }
}

function submitAnswer(gameId, playerId, answerIndex, timeSpentMs, options = {}) {
  const room = rooms.get(gameId)
  if (!room) return null

  const player = room.players.get(playerId)
  if (!player) return null
  if (!hasValidPlayerSession(player, options)) {
    return { ok: false, error: 'stale-player-session' }
  }

  const question = room.questions[room.currentQuestion]
  if (!question) return null
  if (options.requireQuestionId &&
      (options.questionId === undefined || options.questionId !== question.id)) {
    return { ok: false, error: 'stale-question' }
  }
  if (timeSpentMs !== undefined &&
      (typeof timeSpentMs !== 'number' || !Number.isFinite(timeSpentMs) || timeSpentMs < 0)) {
    return { ok: false, error: 'invalid-time-spent' }
  }
  if (!Number.isFinite(room.questionStartedAt)) {
    return { ok: false, error: 'invalid-question-timing' }
  }
  const serverElapsedMs = Math.max(0, Date.now() - room.questionStartedAt)

  // Anti-cheat: a player may answer each question only once. A repeat for the
  // same question id is ignored — no score change, signalled to the caller.
  const previousAnswer = player.answers.find((a) => a.questionId === question.id)
  if (previousAnswer) {
    return {
      duplicate: true,
      correct: previousAnswer.correct,
      correctIndex: question.correctIndex,
      answerIndex: previousAnswer.answerIndex,
      points: previousAnswer.points || 0,
      totalScore: player.score,
    }
  }

  const limitMs = Number(question.timeLimit) * 1000
  if (!room.allowLate && Number.isFinite(limitMs) && limitMs > 0 && serverElapsedMs > limitMs) {
    return { ok: false, error: 'question-expired' }
  }

  const elapsedMs = Number.isFinite(limitMs) && limitMs > 0
    ? Math.min(serverElapsedMs, limitMs)
    : serverElapsedMs
  const correct = answerIndex === question.correctIndex

  // Speed bonus: extra points for fast correct answers
  let points = correct ? question.points : 0
  if (correct && limitMs > 0) {
    const remaining = Math.max(0, limitMs - elapsedMs)
    const speedBonus = Math.round((remaining / limitMs) * question.points)
    points += speedBonus
  }

  player.score += points
  player.answers.push({ questionId: question.id, answerIndex, correct, points, timeSpentMs: elapsedMs })

  return {
    correct,
    correctIndex: question.correctIndex,
    answerIndex,
    points,
    totalScore: player.score,
  }
}

function triggerRandomResult(gameId) {
  const room = rooms.get(gameId)
  if (!room) return null

  if (room.items.length === 0) return { winnerIndex: -1, winner: null }

  const winnerIndex = Math.floor(Math.random() * room.items.length)
  const winner = room.items[winnerIndex]

  if (room.excludeAfterPick) {
    room.items.splice(winnerIndex, 1)
  }

  return { winnerIndex, winner }
}

function triggerRandom(gameId) {
  const result = triggerRandomResult(gameId)
  return result === null ? null : result.winnerIndex
}

function activateRoom(gameId) {
  const room = rooms.get(gameId)
  if (!room) return null
  if (room.cleanupTimer && ['empty', 'finished'].includes(room.cleanupKind)) {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
    room.cleanupKind = null
  }
  room.status = 'active'
  return room
}

function nextQuestion(gameId) {
  const room = rooms.get(gameId)
  if (!room) return null
  if (!room.questions.length) return room

  const nextIndex = room.currentQuestion + 1
  if (nextIndex >= room.questions.length) return endGame(gameId)

  room.currentQuestion = nextIndex
  room.questionStartedAt = Date.now()
  room.status = 'active'
  return room
}

function endGame(gameId) {
  const room = rooms.get(gameId)
  if (!room) return null

  room.status = 'finished'
  room.questionStartedAt = null

  if (room.unclaimedCleanupTimer) {
    clearTimeout(room.unclaimedCleanupTimer)
    room.unclaimedCleanupTimer = null
  }
  // Schedule cleanup after TTL
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupKind = 'finished'
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

function isHost(gameId, playerId, socketId, sessionToken, hostCapability) {
  const room = rooms.get(gameId)
  const player = room?.players.get(playerId)
  return Boolean(
    room &&
    player &&
    room.hostPlayerId === playerId &&
    room.hostSocketId === socketId &&
    player.socketId === socketId &&
    hasValidSession(player, sessionToken) &&
    hasValidHostCapability(room, hostCapability)
  )
}

function leaveRoom(gameId, playerId, options = {}) {
  const room = rooms.get(gameId)
  if (!room) return { ok: false, error: 'room-not-found' }

  const player = room.players.get(playerId)
  if (!player) return { ok: false, error: 'player-not-found' }
  if (options.requireSession && !hasValidPlayerSession(player, options)) {
    return { ok: false, error: 'stale-player-session' }
  }

  room.players.delete(playerId)
  if (room.hostPlayerId === playerId && (!options.socketId || room.hostSocketId === options.socketId)) {
    room.hostPlayerId = null
    room.hostSocketId = null
  }
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
    if (room.hostSocketId === socketId) room.hostSocketId = null
  }
  return { ok: true, players: room.players }
}

// Arm a longer cleanup for a room that was created but never claimed by a
// host. This timer is independent from empty-room reconnect grace and is
// canceled only after a host successfully claims the room.
function scheduleUnclaimedRoomCleanup(gameId) {
  const room = rooms.get(gameId)
  if (!room || room.players.size > 0) return
  if (room.unclaimedCleanupTimer) clearTimeout(room.unclaimedCleanupTimer)
  room.unclaimedCleanupTimer = setTimeout(() => cleanup(gameId), unclaimedRoomTtlMs)
}

// Arm a grace-window cleanup for a room that just became empty. A rejoin
// (joinRoom) within the window clears this timer, but not an unclaimed timer.
function scheduleEmptyCleanup(gameId) {
  const room = rooms.get(gameId)
  if (
    !room ||
    room.status === 'finished' ||
    Array.from(room.players.values()).some((player) => player.socketId)
  ) return
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupKind = 'empty'
  room.cleanupTimer = setTimeout(() => cleanup(gameId), emptyRoomTtlMs)
}

function cleanup(gameId) {
  const room = rooms.get(gameId)
  if (!room) return
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
    room.cleanupKind = null
  }
  if (room.unclaimedCleanupTimer) {
    clearTimeout(room.unclaimedCleanupTimer)
    room.unclaimedCleanupTimer = null
  }
  rooms.delete(gameId)
  pendingHostCapabilities.delete(gameId)
  for (const listener of roomCleanupListeners) {
    try {
      listener(gameId, room)
    } catch {
      // Cleanup notification must not prevent room state from being removed.
    }
  }
}

function _reset() {
  for (const room of rooms.values()) {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
    if (room.unclaimedCleanupTimer) clearTimeout(room.unclaimedCleanupTimer)
  }
  rooms.clear()
  pendingHostCapabilities.clear()
  roomCleanupListeners.clear()
  emptyRoomTtlMs = 30 * 1000
  unclaimedRoomTtlMs = ROOM_TTL_MS
}

// Test seam: shrink the empty-room grace window so cleanup tests run fast.
function _setEmptyRoomTtl(ms) {
  emptyRoomTtlMs = ms
}

// Test seam: shrink the unclaimed-room TTL without changing reconnect grace.
function _setUnclaimedRoomTtl(ms) {
  unclaimedRoomTtlMs = ms
}

module.exports = {
  createRoom,
  subscribeRoomCleanup,
  peekHostCapability,
  claimHostCapability,
  takeHostCapability,
  getRoom,
  hasHostCapability,
  roomOwnerMatches,
  updateRoomOwner,
  canReplaceUnoccupiedRoom,
  replaceUnoccupiedRoom,
  observeRoom,
  joinRoom,
  submitAnswer,
  submitPollVote,
  getPollAggregate,
  submitWordCloudText,
  getWordCloudAggregate,
  clearWordCloud,
  submitMatchingPairs,
  getMatchingState,
  setMatchingRevealed,
  revealMatching,
  triggerRandom,
  triggerRandomResult,
  activateRoom,
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
  _setUnclaimedRoomTtl,
}
