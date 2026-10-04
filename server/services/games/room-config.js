const { normalizeGameConfig } = require('revealjs-shared/src/education/normalize-game-config.js')
const { validateGameConfig } = require('revealjs-shared/src/education/game-schema.js')
const { getGameCapabilities } = require('revealjs-shared/src/education/game-registry.js')
const store = require('./room-store'),
  life = require('./room-lifecycle')
const corner = require('revealjs-shared/src/education/games/four-corners.js')
const relay = require('revealjs-shared/src/education/games/relay-race.js')
const trivia = require('revealjs-shared/src/education/games/trivia-champ.js')
const scatter = require('revealjs-shared/src/education/games/scattergories.js')
const jeopardy = require('revealjs-shared/src/education/games/jeopardy.js')
const poll = require('revealjs-shared/src/education/games/poll.js')
const cloud = require('revealjs-shared/src/education/games/word-cloud.js')
const { createLiveMatchingState } = require('./live-matching-state')
const { createQuizSession } = require('revealjs-shared/src/education/quiz-session.js')
const { assertFiniteConfig } = require('./config-input')
const domainFactories = {
  'four-corners': corner.createFourCornersState,
  'relay-race': relay.createRelayRaceState,
  'trivia-champ': trivia.createTriviaChampState,
  scattergories: scatter.createScattergoriesState,
  jeopardy: jeopardy.createJeopardyState,
}
const engagementFactories = {
  poll: poll.createPollState,
  'word-cloud': cloud.createWordCloudState,
  matching: createLiveMatchingState,
}
function initialize(room) {
  if (room.gameType === 'quiz') {
    const order = createQuizSession(room.config, { generation: room.generation }).questionIds
    room.questions = order.map((id) => room.config.questions.find((question) => question.id === id))
  }
  if (room.gameType === 'hot-potato' && room.config.shuffleQuestions) {
    room.questions = [...room.config.questions]
    for (let i = room.questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[room.questions[i], room.questions[j]] = [room.questions[j], room.questions[i]]
    }
  }
  room.domain = domainFactories[room.gameType]?.(room.config) || null
  if (room.domain) room.domain.generation = room.generation
  room.engagement = engagementFactories[room.gameType]?.(room.config) || null
  if (room.engagement) room.engagement.generation = room.generation
  room.items = structuredClone(room.config.items || [])
  room.roster = []
  room.turnPlayerId = null
  room.buzz = null
  room.picker = null
  room.attempts = new Map()
  room.triviaCursor = 0
  room.scatterSubmissions = new Map()
  room.teamCursors = {}
  room.currentQuestion = -1
  room.revealed = false
}
function createRoom(gameId, gameType, options = {}, owner = null) {
  if (!store.isId(gameId) || !getGameCapabilities(gameType).live)
    throw new Error('Unsupported live game or invalid game ID')
  if (store.rooms.has(gameId)) return null
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('options must be an object')
  if (
    options.questions?.length > 200 ||
    options.teams?.length > 16 ||
    options.options?.length > 6 ||
    options.pairs?.length > 8
  )
    throw new Error('Game configuration exceeds live limits')
  assertFiniteConfig(options)
  const config = normalizeGameConfig({ gameType, [gameType]: options })
  const validation = validateGameConfig(gameType, config)
  if (!validation.isValid) {
    const error = new Error(validation.errors.map((row) => row.message).join('; '))
    error.errors = validation.errors
    throw error
  }
  if (
    gameType === 'hot-potato' &&
    config.questions.some((question) => question.kind !== 'single-choice')
  )
    throw new Error('Live Hot Potato requires single-choice questions')
  const capability = store.token()
  const room = {
    gameId,
    gameType,
    config,
    owner: store.ownerValue(owner),
    roomInstanceId: store.token(),
    generation: 0,
    roundId: 0,
    stateVersion: 0,
    socketRoomId: `game:${gameId}:${store.token()}`,
    status: 'waiting',
    phase: 'waiting',
    players: new Map(),
    hostCapabilityHash: store.hash(capability),
    hostPlayerId: null,
    hostSocketId: null,
    receipts: new Map(),
    questions: config.questions || [],
    teams: config.teams || [],
    allowLate: gameType === 'hot-potato' && config.allowLate === true,
    createdAt: Date.now(),
    questionStartedAt: null,
    deadlineMs: null,
    roundTimer: null,
    cleanupTimer: null,
    cleanupKind: null,
    unclaimedCleanupTimer: null,
  }
  initialize(room)
  store.rooms.set(gameId, room)
  store.pendingHostCapabilities.set(gameId, capability)
  life.scheduleUnclaimed(room)
  return room
}
function resetRoom(room) {
  life.cancelRound(room)
  room.generation++
  room.roundId = 0
  room.receipts.clear()
  room.stateVersion++
  clearTimeout(room.cleanupTimer)
  room.cleanupTimer = null
  room.cleanupKind = null
  room.status = 'waiting'
  room.phase = 'waiting'
  room.questionStartedAt = null
  for (const player of room.players.values()) {
    player.score = 0
    player.answers = []
    player.quiz = null
    player.ownSubmission = null
    player.admitted = false
  }
  initialize(room)
  return room
}
module.exports = { createRoom, resetRoom, initialize }
