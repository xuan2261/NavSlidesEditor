const { pickWeightedItem } = require('../weighted-picker.js')
const DIE_FACES = Object.freeze(
  Array.from({ length: 6 }, (_, i) => Object.freeze({ id: String(i + 1), value: i + 1 }))
)
function createNamePickerState(config) {
  return {
    mode: config.pickerMode,
    phase: 'ready',
    picks: 0,
    excludedIds: [],
    lastWinner: null,
    diceValues: [],
    pending: null,
    wheelAngle: 0,
  }
}
function reduceNamePicker(config, state, command, { random = Math.random } = {}) {
  if (command.type === 'mode') {
    if (state.phase === 'picking' || !['wheel', 'dice', 'button'].includes(command.mode))
      return state
    return { ...state, mode: command.mode, lastWinner: null, diceValues: [] }
  }
  if (command.type === 'pick') {
    if (state.phase === 'picking' || state.phase === 'exhausted') return state
    const winner = pickWeightedItem(config.items, {
      random,
      weighted: config.weighted,
      excludedIds: state.excludedIds,
    })
    if (!winner) return { ...state, phase: 'exhausted' }
    const diceValues =
      state.mode === 'dice'
        ? Array.from(
            { length: config.diceCount },
            () => pickWeightedItem(DIE_FACES, { random }).value
          )
        : []
    const winnerIndex = config.items.findIndex((item) => item.id === winner.id)
    const angle =
      360 - ((winnerIndex + 0.5) * 360) / Math.max(config.items.length, config.wheelSegments)
    const wheelAngle = Math.floor(state.wheelAngle / 360) * 360 + 1440 + angle
    return {
      ...state,
      phase: 'picking',
      lastWinner: null,
      diceValues: [],
      wheelAngle,
      pending: { winner: { id: winner.id, label: winner.label }, diceValues },
    }
  }
  if (command.type === 'resolve' && state.phase === 'picking') {
    const excludedIds = config.excludeAfterPick
      ? [...state.excludedIds, state.pending.winner.id]
      : state.excludedIds
    return {
      ...state,
      phase: excludedIds.length === config.items.length ? 'exhausted' : 'result',
      picks: state.picks + 1,
      lastWinner: state.pending.winner,
      diceValues: state.pending.diceValues,
      excludedIds,
      pending: null,
    }
  }
  return state
}
module.exports = { createNamePickerState, reduceNamePicker }
