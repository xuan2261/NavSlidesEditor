const { normalizeWord } = require('./word-graphemes.js')
const WORD_PUZZLE_BOUNDS = Object.freeze({
  minGrid: 2,
  maxGrid: 20,
  maxWords: 40,
  maxTokens: 20,
  crosswordBudget: 50000,
  wordSearchBudget: 20000,
})
const DIRECTIONS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      E: [0, 1],
      W: [0, -1],
      N: [-1, 0],
      S: [1, 0],
      NE: [-1, 1],
      NW: [-1, -1],
      SE: [1, 1],
      SW: [1, -1],
    }).map(([key, value]) => [key, Object.freeze(value)])
  )
)
class WordPuzzleError extends Error {
  constructor(code, entryId, constraint, action, details = {}) {
    super(`${constraint}. ${action}`)
    this.name = 'WordPuzzleError'
    Object.assign(this, { code, entryId: entryId ?? null, constraint, action }, details)
  }
}
function fail(code, entryId, constraint, action, details) {
  throw new WordPuzzleError(code, entryId, constraint, action, details)
}
function validateWordPuzzleConfig(config, crossword = false) {
  if (!config || typeof config !== 'object')
    fail('INVALID_CONFIG', null, 'Configuration must be an object', 'Supply a puzzle configuration')
  for (const key of ['rows', 'columns']) {
    if (!Number.isInteger(config[key]) || config[key] < 2 || config[key] > 20)
      fail('PUZZLE_OVERSIZE', null, `${key} must be an integer in 2..20`, 'Resize the grid')
  }
  if (!Number.isSafeInteger(config.seed) || config.seed < 0 || config.seed > 4294967295)
    fail('INVALID_CONFIG', null, 'Seed must be a uint32 integer', 'Choose a seed in 0..4294967295')
  const source = config[crossword ? 'entries' : 'words']
  if (!Array.isArray(source) || !source.length || source.length > 40)
    fail('PUZZLE_OVERSIZE', null, 'Use 1..40 authored words', 'Adjust the word list')
  const ids = new Set(),
    words = new Set()
  const entries = source.map((entry) => {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id))
      fail(
        'INVALID_ID',
        entry?.id,
        'IDs must be nonempty and unique',
        'Assign a distinct stable ID'
      )
    ids.add(entry.id)
    let normalized
    try {
      normalized = normalizeWord(entry[crossword ? 'answer' : 'text'])
    } catch (error) {
      fail(error.code, entry.id, error.message, 'Correct or shorten the authored word')
    }
    if (words.has(normalized.text))
      fail(
        'DUPLICATE_WORD',
        entry.id,
        'Normalized words must be distinct',
        'Replace the duplicate word'
      )
    words.add(normalized.text)
    if (crossword && (typeof entry.clue !== 'string' || !entry.clue.trim()))
      fail('INVALID_CONFIG', entry.id, 'Each entry needs a clue', 'Enter a clue')
    return { ...entry, tokens: normalized.tokens, normalized: normalized.text }
  })
  if (!crossword) {
    if (
      !Array.isArray(config.directions) ||
      !config.directions.length ||
      config.directions.length > 8 ||
      new Set(config.directions).size !== config.directions.length ||
      config.directions.some((key) => !Object.hasOwn(DIRECTIONS, key))
    )
      fail(
        'INVALID_DIRECTIONS',
        null,
        'Choose unique allowed directions',
        'Choose at least one of E/W/N/S/NE/NW/SE/SW'
      )
    for (const entry of entries) {
      if (!config.directions.some((key) => fits(entry.tokens.length, DIRECTIONS[key], config)))
        fail(
          'UNSATISFIABLE_LAYOUT',
          entry.id,
          'Word cannot fit any allowed direction',
          'Increase the grid or change directions'
        )
    }
    let alphabet
    try {
      alphabet = normalizeWord(config.alphabet, { min: 1, max: 256 }).tokens
    } catch (error) {
      fail(error.code, null, error.message, 'Supply a letter-only fill alphabet')
    }
    return { ...config, entries, alphabet }
  }
  for (const entry of entries)
    if (entry.tokens.length > Math.max(config.rows, config.columns))
      fail(
        'UNSATISFIABLE_LAYOUT',
        entry.id,
        'Entry cannot fit the grid',
        'Increase the grid or shorten the word'
      )
  return { ...config, entries }
}
function fits(length, vector, config) {
  return (!vector[0] || length <= config.rows) && (!vector[1] || length <= config.columns)
}
function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle(values, random) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}
function searchBudget(value, maximum) {
  const budget = value ?? maximum
  if (!Number.isInteger(budget) || budget < 0 || budget > maximum)
    fail(
      'INVALID_CONFIG',
      null,
      `Budget must be in 0..${maximum}`,
      'Choose a bounded integer budget'
    )
  return budget
}
function freezePuzzle(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezePuzzle)
    Object.freeze(value)
  }
  return value
}
module.exports = {
  WORD_PUZZLE_BOUNDS,
  DIRECTIONS,
  WordPuzzleError,
  fail,
  validateWordPuzzleConfig,
  seededRandom,
  shuffle,
  searchBudget,
  freezePuzzle,
}
