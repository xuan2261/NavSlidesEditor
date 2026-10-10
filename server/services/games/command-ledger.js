const { isId } = require('./room-store')
const { playerAuthorized, hostAuthorized } = require('./room-auth')
function identity(value) {
  if (Array.isArray(value)) return `[${value.map(identity).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${identity(value[key])}`)
      .join(',')}}`
  return JSON.stringify(value)
}
function bounded(value, depth = 0) {
  if (depth > 12) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.length <= 256
  if (Array.isArray(value))
    return value.length <= 200 && value.every((row) => bounded(row, depth + 1))
  if (value && typeof value === 'object')
    return (
      Object.keys(value).length <= 64 &&
      Object.entries(value).every(([key, row]) => key.length <= 128 && bounded(row, depth + 1))
    )
  return value === null || typeof value === 'boolean' || value === undefined
}
function envelope(room) {
  return {
    gameId: room.gameId,
    roomInstanceId: room.roomInstanceId,
    generation: room.generation,
    roundId: room.roundId,
  }
}
function validate(room, event, payload, actor, hostOnly) {
  if (!room) return { error: 'room-not-found' }
  if (!playerAuthorized(room, actor)) return { error: 'stale-player-session' }
  if (hostOnly && !hostAuthorized(room, actor)) return { error: 'host-only' }
  if (!hostOnly && room.hostPlayerId === actor.playerId) return { error: 'player-only' }
  if (
    !payload ||
    !bounded(payload) ||
    JSON.stringify(payload).length > 8192 ||
    !isId(payload.commandId)
  )
    return { error: 'invalid-command' }
  if (payload.gameId !== room.gameId || payload.roomInstanceId !== room.roomInstanceId)
    return { error: 'stale-room-instance' }
  if (payload.generation !== room.generation) return { error: 'stale-generation' }
  const key = `${actor.playerId}:${actor.sessionToken}:${payload.generation}:${payload.roundId}:${payload.commandId}`
  const fingerprint = identity({ event, payload }),
    previous = room.receipts.get(key)
  if (previous)
    return previous.fingerprint === fingerprint
      ? { duplicate: true, receipt: previous.receipt }
      : { error: 'command-id-conflict' }
  if (payload.roundId !== room.roundId) return { error: 'stale-round' }
  if (room.receipts.size >= 4096 && event !== 'game-reset') return { error: 'command-limit' }
  return { key, fingerprint, generation: payload.generation, roundId: payload.roundId }
}
function receipt(room, payload, outcome = {}) {
  return {
    ...envelope(room),
    commandId: payload?.commandId,
    stateVersion: room.stateVersion,
    accepted: !outcome.error,
    duplicate: false,
    ...outcome,
  }
}
function record(room, validated, result) {
  if (room.receiptGeneration !== room.generation || room.receiptRoundId !== room.roundId) {
    for (const [key, entry] of room.receipts)
      if (entry.generation !== room.generation || entry.roundId < room.roundId - 1)
        room.receipts.delete(key)
    room.receiptGeneration = room.generation
    room.receiptRoundId = room.roundId
  }
  room.receipts.set(validated.key, {
    fingerprint: validated.fingerprint,
    receipt: result,
    generation: validated.generation,
    roundId: validated.roundId,
  })
}
module.exports = { identity, bounded, envelope, validate, receipt, record }
