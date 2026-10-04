const { createUtilityConfig, isCurrentCommand } = require('./utility-config.js')
const { pickWeightedItem } = require('./weighted-picker.js')

function createLuckyWheelState(config) {
  const authored = createUtilityConfig('lucky-wheel', config)
  return {
    phase: 'idle',
    poolIds: authored.items.map((item) => item.id),
    result: null,
    turn: 0,
    wheelAngle: 0,
    generation: 0,
  }
}
function reduceLuckyWheel(config, state, command, { random = Math.random } = {}) {
  if (!isCurrentCommand(state, command)) return state
  if (command.type === 'reset')
    return { ...createLuckyWheelState(config), generation: state.generation + 1 }
  if (command.type === 'spin') {
    if (state.phase !== 'idle' || !state.poolIds.length) return state
    const available = new Set(state.poolIds)
    const selected = pickWeightedItem(config.items, {
      weighted: config.weighted !== false,
      random,
      excludedIds: config.items.filter((item) => !available.has(item.id)).map((item) => item.id),
    })
    if (!selected) return { ...state, phase: 'exhausted' }
    const index = config.items.findIndex((item) => item.id === selected.id)
    const target = 360 - ((index + 0.5) * 360) / config.items.length
    const current = state.wheelAngle % 360
    const wheelAngle = state.wheelAngle + 1080 + ((target - current + 360) % 360)
    return {
      ...state,
      phase: 'spinning',
      turn: state.turn + 1,
      wheelAngle,
      result: { id: selected.id, label: selected.label },
      poolIds: config.removeAfterPick
        ? state.poolIds.filter((id) => id !== selected.id)
        : state.poolIds,
    }
  }
  if (command.type === 'finish' && state.phase === 'spinning' && command.turn === state.turn) {
    return { ...state, phase: state.poolIds.length ? 'idle' : 'exhausted' }
  }
  return state
}
module.exports = { createLuckyWheelState, reduceLuckyWheel }
