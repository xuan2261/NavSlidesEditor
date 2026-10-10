const { node } = require('./dom.js')
const { createLiveQuizCard } = require('./live-quiz-card.js')
function createLiveRelayCard(context) {
  const lane = node(context.root.ownerDocument, 'p'),
    turn = node(context.root.ownerDocument, 'p')
  context.root.append(lane, turn)
  const card = createLiveQuizCard(
    context,
    'game-relay-answer',
    (state) => state.turn?.turnPlayerId === state.playerId && !state.ownSubmission?.result?.terminal
  )
  return {
    render(state) {
      const positions = state.relay?.positions || {}
      lane.textContent = Object.entries(positions)
        .map(
          ([id, position]) =>
            `${state.teams?.find((team) => team.id === id)?.name || id}: ${position} / ${state.relay.goal}`
        )
        .join(' · ')
      const holder = state.players?.find((player) => player.playerId === state.turn?.turnPlayerId)
      turn.textContent =
        state.turn?.turnPlayerId === state.playerId
          ? 'Your turn — answer to move your team.'
          : `Waiting for ${holder?.name || state.turn?.turnPlayerId || 'the next runner'}.`
      card.render(state)
    },
    destroy: card.destroy,
  }
}
module.exports = { createLiveRelayCard }
