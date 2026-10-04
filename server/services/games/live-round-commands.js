const corner = require('revealjs-shared/src/education/games/four-corners.js')
const relay = require('revealjs-shared/src/education/games/relay-race.js')
const trivia = require('revealjs-shared/src/education/games/trivia-champ.js')
const scatter = require('revealjs-shared/src/education/games/scattergories.js')
const { evaluateAnswer } = require('revealjs-shared/src/education/answer-evaluator.js')
const { inspectAttempt, commitAttempt } = require('./attempt-ledger')
const life = require('./room-lifecycle')
const { isId, token } = require('./room-store')
const roster = require('./round-roster')
const reducers = {
  'four-corners': corner.reduceFourCorners,
  'relay-race': relay.reduceRelayRace,
  'trivia-champ': trivia.reduceTriviaChamp,
  scattergories: scatter.reduceScattergories,
}
function prepareRelayTeams(room) {
  if (room.gameType === 'relay-race' && room.config.shuffleTeams) {
    const teams = [...room.config.teams]
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[teams[i], teams[j]] = [teams[j], teams[i]]
    }
    room.config = { ...room.config, teams }
    room.domain.activeTeamId = room.config.teams[0]?.id
  }
}
function setHolder(room) {
  const teamId = room.domain.activeTeamId
  const roster = room.roster.filter((id) => {
    const player = room.players.get(id)
    return player?.admitted && player.teamId === teamId
  })
  room.turnPlayerId = roster[(room.teamCursors[teamId] || 0) % roster.length] || null
}
function setTriviaHolder(room) {
  room.turnPlayerId = null
  if (room.config.rounds[room.domain.roundIndex]?.mode !== 'individual') return
  const eligible = room.roster.filter((id) => {
    const player = room.players.get(id)
    return (
      player?.admitted && player.socketId && room.teams.some((team) => team.id === player.teamId)
    )
  })
  room.turnPlayerId = eligible[room.triviaCursor % eligible.length] || null
  room.triviaCursor++
}
function transition(room, type, fields = {}, state = room.domain) {
  const beforeTurn = room.domain.turn,
    beforeQuestion = room.domain.questionId
  const command = {
    generation: room.generation,
    turn: state.turn,
    round: state.round,
    roundId: state.roundId,
    questionId: state.currentQuestion?.id || state.questionId,
    type,
    ...fields,
  }
  const next = reducers[room.gameType](room.config, state, command, {
    now: life.now,
    random: Math.random,
  })
  if (next === state) return { error: 'invalid-transition' }
  if (next.error && type !== 'deadline') return { error: next.error }
  if (room.gameType === 'relay-race' && type === 'baton')
    room.teamCursors[state.activeTeamId] = (room.teamCursors[state.activeTeamId] || 0) + 1
  room.domain = next
  room.phase = next.phase
  room.status = next.phase === 'ended' ? 'finished' : 'active'
  if (
    next.turn !== beforeTurn ||
    next.questionId !== beforeQuestion ||
    type === 'start-round' ||
    type === 'start'
  ) {
    room.roundId++
    room.buzz = null
    room.attempts.clear()
    for (const player of room.players.values()) player.ownSubmission = null
    if (['guessing', 'active', 'playing'].includes(next.phase)) roster.promote(room)
    if (room.gameType === 'relay-race') setHolder(room)
    if (room.gameType === 'trivia-champ') setTriviaHolder(room)
  }
  if (room.gameType === 'four-corners')
    for (const player of room.players.values()) player.score = next.scores[player.playerId] || 0
  const deadline =
    next.phase === 'waiting'
      ? next.batonDue
      : ['guessing', 'active', 'playing'].includes(next.phase)
        ? next.deadline
        : null
  life.armRound(room, deadline, (current) => {
    if (current.gameType === 'four-corners') transition(current, 'reveal')
    else if (current.gameType === 'relay-race' && current.domain.phase === 'waiting')
      transition(current, 'baton')
    else transition(current, 'deadline')
  })
  if (next.phase === 'ended') life.endGame(room.gameId)
  return { result: { phase: room.phase } }
}
const assignTeam = roster.assignTeam
function start(room, payload) {
  if (
    room.gameType === 'trivia-champ' &&
    payload.roundConfigId &&
    payload.roundConfigId !== room.config.rounds[room.domain.roundIndex + 1]?.id
  )
    return { error: 'invalid-round-config' }
  if (room.status === 'waiting') {
    if (room.domain.phase !== 'setup') return { error: 'invalid-transition' }
    if (
      room.teams.length &&
      [...room.players.values()].some((player) => player.role !== 'host' && !player.teamId)
    )
      return { error: 'unassigned-player' }
    prepareRelayTeams(room)
  }
  if (room.gameType === 'four-corners') return transition(room, 'start-round')
  if (room.gameType === 'scattergories' && room.domain.phase === 'review') {
    const prepared = scatter.reduceScattergories(
      room.config,
      room.domain,
      { type: 'new-round', generation: room.generation, round: room.domain.round },
      { now: life.now }
    )
    const outcome = transition(room, 'start', { letter: payload.letter }, prepared)
    if (!outcome.error) room.scatterSubmissions.clear()
    return outcome
  }
  return transition(room, 'start', { letter: payload.letter })
}
function playerCommand(room, event, payload, player) {
  if (!roster.eligible(room, player)) return { error: 'waiting-next-round' }
  if (room.deadlineMs !== null && life.now() >= room.deadlineMs) return { error: 'round-expired' }
  if (event === 'game-fourcorners-choice') {
    if (!room.domain.currentQuestion?.options.some((option) => option.id === payload.cornerId))
      return { error: 'invalid-corner' }
    if (player.ownSubmission) return { error: 'already-submitted' }
    const outcome = transition(room, 'vote', {
      participantId: player.playerId,
      cornerId: payload.cornerId,
    })
    if (!outcome.error)
      player.ownSubmission = { commandId: payload.commandId, cornerId: payload.cornerId }
    return outcome
  }
  if (event === 'game-trivia-buzz') {
    if (room.buzz) return { error: 'buzz-already-awarded' }
    const outcome = transition(room, 'buzz', { teamId: player.teamId })
    if (!outcome.error) {
      room.buzz = { playerId: player.playerId, teamId: player.teamId }
      room.turnPlayerId = player.playerId
    }
    return outcome
  }
  if (room.gameType === 'scattergories') return scatterSubmit(room, payload, player)
  if (room.gameType === 'relay-race' && room.turnPlayerId !== player.playerId)
    return { error: 'not-turn-holder' }
  if (
    room.gameType === 'trivia-champ' &&
    room.config.rounds[room.domain.roundIndex].mode === 'buzzer' &&
    room.buzz?.playerId !== player.playerId
  )
    return { error: 'not-buzz-winner' }
  if (
    room.gameType === 'trivia-champ' &&
    room.config.rounds[room.domain.roundIndex]?.mode === 'individual' &&
    room.turnPlayerId !== player.playerId
  )
    return { error: 'not-turn-holder' }
  const question = room.questions.find((row) => row.id === room.domain.questionId)
  if (payload.questionId !== question?.id || !isId(payload.attemptId))
    return { error: 'stale-question' }
  const attempt = inspectAttempt(room, player.playerId, payload, payload.answer)
  if (attempt.error || attempt.duplicate) return attempt
  const evaluation = evaluateAnswer(question, payload.answer)
  if (!evaluation.valid) return { error: evaluation.error }
  const outcome = transition(room, 'answer', { teamId: player.teamId, answer: payload.answer })
  if (!outcome.error) {
    const result = { accepted: true, valid: true, correct: evaluation.correct, terminal: true }
    commitAttempt(room, attempt, result)
    player.ownSubmission = {
      commandId: payload.commandId,
      questionId: question.id,
      attemptId: payload.attemptId,
      answer: structuredClone(payload.answer),
      result,
    }
    outcome.result = result
  }
  return outcome
}
function scatterSubmit(room, payload, player) {
  if (room.domain.phase !== 'playing') return { error: 'scatter-not-active' }
  const submitter = room.roster.find((id) => {
    const member = room.players.get(id)
    return roster.eligible(room, member) && member.teamId === player.teamId
  })
  if (submitter !== player.playerId) return { error: 'not-team-submitter' }
  if (room.scatterSubmissions.has(player.teamId)) return { error: 'already-submitted' }
  if (
    !Array.isArray(payload.entries) ||
    !payload.entries.length ||
    payload.entries.length > room.config.categories.length
  )
    return { error: 'invalid-scatter-entry' }
  const seen = new Set(),
    entries = []
  for (const entry of payload.entries) {
    if (
      !room.config.categories.some((row) => row.id === entry?.categoryId) ||
      seen.has(entry.categoryId) ||
      typeof entry.text !== 'string' ||
      entry.text.length > 256 ||
      !entry.text.trim()
    )
      return { error: 'invalid-scatter-entry' }
    const text = entry.text.trim().normalize('NFC')
    seen.add(entry.categoryId)
    if (!text.toLowerCase().startsWith(room.domain.letter.toLowerCase()))
      return { error: 'wrong-initial-letter' }
    entries.push({ categoryId: entry.categoryId, text })
  }
  const acceptedAt = life.now()
  let next = room.domain
  for (const entry of entries) {
    const candidate = scatter.reduceScattergories(
      room.config,
      next,
      {
        type: 'answer',
        generation: room.generation,
        round: next.round,
        teamId: player.teamId,
        ...entry,
      },
      { now: () => acceptedAt }
    )
    if (candidate === next || candidate.error || candidate.phase !== 'playing')
      return { error: 'scatter-not-active' }
    next = candidate
  }
  room.domain = next
  const submission = { submissionId: token(), entries, teamId: player.teamId }
  room.scatterSubmissions.set(player.teamId, submission)
  player.ownSubmission = {
    commandId: payload.commandId,
    submissionId: submission.submissionId,
    entries,
  }
  return { result: { submissionId: submission.submissionId } }
}
function adjudicateScatter(room, payload) {
  const submission = [...room.scatterSubmissions.values()].find(
    (row) => row.submissionId === payload.submissionId
  )
  if (
    !submission ||
    typeof payload.valid !== 'boolean' ||
    !submission.entries.some((row) => row.categoryId === payload.categoryId)
  )
    return { error: 'invalid-adjudication' }
  return transition(room, 'adjudicate', {
    teamId: submission.teamId,
    categoryId: payload.categoryId,
    valid: payload.valid,
  })
}
module.exports = { transition, assignTeam, start, playerCommand, adjudicateScatter }
