import {
  CANONICAL_GAME_TYPES,
  GAME_BASE_DEFAULTS,
  createDefaultGameConfig,
  isGameSubtype,
  normalizeGameElement,
} from 'revealjs-shared'

export function buildGameElementDefaults() {
  const defaults = structuredClone(GAME_BASE_DEFAULTS)
  for (const gameType of CANONICAL_GAME_TYPES)
    defaults[gameType] = createDefaultGameConfig(gameType)
  return defaults
}

export function createGameElement(gameType = 'name-picker', overrides = {}) {
  if (!isGameSubtype(gameType)) throw new Error(`Unsupported game subtype: ${gameType}`)
  return normalizeGameElement({
    ...structuredClone(GAME_BASE_DEFAULTS),
    ...structuredClone(overrides),
    id: overrides.id || crypto.randomUUID(),
    type: 'game',
    gameType,
  })
}
