const { createFlashcardsConfig } = require('./flashcards-config.js')
const { shuffleCardIds } = require('./card-content.js')

function createFlashcardsState(config, { random = Math.random, generation = 0 } = {}) {
  const canonical = createFlashcardsConfig(config)
  const ids = canonical.cards.map((card) => card.id)
  return {
    cards: canonical.cards,
    order: canonical.shuffleOnStart ? shuffleCardIds(ids, random) : ids,
    currentIndex: 0,
    side: 'front',
    studiedIds: [],
    generation,
  }
}

function flashcardsReducer(state, action, config, { random = Math.random } = {}) {
  if (!action || (action.generation !== undefined && action.generation !== state.generation))
    return state
  switch (action.type) {
    case 'flip': {
      const side = state.side === 'front' ? 'back' : 'front'
      const id = state.order[state.currentIndex]
      const studiedIds =
        side === 'back' && !state.studiedIds.includes(id)
          ? [...state.studiedIds, id]
          : state.studiedIds
      return { ...state, side, studiedIds }
    }
    case 'next':
    case 'previous': {
      const currentIndex = state.currentIndex + (action.type === 'next' ? 1 : -1)
      if (currentIndex < 0 || currentIndex >= state.order.length) return state
      return { ...state, currentIndex, side: 'front' }
    }
    case 'shuffle': {
      if (state.order.length < 2) return state
      const id = state.order[state.currentIndex]
      const order = shuffleCardIds(state.order, random)
      if (order.every((value, i) => value === state.order[i])) return state
      return { ...state, order, currentIndex: order.indexOf(id) }
    }
    case 'reset':
      return createFlashcardsState(config, { random, generation: state.generation + 1 })
    default:
      return state
  }
}

function getFlashcardsProgress(state) {
  return {
    position: state.currentIndex + 1,
    total: state.order.length,
    studied: state.studiedIds.length,
  }
}

module.exports = { createFlashcardsState, flashcardsReducer, getFlashcardsProgress }
