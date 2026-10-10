const MAX_ID_LENGTH = 128
function isLiveId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}
function readLiveEnvelope(value) {
  if (
    !value ||
    !isLiveId(value.gameId) ||
    !isLiveId(value.roomInstanceId) ||
    !Number.isSafeInteger(value.generation) ||
    value.generation < 0 ||
    !Number.isSafeInteger(value.roundId) ||
    value.roundId < 0
  )
    return null
  return {
    gameId: value.gameId,
    roomInstanceId: value.roomInstanceId,
    generation: value.generation,
    roundId: value.roundId,
  }
}
function createLiveCommand(envelope, commandId, payload = {}) {
  const identity = readLiveEnvelope(envelope)
  if (!identity || !isLiveId(commandId)) return null
  return { ...payload, ...identity, commandId }
}
function acceptLiveSnapshot(current, incoming) {
  const identity = readLiveEnvelope(incoming)
  if (!identity || !Number.isSafeInteger(incoming.stateVersion) || incoming.stateVersion < 0)
    return current
  if (
    current &&
    current.roomInstanceId === incoming.roomInstanceId &&
    (incoming.generation < current.generation ||
      (incoming.generation === current.generation &&
        (incoming.roundId < current.roundId || incoming.stateVersion < current.stateVersion)))
  )
    return current
  return incoming
}
module.exports = {
  MAX_ID_LENGTH,
  isLiveId,
  readLiveEnvelope,
  createLiveCommand,
  acceptLiveSnapshot,
}
