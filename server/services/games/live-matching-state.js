const crypto = require('node:crypto')
const { createMatchingState } = require('revealjs-shared/src/education/games/matching.js')

function createLiveMatchingState(config) {
  const state = createMatchingState(config, { mode: 'live' })
  // Persist server-private presentation order at initialization, never during projection.
  state.targetOrder = config.pairs.map((row) => row.targetId)
  for (let i = state.targetOrder.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    const target = state.targetOrder[i]
    state.targetOrder[i] = state.targetOrder[j]
    state.targetOrder[j] = target
  }
  return state
}

module.exports = { createLiveMatchingState }
