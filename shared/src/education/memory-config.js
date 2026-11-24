const { createValidation, throwInvalid } = require('./game-validation-utils.js')
const { validateCards } = require('./game-content-validation.js')
const { cloneCardContent } = require('./card-content.js')

function createMemoryConfig(input = {}) {
  const config = {
    title: 'Memory',
    shuffleOnStart: true,
    mismatchDelayMs: 1000,
    matchPoints: 10,
    ...input,
  }
  const v = createValidation()
  v.text(config.title, ['title'], true)
  v.boolean(config.shuffleOnStart, ['shuffleOnStart'])
  v.number(config.mismatchDelayMs, ['mismatchDelayMs'], 0, 5000, true)
  v.number(config.matchPoints, ['matchPoints'], 1, 1000, true)
  validateCards('memory', config, v)
  throwInvalid(v.errors, 'Memory configuration')
  return {
    title: config.title,
    shuffleOnStart: config.shuffleOnStart,
    mismatchDelayMs: config.mismatchDelayMs,
    matchPoints: config.matchPoints,
    pairs: config.pairs.map((pair) => ({
      id: pair.id,
      first: cloneCardContent(pair.first),
      second: cloneCardContent(pair.second),
    })),
  }
}

function memoryCardId(pairId, side) {
  if (side !== 'first' && side !== 'second')
    throw new Error('Memory card side must be first or second')
  return `${pairId}:${side}`
}

function composeMemoryCards(config) {
  return config.pairs.flatMap((pair) =>
    ['first', 'second'].map((side) => ({
      id: memoryCardId(pair.id, side),
      pairId: pair.id,
      side,
      content: cloneCardContent(pair[side]),
    }))
  )
}

module.exports = { createMemoryConfig, composeMemoryCards, memoryCardId }
