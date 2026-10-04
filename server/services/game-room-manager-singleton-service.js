const store = require('./games/room-store'),
  life = require('./games/room-lifecycle'),
  auth = require('./games/room-auth')
const membership = require('./games/player-membership'),
  config = require('./games/room-config'),
  engagement = require('./games/engagement-commands')
const dispatch = require('./games/command-dispatch'),
  publicState = require('./games/public-state')
const getRoom = (gameId) => store.rooms.get(gameId)
const peekHostCapability = (gameId) => store.pendingHostCapabilities.get(gameId) || null
function takeHostCapability(gameId) {
  const value = peekHostCapability(gameId)
  store.pendingHostCapabilities.delete(gameId)
  return value
}
function canReplaceUnoccupiedRoom(gameId, owner) {
  const room = getRoom(gameId),
    expected = store.ownerValue(owner)
  return Boolean(
    room?.owner &&
    expected &&
    room.owner.presentationId === expected.presentationId &&
    !store.roomOwnerMatches(room, expected) &&
    !store.pendingHostCapabilities.has(gameId) &&
    store.unoccupied(room)
  )
}
function replaceUnoccupiedRoom(gameId, owner) {
  if (!canReplaceUnoccupiedRoom(gameId, owner)) return false
  life.cleanup(gameId)
  return true
}
function updateRoomOwner(gameId, owner) {
  const room = getRoom(gameId)
  if (!store.roomOwnerMatches(room, owner)) return false
  room.owner = store.ownerValue(owner)
  return true
}
function mutate(event, gameId, fields, options) {
  return dispatch.command(event, { ...options, ...fields, gameId }, options)
}
module.exports = {
  createRoom: config.createRoom,
  getRoom,
  peekHostCapability,
  takeHostCapability,
  claimHostCapability: (gameId) => store.pendingHostCapabilities.delete(gameId),
  hasHostCapability: (gameId, capability) =>
    store.validToken(getRoom(gameId)?.hostCapabilityHash, capability),
  roomOwnerMatches: store.roomOwnerMatches,
  updateRoomOwner,
  canReplaceUnoccupiedRoom,
  replaceUnoccupiedRoom,
  subscribeRoomCleanup: (listener) => store.subscribe(store.cleanupListeners, listener),
  subscribeState: (listener) => store.subscribe(store.stateListeners, listener),
  observeRoom: membership.observeRoom,
  joinRoom: membership.joinRoom,
  leaveRoom: membership.leaveRoom,
  disconnectRoom: membership.disconnectRoom,
  command: dispatch.command,
  getPublicState: (gameId, playerId) => {
    const room = getRoom(gameId)
    return room ? publicState.getPublicState(room, playerId) : null
  },
  getLeaderboard: (gameId) => {
    const room = getRoom(gameId)
    return room ? membership.leaderboard(room) : null
  },
  isHost: (gameId, playerId, socketId, sessionToken, hostCapability) =>
    auth.hostAuthorized(getRoom(gameId), { playerId, socketId, sessionToken, hostCapability }),
  submitAnswer: (gameId, playerId, answer, timeSpentMs, options = {}) =>
    mutate(
      'game-answer',
      gameId,
      {
        playerId,
        timeSpentMs,
        ...(getRoom(gameId)?.gameType === 'quiz' ? { answer } : { answerIndex: answer }),
      },
      { ...options, playerId }
    ),
  submitPollVote: (gameId, playerId, optionId, options = {}) =>
    mutate('game-poll-submit', gameId, { optionId }, { ...options, playerId }),
  submitWordCloudText: (gameId, playerId, text, options = {}) =>
    mutate('game-word-cloud-submit', gameId, { text }, { ...options, playerId }),
  submitMatchingPairs: (gameId, playerId, pairs, options = {}) =>
    mutate('game-matching-submit', gameId, { pairs }, { ...options, playerId }),
  getPollAggregate: (gameId) => {
    const room = getRoom(gameId)
    return room?.gameType === 'poll' ? engagement.pollAggregate(room) : null
  },
  getWordCloudAggregate: (gameId) => {
    const room = getRoom(gameId)
    return room?.gameType === 'word-cloud' ? engagement.cloudAggregate(room) : null
  },
  getMatchingState: (gameId, options = {}) => {
    const room = getRoom(gameId)
    return room?.gameType === 'matching'
      ? engagement.matchingState(room, options.revealed ?? room.engagement.revealed)
      : null
  },
  clearWordCloud: (gameId, options) => mutate('game-word-cloud-clear', gameId, {}, options),
  revealMatching: (gameId, options) => mutate('game-matching-reveal', gameId, {}, options),
  setMatchingRevealed: (gameId, revealed, options) =>
    revealed
      ? mutate('game-matching-reveal', gameId, {}, options)
      : mutate('game-reset', gameId, {}, options),
  triggerRandomResult: (gameId, options) => mutate('game-random', gameId, {}, options),
  triggerRandom: (gameId, options) => mutate('game-random', gameId, {}, options),
  activateRoom: (gameId, options) =>
    mutate(`game-${getRoom(gameId)?.gameType}-start`, gameId, {}, options),
  nextQuestion: (gameId, options) => mutate('game-next', gameId, {}, options),
  endGame: (gameId, options) => mutate('game-end', gameId, {}, options),
  cleanup: life.cleanup,
  scheduleEmptyCleanup: life.scheduleEmptyCleanup,
  _reset: life.resetAll,
  _setEmptyRoomTtl: life.setEmptyTtl,
  _setUnclaimedRoomTtl: life.setUnclaimedTtl,
}
