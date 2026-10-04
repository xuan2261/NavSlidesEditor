const { validatePublicQuestion } = require('./question-public-projection.js')
const { validLiveSnapshot } = require('./live-player-validation.js')
function createLivePlayerState(gameId) {
  return {
    gameId,
    roomInstanceId: null,
    generation: -1,
    roundId: -1,
    stateVersion: -1,
    phase: 'joining',
    connected: false,
    hydrated: false,
    playerId: null,
    players: [],
    leaderboard: [],
    draft: null,
    pending: null,
    receipt: null,
    error: null,
    retiredRooms: [],
    deadlineRevision: 0,
  }
}
function validIdentity(data) {
  return (
    data &&
    typeof data.gameId === 'string' &&
    data.gameId.length <= 128 &&
    typeof data.roomInstanceId === 'string' &&
    data.roomInstanceId.length <= 128 &&
    Number.isInteger(data.generation) &&
    data.generation >= 0 &&
    Number.isInteger(data.roundId) &&
    data.roundId >= 0
  )
}
function current(state, data, exact = false, allowOlderVersion = false) {
  if (
    !validIdentity(data) ||
    data.gameId !== state.gameId ||
    data.roomInstanceId !== state.roomInstanceId
  )
    return false
  if (exact && (data.generation !== state.generation || data.roundId !== state.roundId))
    return false
  if (
    data.generation < state.generation ||
    (data.generation === state.generation && data.roundId < state.roundId)
  )
    return false
  return (
    Number.isInteger(data.stateVersion) &&
    data.stateVersion >= 0 &&
    (allowOlderVersion ||
      data.generation > state.generation ||
      data.roundId > state.roundId ||
      data.stateVersion >= state.stateVersion)
  )
}
function reduceLivePlayerState(state, event, data = {}) {
  if (event === 'draft') return { ...state, draft: data }
  if (event === 'pending') return { ...state, pending: data, receipt: null, error: null }
  if (event === 'disconnect') return { ...state, connected: false }
  if (event === 'connect') return { ...state, connected: false, hydrated: false, error: null }
  if (event === 'connect_error')
    return { ...state, connected: false, error: data.message || 'Connection failed' }
  if (event === 'game-session') {
    if (!validIdentity(data) || data.gameId !== state.gameId) return state
    if (state.retiredRooms.includes(data.roomInstanceId)) return state
    if (
      data.roomInstanceId === state.roomInstanceId &&
      (data.generation < state.generation ||
        (data.generation === state.generation && data.roundId < state.roundId))
    )
      return state
    const replacement =
      data.roomInstanceId !== state.roomInstanceId ||
      data.generation > state.generation ||
      data.roundId > state.roundId
    return {
      ...(replacement ? createLivePlayerState(state.gameId) : state),
      retiredRooms:
        data.roomInstanceId !== state.roomInstanceId && state.roomInstanceId
          ? [...state.retiredRooms, state.roomInstanceId].slice(-16)
          : state.retiredRooms,
      roomInstanceId: data.roomInstanceId,
      generation: data.generation,
      roundId: data.roundId,
      gameType: data.gameType,
      playerId: data.playerId,
      isHost: data.isHost === true,
      connected: true,
      error: null,
      phase: replacement ? 'waiting' : state.phase,
    }
  }
  if (event === 'game-room-expired') {
    if (data.gameId !== state.gameId || data.roomInstanceId !== state.roomInstanceId) return state
    return {
      ...state,
      roomInstanceId: null,
      generation: -1,
      roundId: -1,
      stateVersion: -1,
      connected: false,
      hydrated: false,
      error: 'room-expired',
      retiredRooms: [...state.retiredRooms, data.roomInstanceId].slice(-16),
    }
  }
  if (event === 'game-error' && !data.commandId)
    return { ...state, error: data.message || data.error || 'Game command failed' }
  if (event === 'game-round-state') {
    if (!current(state, data)) return state
    if (data.question != null && !validatePublicQuestion(data.question).isValid)
      return { ...state, error: 'Invalid public question received' }
    if (
      data.timeRemainingMs != null &&
      (!Number.isFinite(data.timeRemainingMs) || data.timeRemainingMs < 0)
    )
      return state
    if (!validLiveSnapshot(data)) return { ...state, error: 'Invalid public game state received' }
    const replacement = data.generation !== state.generation || data.roundId !== state.roundId
    const resolved =
      state.pending &&
      data.ownSubmission &&
      ((state.pending.attemptId && data.ownSubmission.attemptId === state.pending.attemptId) ||
        data.ownSubmission.commandId === state.pending.commandId)
    const base = replacement
      ? {
          ...createLivePlayerState(state.gameId),
          playerId: state.playerId,
          isHost: state.isHost,
          players: state.players,
          retiredRooms: state.retiredRooms,
        }
      : state
    return {
      ...base,
      ...data,
      connected: true,
      hydrated: true,
      error: null,
      deadlineRevision: state.deadlineRevision + 1,
      draft: replacement ? null : state.draft,
      pending: replacement || resolved ? null : state.pending,
      receipt: replacement ? null : state.receipt,
    }
  }
  if (['game-command-result', 'game-answer-result', 'game-error'].includes(event)) {
    if (
      !current(state, data, true, true) ||
      !state.pending ||
      data.commandId !== state.pending.commandId
    )
      return state
    if (typeof data.accepted !== 'boolean' && !data.error && !data.message) return state
    return {
      ...state,
      stateVersion: Math.max(state.stateVersion, data.stateVersion),
      pending: null,
      receipt: data,
      error: data.error || (data.accepted === false ? data.message || 'Command rejected' : null),
    }
  }
  if (!current(state, data, true)) return state
  const lastEvent = { ...data, type: event.replace(/^game-/, '') }
  if (['game-player-joined', 'game-player-left'].includes(event))
    return validLiveSnapshot({ players: data.players })
      ? { ...state, players: data.players || state.players, lastEvent }
      : state
  if (event === 'game-leaderboard')
    return validLiveSnapshot({ leaderboard: data.scores })
      ? { ...state, leaderboard: data.scores || state.leaderboard, lastEvent }
      : state
  if (event === 'game-ended')
    return {
      ...state,
      phase: 'finished',
      leaderboard: data.finalScores || state.leaderboard,
      lastEvent,
    }
  // Legacy engagement events remain observable for existing hook consumers;
  // only validated round snapshots hydrate their absolute aggregates.
  return { ...state, lastEvent }
}
module.exports = { createLivePlayerState, reduceLivePlayerState }
