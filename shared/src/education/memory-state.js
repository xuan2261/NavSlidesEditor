const { createMemoryConfig, composeMemoryCards } = require('./memory-config.js')
const { shuffleCardIds } = require('./card-content.js')

function createMemoryState(config, { random = Math.random, generation = 0 } = {}) {
  const canonical = createMemoryConfig(config)
  const cards = composeMemoryCards(canonical)
  const ids = cards.map((card) => card.id)
  return {
    cards,
    order: canonical.shuffleOnStart ? shuffleCardIds(ids, random) : ids,
    faceUp: [],
    matchedPairIds: [],
    attempts: 0,
    score: 0,
    pendingMismatch: null,
    revealMode: false,
    paused: false,
    generation,
  }
}

function flipMemoryCard(state, cardId, config) {
  if (state.paused || state.revealMode || state.pendingMismatch || state.faceUp.includes(cardId))
    return state
  const card = state.cards.find((item) => item.id === cardId)
  if (!card || state.matchedPairIds.includes(card.pairId)) return state
  const faceUp = [...state.faceUp, cardId]
  if (faceUp.length === 1) return { ...state, faceUp }
  const first = state.cards.find((item) => item.id === faceUp[0])
  const attempts = state.attempts + 1
  if (first.pairId === card.pairId) {
    return {
      ...state,
      faceUp: [],
      attempts,
      score: state.score + config.matchPoints,
      matchedPairIds: [...state.matchedPairIds, card.pairId],
    }
  }
  if (config.mismatchDelayMs === 0) return { ...state, faceUp: [], attempts }
  return {
    ...state,
    faceUp,
    attempts,
    pendingMismatch: {
      cardIds: faceUp,
      remainingMs: config.mismatchDelayMs,
      generation: state.generation,
      token: attempts,
    },
  }
}

function memoryReducer(state, action, config, options = {}) {
  if (!action || (action.generation !== undefined && action.generation !== state.generation))
    return state
  switch (action.type) {
    case 'flip':
      return flipMemoryCard(state, action.cardId, config)
    case 'mismatch-expired': {
      const pending = state.pendingMismatch
      if (
        !pending ||
        state.paused ||
        action.generation !== pending.generation ||
        action.token !== pending.token
      )
        return state
      return {
        ...state,
        faceUp: state.faceUp.filter((id) => !pending.cardIds.includes(id)),
        pendingMismatch: null,
      }
    }
    case 'pause': {
      if (state.paused) return state
      let pendingMismatch = state.pendingMismatch
      if (pendingMismatch) {
        const remainingMs = action.remainingMs
        if (
          !Number.isFinite(remainingMs) ||
          remainingMs < 0 ||
          remainingMs > pendingMismatch.remainingMs
        )
          return state
        pendingMismatch = { ...pendingMismatch, remainingMs }
      }
      return { ...state, paused: true, pendingMismatch }
    }
    case 'resume':
      return state.paused ? { ...state, paused: false } : state
    case 'reveal':
      return state.revealMode
        ? state
        : { ...state, revealMode: true, faceUp: [], pendingMismatch: null }
    case 'reset':
      return createMemoryState(config, { ...options, generation: state.generation + 1 })
    default:
      return state
  }
}

module.exports = { createMemoryState, memoryReducer }
