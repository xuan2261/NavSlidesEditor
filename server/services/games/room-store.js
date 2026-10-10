const crypto = require('crypto')
const rooms = new Map(),
  pendingHostCapabilities = new Map(),
  cleanupListeners = new Set(),
  stateListeners = new Set()
const token = () => crypto.randomBytes(32).toString('base64url')
const hash = (value) =>
  crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex')
const validToken = (digest, value) =>
  typeof value === 'string' && value.length <= 128 && Boolean(digest) && digest === hash(value)
const isId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128
function ownerValue(owner) {
  if (
    !owner ||
    !isId(owner.presentationId) ||
    !isId(owner.liveRoomCode) ||
    !Number.isInteger(Number(owner.presentationGeneration))
  )
    return null
  return {
    presentationId: owner.presentationId,
    liveRoomCode: owner.liveRoomCode,
    presentationGeneration: Number(owner.presentationGeneration),
  }
}
const roomOwnerMatches = (room, owner) =>
  Boolean(
    ownerValue(owner) &&
    room?.owner?.presentationId === owner.presentationId &&
    room.owner.liveRoomCode === owner.liveRoomCode
  )
const unoccupied = (room) =>
  Boolean(room && ![...room.players.values()].some((player) => player.socketId))
function subscribe(set, listener) {
  set.add(listener)
  return () => set.delete(listener)
}
function publish(room) {
  for (const listener of stateListeners) listener(room.gameId)
}
module.exports = {
  rooms,
  pendingHostCapabilities,
  cleanupListeners,
  stateListeners,
  token,
  hash,
  validToken,
  isId,
  ownerValue,
  roomOwnerMatches,
  unoccupied,
  subscribe,
  publish,
}
