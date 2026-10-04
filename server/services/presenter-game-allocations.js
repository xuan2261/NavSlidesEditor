const crypto = require('node:crypto')
const GameEngine = require('./game-room-manager-singleton-service')
const { gameInstanceKey } = require('revealjs-shared')
const scopes = new WeakMap()
const allocatedRooms = new Map()
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    )
  return value
}
function forgetRoom(id, room) {
  const allocation = allocatedRooms.get(id)
  if (allocation?.room !== room) return
  allocation.lineage.instances.delete(allocation.key)
  allocatedRooms.delete(id)
}
function prepareAllocations(descriptors, owner) {
  GameEngine.subscribeRoomCleanup(forgetRoom)
  let decks = scopes.get(owner.allocationScope)
  if (!decks) {
    decks = new Map()
    scopes.set(owner.allocationScope, decks)
  }
  const fingerprint = JSON.stringify(canonical(descriptors))
  const previous = decks.get(owner.presentationId)
  const sessionChanged = Boolean(previous && previous.fingerprint !== fingerprint)
  const lineage =
    !previous || sessionChanged
      ? { fingerprint, generation: crypto.randomBytes(16).toString('hex'), instances: new Map() }
      : previous
  const pending = descriptors.map((descriptor) => {
    const key = gameInstanceKey(descriptor)
    let allocation = lineage.instances.get(key)
    if (allocation && GameEngine.getRoom(allocation.id) !== allocation.room) {
      forgetRoom(allocation.id, allocation.room)
      allocation = null
    }
    return {
      descriptor,
      key,
      allocation,
      id: allocation?.id || `edu-${crypto.randomBytes(24).toString('hex')}`,
    }
  })
  function commit() {
    for (const item of pending) {
      const room = GameEngine.getRoom(item.id)
      const allocation = { room, key: item.key, id: item.id, lineage }
      lineage.instances.set(item.key, allocation)
      allocatedRooms.set(item.id, allocation)
    }
    decks.set(owner.presentationId, lineage)
  }
  return { pending, allocationGeneration: lineage.generation, sessionChanged, commit }
}
module.exports = { prepareAllocations }
