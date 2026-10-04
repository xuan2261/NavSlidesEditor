const { node } = require('./dom.js')
function createLiveNamePickerCard({ root }) {
  const document = root.ownerDocument,
    title = node(document, 'h2', 'Name picker'),
    winner = node(document, 'p'),
    dice = node(document, 'p')
  root.append(title, winner, dice)
  return {
    render(state) {
      winner.textContent = state.picker?.winner
        ? `Selected: ${state.picker.winner.label}`
        : state.picker?.phase === 'picking'
          ? 'The host is choosing…'
          : 'Waiting for the host to choose.'
      dice.textContent = state.picker?.diceValues?.length
        ? `Dice: ${state.picker.diceValues.join(' + ')}`
        : ''
    },
  }
}
module.exports = { createLiveNamePickerCard }
