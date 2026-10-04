const {
  createNamePickerState,
  reduceNamePicker,
} = require('revealjs-shared/src/education/games/name-picker.js')
function triggerRandomResult(room) {
  if (!room.picker) room.picker = createNamePickerState(room.config)
  const picked = reduceNamePicker(room.config, room.picker, { type: 'pick' })
  room.picker = reduceNamePicker(room.config, picked, { type: 'resolve' })
  const winner = room.picker.lastWinner
  if (!winner) return { winnerIndex: -1, winner: null }
  const winnerIndex = room.items.findIndex((row) => row.id === winner.id)
  if (room.config.excludeAfterPick) room.items = room.items.filter((row) => row.id !== winner.id)
  return {
    winnerIndex,
    winner: winner.label,
    winnerId: winner.id,
    diceValues: room.picker.diceValues,
  }
}
module.exports = { triggerRandomResult }
