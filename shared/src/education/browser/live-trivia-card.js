const { node, button, listen } = require('./dom.js')
const { createLiveQuizCard } = require('./live-quiz-card.js')
const { interactive } = require('./live-player-form.js')
function createLiveTriviaCard(context) {
  const { root, transport, session } = context,
    document = root.ownerDocument
  const round = node(document, 'p'),
    buzz = button(document, 'Buzz in', 'trivia-buzz'),
    winner = node(document, 'p')
  root.append(round, buzz, winner)
  listen(session, buzz, 'click', () => {
    const state = transport.getSnapshot()
    if (!interactive(state) || state.buzz || state.trivia?.mode !== 'buzzer') return
    transport.emit('game-trivia-buzz', {})
  })
  const card = createLiveQuizCard(
    context,
    'game-trivia-answer',
    (state) =>
      (state.trivia?.mode !== 'buzzer' || state.buzz?.playerId === state.playerId) &&
      (state.trivia?.mode !== 'individual' || state.turn?.turnPlayerId === state.playerId) &&
      !state.ownSubmission?.result?.terminal
  )
  return {
    render(state) {
      round.textContent = `Round ${state.trivia?.roundConfigId || ''} · ${state.trivia?.mode || 'individual'} · ${state.trivia?.bonus || 'normal'}`
      buzz.hidden = state.trivia?.mode !== 'buzzer'
      buzz.disabled = !interactive(state) || Boolean(state.buzz)
      winner.textContent = state.buzz
        ? `${state.buzz.playerId === state.playerId ? 'You won' : `${state.players?.find((player) => player.playerId === state.buzz.playerId)?.name || state.buzz.playerId} won`} the buzz. Scores are awarded by the host server.`
        : ''
      card.render(state)
    },
    destroy: card.destroy,
  }
}
module.exports = { createLiveTriviaCard }
