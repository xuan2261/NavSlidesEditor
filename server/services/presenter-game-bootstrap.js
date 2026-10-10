const GameEngine = require('./game-room-manager-singleton-service')
const { getGameCapabilities } = require('revealjs-shared/src/education/game-registry.js')
const {
  collectEffectiveGameDescriptors,
} = require('revealjs-shared/src/education/effective-game-descriptors.js')
const { prepareAllocations } = require('./presenter-game-allocations')

function bootstrapPresenterGames(presentation, knownCapabilities = {}, owner) {
  let descriptors
  try {
    descriptors = collectEffectiveGameDescriptors(presentation).filter(
      (item) => getGameCapabilities(item.gameType).live
    )
    for (const item of descriptors) {
      if (
        item.gameType === 'hot-potato' &&
        item.config.questions.some((question) => question.kind !== 'single-choice')
      ) {
        throw new Error(
          `${item.elementId}: current live HotPotato requires single-choice questions; use single-choice or present this authored kind offline`
        )
      }
    }
  } catch (error) {
    return { ok: false, error: 'invalid-game-config', message: error.message, errors: error.errors }
  }
  if (!descriptors.length) return { ok: true, games: [] }
  if (
    !owner?.presentationId ||
    !owner.liveRoomCode ||
    !Number.isInteger(Number(owner.presentationGeneration)) ||
    !owner.allocationScope ||
    typeof owner.allocationScope !== 'object'
  ) {
    return { ok: false, error: 'game-room-owner-required' }
  }
  const prepared = prepareAllocations(descriptors, owner)
  const capabilities = new Map(),
    missing = []
  for (const { id, allocation } of prepared.pending) {
    if (!allocation) continue
    if (!GameEngine.roomOwnerMatches(allocation.room, owner))
      return { ok: false, error: 'game-room-conflict', gameId: id }
    const known =
      knownCapabilities &&
      typeof knownCapabilities === 'object' &&
      !Array.isArray(knownCapabilities)
        ? knownCapabilities[id]
        : null
    const capability =
      GameEngine.peekHostCapability(id) || (GameEngine.hasHostCapability(id, known) ? known : null)
    if (!capability) missing.push(id)
    else capabilities.set(id, capability)
  }
  if (missing.length) return { ok: false, error: 'host-capability-required', gameIds: missing }
  const created = [],
    games = []
  try {
    for (const { descriptor, id, allocation } of prepared.pending) {
      if (!allocation) {
        const room = GameEngine.createRoom(id, descriptor.gameType, descriptor.config, owner)
        if (!room) throw new Error(`Cannot create game room ${id}`)
        created.push(id)
        capabilities.set(id, GameEngine.peekHostCapability(id))
      } else GameEngine.updateRoomOwner(id, owner)
      const room = GameEngine.getRoom(id)
      games.push({
        effectiveSlideId: descriptor.effectiveSlideId,
        elementId: descriptor.elementId,
        transportGameId: id,
        gameType: descriptor.gameType,
        roomInstanceId: room.roomInstanceId,
        generation: room.generation,
        roundId: room.roundId,
        config: descriptor.config,
        hostCapability: capabilities.get(id),
      })
    }
    prepared.commit()
  } catch (error) {
    for (const id of created) GameEngine.cleanup(id)
    return { ok: false, error: 'game-room-create-failed', message: error.message }
  }
  return {
    ok: true,
    games,
    allocationGeneration: prepared.allocationGeneration,
    sessionChanged: prepared.sessionChanged,
  }
}
module.exports = { bootstrapPresenterGames }
