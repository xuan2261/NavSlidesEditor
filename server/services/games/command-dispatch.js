const store = require('./room-store'),
  ledger = require('./command-ledger'),
  life = require('./room-lifecycle')
const quiz = require('./quiz-commands'),
  engagement = require('./engagement-commands'),
  rounds = require('./live-round-commands')
const jeopardy = require('./jeopardy-commands'),
  picker = require('./picker-commands'),
  { resetRoom } = require('./room-config')
const hostEvents = new Set([
  'game-next',
  'game-end',
  'game-random',
  'game-reset',
  'game-team-assign',
  'game-quiz-reveal',
  'game-poll-start',
  'game-poll-reveal',
  'game-word-cloud-start',
  'game-word-cloud-reveal',
  'game-word-cloud-clear',
  'game-matching-start',
  'game-matching-reveal',
  'game-fourcorners-start',
  'game-fourcorners-reveal',
  'game-relay-start',
  'game-relay-next',
  'game-trivia-start',
  'game-trivia-next',
  'game-trivia-reveal',
  'game-trivia-bonus',
  'game-scatter-start',
  'game-scatter-reveal',
  'game-scatter-adjudicate',
  'game-jeopardy-select',
  'game-jeopardy-wager',
  'game-jeopardy-reveal',
  'game-jeopardy-adjudicate',
])
const playerEvents = new Set([
  'game-answer',
  'game-poll-submit',
  'game-word-cloud-submit',
  'game-matching-submit',
  'game-fourcorners-choice',
  'game-relay-answer',
  'game-trivia-buzz',
  'game-trivia-answer',
  'game-scatter-submit',
])
const typeForEvent = (event) =>
  event.startsWith('game-fourcorners-')
    ? 'four-corners'
    : event.startsWith('game-relay-')
      ? 'relay-race'
      : event.startsWith('game-trivia-')
        ? 'trivia-champ'
        : event.startsWith('game-scatter-')
          ? 'scattergories'
          : event.startsWith('game-jeopardy-')
            ? 'jeopardy'
            : event.startsWith('game-word-cloud-')
              ? 'word-cloud'
              : event.startsWith('game-matching-')
                ? 'matching'
                : event.startsWith('game-poll-')
                  ? 'poll'
                  : null
function hostCommand(room, event, payload) {
  if (event === 'game-reset') {
    resetRoom(room)
    return { result: { phase: room.phase } }
  }
  if (event === 'game-team-assign') return rounds.assignTeam(room, payload)
  if (event === 'game-end') {
    life.endGame(room.gameId)
    return { result: { finalScores: require('./player-membership').leaderboard(room) } }
  }
  if (event === 'game-random')
    return room.gameType === 'name-picker'
      ? { result: picker.triggerRandomResult(room) }
      : { error: 'wrong-game-type' }
  if (event === 'game-next') {
    if (!['quiz', 'hot-potato'].includes(room.gameType)) return { error: 'wrong-game-type' }
    quiz.nextQuestion(room)
    return { result: { phase: room.phase } }
  }
  if (event === 'game-quiz-reveal') {
    if (
      !['quiz', 'hot-potato'].includes(room.gameType) ||
      room.currentQuestion < 0 ||
      room.status !== 'active'
    )
      return { error: 'invalid-transition' }
    room.phase = 'review'
    room.revealed = true
    life.cancelRound(room)
    return { result: { phase: room.phase } }
  }
  if (room.engagement) {
    if (event.endsWith('-start')) return engagement.start(room)
    if (event.endsWith('-clear')) return engagement.apply(room, 'clear')
    return engagement.apply(room, 'reveal')
  }
  if (room.gameType === 'jeopardy') return jeopardy.command(room, event, payload)
  if (event.endsWith('-start')) return rounds.start(room, payload)
  if (event === 'game-scatter-adjudicate') return rounds.adjudicateScatter(room, payload)
  if (event === 'game-trivia-bonus') return rounds.transition(room, 'bonus', { mode: payload.mode })
  if (event === 'game-relay-next') {
    if (room.domain.phase === 'active') return rounds.transition(room, 'pass')
    return rounds.transition(room, 'baton')
  }
  if (event === 'game-trivia-next') return rounds.transition(room, 'next')
  if (event === 'game-fourcorners-reveal') return rounds.transition(room, 'reveal')
  if (event === 'game-scatter-reveal') return rounds.transition(room, 'review')
  if (event === 'game-trivia-reveal') {
    if (room.domain.phase !== 'active') return { error: 'invalid-transition' }
    room.domain = { ...room.domain, phase: 'review' }
    room.phase = 'review'
    life.cancelRound(room)
    return { result: { phase: room.phase } }
  }
  return { error: 'unsupported-command' }
}
function command(event, payload, actor) {
  const room = store.rooms.get(payload?.gameId)
  if (!hostEvents.has(event) && !playerEvents.has(event))
    return { accepted: false, error: 'unsupported-command' }
  const validated = ledger.validate(room, event, payload, actor, hostEvents.has(event))
  if (validated.error)
    return room
      ? ledger.receipt(room, payload, { error: validated.error })
      : { accepted: false, error: validated.error }
  if (validated.duplicate)
    return {
      ...validated.receipt,
      ...ledger.envelope(room),
      stateVersion: room.stateVersion,
      duplicate: true,
    }
  if (
    room.status === 'finished' &&
    ![
      'game-reset',
      'game-end',
      'game-poll-start',
      'game-word-cloud-start',
      'game-matching-start',
    ].includes(event)
  )
    return ledger.receipt(room, payload, { error: 'game-ended' })
  const expectedType = typeForEvent(event)
  let outcome
  if (expectedType && expectedType !== room.gameType) outcome = { error: 'wrong-game-type' }
  else if (hostEvents.has(event)) outcome = hostCommand(room, event, payload)
  else {
    const player = room.players.get(actor.playerId)
    outcome =
      event === 'game-answer'
        ? ['quiz', 'hot-potato'].includes(room.gameType)
          ? quiz.submitQuiz(room, player, payload)
          : { error: 'wrong-game-type' }
        : room.engagement
          ? engagement.submit(room, payload, player)
          : rounds.playerCommand(room, event, payload, player)
  }
  if (!outcome.error && !outcome.duplicate) room.stateVersion++
  const result = ledger.receipt(room, payload, outcome)
  ledger.record(room, validated, result)
  if (!outcome.error && !outcome.duplicate) store.publish(room)
  return result
}
module.exports = { command, hostEvents, playerEvents }
