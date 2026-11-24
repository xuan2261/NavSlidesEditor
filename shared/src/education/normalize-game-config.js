const { GAME_CATALOG, CANONICAL_GAME_TYPES, isGameSubtype } = require('./game-registry.js')
const { createDefaultGameConfig, cloneGameConfig } = require('./game-defaults.js')
const { validateGameConfig } = require('./game-schema.js')
const { isObject, throwInvalid } = require('./game-validation-utils.js')
const { migrateCollections } = require('./game-legacy-migration.js')
const { stripTransients, stripElementGameFields } = require('./game-config-projection.js')

function merge(lower, higher) {
  const result = { ...lower }
  for (const [key, value] of Object.entries(higher)) {
    if (value === undefined) continue
    const merged = isObject(value) && isObject(result[key]) ? merge(result[key], value) : value
    Object.defineProperty(result, key, {
      value: merged,
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
  return result
}
function normalizeGameConfig(element, gameType = element?.gameType) {
  if (!isObject(element)) throwInvalid([{ path: [], message: 'Game element must be an object' }])
  if (!isGameSubtype(gameType))
    throwInvalid([{ path: ['gameType'], message: `Unknown game subtype: ${String(gameType)}` }])
  const nested = element[gameType]
  if (nested !== undefined && !isObject(nested))
    throwInvalid([{ path: [gameType], message: 'Nested subtype config must be an object' }])
  const flat = {}
  for (const field of GAME_CATALOG[gameType].authoringFields)
    if (element[field] !== undefined) flat[field] = element[field]
  if (gameType === 'jeopardy' && element.questions !== undefined) flat.questions = element.questions
  // Nested authored values win over flat values before defaults fill the remaining fields.
  const authored = merge(flat, nested || {})
  const combined = cloneGameConfig(merge(createDefaultGameConfig(gameType), authored))
  if (
    gameType === 'trivia-champ' &&
    authored.questions === undefined &&
    Array.isArray(authored.rounds) &&
    authored.rounds.some((round) => isObject(round) && round.questions !== undefined)
  )
    combined.questions = []
  const config = stripTransients(migrateCollections(combined, gameType), gameType)
  if (
    gameType === 'trivia-champ' &&
    authored.rounds === undefined &&
    authored.questions !== undefined
  )
    config.rounds[0].questionIds = config.questions.map((question) => question.id)
  return config
}
function normalizeGameElement(element, { validate = true } = {}) {
  if (!isObject(element)) throwInvalid([{ path: [], message: 'Game element must be an object' }])
  const type = element.gameType
  if (!isGameSubtype(type))
    throwInvalid([{ path: ['gameType'], message: `Unknown game subtype: ${String(type)}` }])
  const result = stripElementGameFields(cloneGameConfig(element))
  for (const subtype of CANONICAL_GAME_TYPES) {
    if (subtype !== type && element[subtype] === undefined) continue
    try {
      result[subtype] = normalizeGameConfig(
        subtype === type ? element : { [subtype]: element[subtype] },
        subtype
      )
      if (validate)
        throwInvalid(
          validateGameConfig(subtype, result[subtype]).errors,
          `${subtype} configuration`
        )
    } catch (error) {
      if (!Array.isArray(error.errors)) throw error
      throwInvalid(
        error.errors.map((item) => ({ ...item, path: [subtype, ...item.path] })),
        'Game element migration'
      )
    }
  }
  return result
}
module.exports = { normalizeGameConfig, normalizeGameElement }
