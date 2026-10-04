const { validateGameConfig } = require('../game-schema.js')
const { throwInvalid } = require('../game-validation-utils.js')
const nowValue = (inputs) => (typeof inputs.now === 'function' ? inputs.now() : (inputs.now ?? 0))
function initialSubmissionState(type, config) {
  throwInvalid(validateGameConfig(type, config).errors, `${type} configuration`)
  return {
    generation: 0,
    phase: 'idle',
    participants: [],
    roundId: 0,
    deadline: null,
    accepted: [],
    lastResult: null,
  }
}
const reject = (state, error) => ({ ...state, lastResult: { ok: false, error } })
const stale = (state, command) =>
  command.generation !== undefined && command.generation !== state.generation
function rosterCommand(state, command) {
  if (command.type === 'join') {
    if (
      typeof command.participantId !== 'string' ||
      !command.participantId.trim() ||
      command.participantId.length > 256 ||
      typeof command.name !== 'string' ||
      !command.name.trim() ||
      command.name.length > 200
    )
      return reject(state, 'invalid-participant')
    const participant = { id: command.participantId, name: command.name.trim() }
    const exists = state.participants.some((row) => row.id === participant.id)
    return {
      ...state,
      participants: exists
        ? state.participants.map((row) => (row.id === participant.id ? participant : row))
        : [...state.participants, participant],
      lastResult: null,
    }
  }
  if (command.type === 'leave')
    return {
      ...state,
      participants: state.participants.filter((row) => row.id !== command.participantId),
      lastResult: null,
    }
  return null
}
function startSubmission(config, state, inputs) {
  if (state.phase === 'active') return state
  return {
    ...state,
    phase: 'active',
    roundId: state.roundId + 1,
    deadline: nowValue(inputs) + config.timerDuration * 1000,
    lastResult: null,
  }
}
function activeError(type, state, command, inputs) {
  if (state.phase !== 'active' || (state.deadline !== null && nowValue(inputs) >= state.deadline))
    return `${type}-not-active`
  if (!state.participants.some((row) => row.id === command.participantId)) return 'player-not-found'
  if (command.roundId !== undefined && command.roundId !== state.roundId) return 'stale-round'
  return null
}
function actionReceipt(state, command, payload) {
  if (
    typeof command.actionId !== 'string' ||
    !command.actionId.trim() ||
    command.actionId.length > 256
  )
    return { error: 'invalid-action-id' }
  const previous = state.accepted.find((row) => row.actionId === command.actionId)
  if (!previous) return null
  if (
    previous.participantId !== command.participantId ||
    previous.type !== command.type ||
    previous.payload !== payload
  )
    return { error: 'action-id-conflict' }
  return { result: previous.result }
}
function accept(state, command, payload, result, changes) {
  const record = {
    actionId: command.actionId,
    participantId: command.participantId,
    type: command.type,
    payload,
    result,
  }
  return { ...state, ...changes, accepted: [...state.accepted, record], lastResult: result }
}
function expiry(state, inputs, command) {
  if (command?.roundId !== undefined && command.roundId !== state.roundId) return state
  if (state.phase !== 'active' || state.deadline === null || nowValue(inputs) < state.deadline)
    return state
  return { ...state, phase: 'ended', deadline: null, lastResult: null }
}
module.exports = {
  initialSubmissionState,
  stale,
  rosterCommand,
  startSubmission,
  activeError,
  actionReceipt,
  accept,
  reject,
  expiry,
}
