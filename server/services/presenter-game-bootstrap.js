const GameEngine = require('./game-room-manager-singleton-service')

const SUPPORTED_GAME_TYPES = new Set([
  'name-picker',
  'hot-potato',
  'jeopardy',
  'four-corners',
  'relay-race',
  'trivia-champ',
  'scattergories',
  'poll',
  'word-cloud',
  'matching',
])

const GAME_OPTION_KEYS = {
  'name-picker': ['items', 'excludeAfterPick'],
  'hot-potato': ['questions'],
  jeopardy: ['teams', 'categories', 'questions', 'dailyDouble'],
  'four-corners': ['cornerCount', 'eliminateMode', 'showTimer', 'timerDuration'],
  'relay-race': ['questionsPerRound', 'shuffleTeams', 'passOnWrong', 'questions'],
  'trivia-champ': ['rounds', 'lightningRound', 'jackpotRound', 'questions'],
  scattergories: ['timePerRound', 'letterMode', 'categories', 'scoring'],
  poll: ['prompt', 'options'],
  'word-cloud': ['prompt', 'maxPhraseLength', 'maxSubmissionsPerPlayer', 'displayLimit'],
  matching: ['prompt', 'pairs'],
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)])
    )
  }
  return value
}

function getGameConfig(element, gameType) {
  const nested = isPlainObject(element[gameType]) ? element[gameType] : {}
  return { ...element, ...nested }
}

function getGameOptions(element, gameType) {
  const config = getGameConfig(element, gameType)
  return Object.fromEntries(
    (GAME_OPTION_KEYS[gameType] || [])
      .filter((key) => config[key] !== undefined)
      .map((key) => [key, cloneValue(config[key])])
  )
}

function collectGameDescriptors(presentation) {
  const descriptors = []
  const seenIds = new Set()
  for (const slide of presentation?.slides || []) {
    const slideGroups = [slide, ...(slide?.children || [])]
    for (const group of slideGroups) {
      for (const element of group?.elements || []) {
        if (!element || element.type !== 'game') continue
        const gameType = typeof element.gameType === 'string' ? element.gameType : ''
        const gameId = typeof element.id === 'string' ? element.id.trim() : ''
        if (!SUPPORTED_GAME_TYPES.has(gameType) || !gameId || seenIds.has(gameId)) continue
        seenIds.add(gameId)
        descriptors.push({
          gameId,
          gameType,
          options: getGameOptions(element, gameType),
        })
      }
    }
  }
  return descriptors
}

function isValidRoomOwner(owner) {
  return Boolean(
    owner &&
    typeof owner.presentationId === 'string' &&
    owner.presentationId.trim() &&
    typeof owner.liveRoomCode === 'string' &&
    owner.liveRoomCode.trim() &&
    Number.isInteger(Number(owner.presentationGeneration))
  )
}

function bootstrapPresenterGames(presentation, knownCapabilities = {}, owner) {
  const descriptors = collectGameDescriptors(presentation)
  if (!descriptors.length) return { ok: true, games: [] }
  if (!isValidRoomOwner(owner)) {
    return { ok: false, error: 'game-room-owner-required' }
  }

  // Preflight every descriptor before creating anything. A cloned deck or a
  // second live room must not reuse an occupied or unclaimed public element ID,
  // while a disconnected claimed room may be handed off without waiting for its
  // empty-room TTL. A later conflict must not strand rooms created earlier here.
  const replaceableRoomIds = []
  for (const descriptor of descriptors) {
    const room = GameEngine.getRoom(descriptor.gameId)
    if (!room) continue
    const typeConflict = room.gameType !== descriptor.gameType
    const ownerConflict = !GameEngine.roomOwnerMatches(room, owner)
    if (!typeConflict && !ownerConflict) continue
    if (
      !typeConflict &&
      GameEngine.canReplaceUnoccupiedRoom(descriptor.gameId, owner)
    ) {
      replaceableRoomIds.push(descriptor.gameId)
      continue
    }
    return {
      ok: false,
      error: 'game-room-conflict',
      gameId: descriptor.gameId,
    }
  }

  for (const gameId of new Set(replaceableRoomIds)) {
    if (!GameEngine.replaceUnoccupiedRoom(gameId, owner)) {
      return { ok: false, error: 'game-room-conflict', gameId }
    }
  }

  const games = []
  const missingCapabilities = []

  for (const descriptor of descriptors) {
    let room = GameEngine.getRoom(descriptor.gameId)
    if (!room) {
      room = GameEngine.createRoom(
        descriptor.gameId,
        descriptor.gameType,
        descriptor.options,
        owner
      )
    } else {
      GameEngine.updateRoomOwner(descriptor.gameId, owner)
    }
    if (!room) {
      return { ok: false, error: 'game-room-create-failed', gameId: descriptor.gameId }
    }

    const pendingCapability = GameEngine.peekHostCapability(descriptor.gameId)
    const knownCapability = isPlainObject(knownCapabilities)
      ? knownCapabilities[descriptor.gameId]
      : null
    const hostCapability = pendingCapability || (
      GameEngine.hasHostCapability(descriptor.gameId, knownCapability)
        ? knownCapability
        : null
    )
    if (!hostCapability) {
      missingCapabilities.push(descriptor.gameId)
      continue
    }
    games.push({
      gameId: descriptor.gameId,
      gameType: descriptor.gameType,
      hostCapability,
    })
  }

  if (missingCapabilities.length) {
    return {
      ok: false,
      error: 'host-capability-required',
      gameIds: missingCapabilities,
    }
  }
  return { ok: true, games }
}

module.exports = {
  SUPPORTED_GAME_TYPES,
  collectGameDescriptors,
  bootstrapPresenterGames,
}
