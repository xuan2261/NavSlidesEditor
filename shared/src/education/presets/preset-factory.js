const { GAME_CATALOG, getGameCapabilities } = require('../game-registry.js')
const { GAME_BASE_DEFAULTS, createDefaultGameConfig } = require('../game-defaults.js')
const { assertValidGame } = require('./migration-validation.js')
function freezePreset(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezePreset)
    Object.freeze(value)
  }
  return value
}
function gamePreset(gameType, vi, category, tags, overrides = {}) {
  const gameConfig = { ...createDefaultGameConfig(gameType), ...overrides }
  assertValidGame(gameType, gameConfig, `preset/${gameType}`)
  const id = `education-${gameType}`
  return freezePreset({
    id,
    gameType,
    labels: { vi, en: GAME_CATALOG[gameType].label },
    category,
    tags,
    capabilities: { ...getGameCapabilities(gameType) },
    preview: {
      title: vi,
      summary: GAME_CATALOG[gameType].label,
      items: (
        gameConfig.questions ||
        gameConfig.items ||
        gameConfig.teams ||
        gameConfig.cards ||
        gameConfig.words ||
        []
      )
        .slice(0, 4)
        .map(
          (item) => item.prompt || item.label || item.name || item.text || item.front?.text || ''
        ),
    },
    elements: [
      {
        ...GAME_BASE_DEFAULTS,
        id: `${id}/element`,
        x: 160,
        y: 30,
        gameType,
        [gameType]: gameConfig,
      },
    ],
  })
}
module.exports = { gamePreset, freezePreset }
