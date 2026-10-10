const { getGameCapabilities } = require('../game-registry.js')
const { validateGameConfig } = require('../game-schema.js')
const { projectPublicGameConfig } = require('../game-public-projection.js')
const { gameInstanceKey } = require('../effective-slide-identity.js')
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
function inspectHostBindings(document, data, generation) {
  const metadata = document.documentElement.dataset
  if (
    data?.presentationId !== metadata.nsPresentationId ||
    data.presentationRevision !== (metadata.nsContentRevision || '') ||
    data.presentationGeneration !== generation ||
    !Number.isInteger(generation) ||
    typeof data.allocationGeneration !== 'string' ||
    !data.allocationGeneration ||
    !Array.isArray(data.games)
  )
    return null
  const roots = new Map()
  for (const root of document.querySelectorAll('[data-ns-game]')) {
    const tuple = {
      effectiveSlideId: root.closest('[data-ns-effective-slide-id]')?.dataset.nsEffectiveSlideId,
      elementId: root.dataset.nsElementId,
    }
    const key = gameInstanceKey(tuple)
    if (!key || roots.has(key)) return null
    roots.set(key, root)
  }
  const bindings = new Map(),
    transports = new Set()
  for (const game of data.games) {
    const key = gameInstanceKey(game),
      root = roots.get(key)
    if (
      !root ||
      root.dataset.nsGameType !== game.gameType ||
      bindings.has(key) ||
      transports.has(game.transportGameId) ||
      typeof game.transportGameId !== 'string' ||
      !game.transportGameId ||
      game.transportGameId.length > 128 ||
      typeof game.hostCapability !== 'string' ||
      !game.hostCapability ||
      !getGameCapabilities(game.gameType).live ||
      !validateGameConfig(game.gameType, game.config).isValid
    )
      return null
    const publicConfig = JSON.parse(root.querySelector('[data-ns-game-config]').textContent)
    if (
      JSON.stringify(canonical(publicConfig)) !==
      JSON.stringify(canonical(projectPublicGameConfig(game.gameType, game.config)))
    )
      return null
    transports.add(game.transportGameId)
    bindings.set(key, {
      effectiveSlideId: game.effectiveSlideId,
      elementId: game.elementId,
      gameType: game.gameType,
      transportGameId: game.transportGameId,
      config: game.config,
    })
  }
  for (const [key, root] of roots)
    if (getGameCapabilities(root.dataset.nsGameType).live && !bindings.has(key)) return null
  return bindings
}
module.exports = { inspectHostBindings }
