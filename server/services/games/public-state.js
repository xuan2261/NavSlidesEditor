const {
  projectPublicQuestion,
} = require('revealjs-shared/src/education/question-public-projection.js')
const { projectQuizFeedback } = require('./quiz-public-feedback')
const { calculateWagerLimits } = require('revealjs-shared/src/education/games/jeopardy.js')
const { envelope } = require('./command-ledger')
const { leaderboard } = require('./player-membership')
const engagement = require('./engagement-commands'),
  jeopardy = require('./jeopardy-commands'),
  life = require('./room-lifecycle')
const { scatterRows } = require('./scatter-public-rows')
const roster = require('./round-roster')
function currentQuestion(room) {
  return (
    room.domain?.currentQuestion ||
    room.domain?.activeQuestion ||
    room.questions.find((question) => question.id === room.domain?.questionId) ||
    room.questions[room.currentQuestion] ||
    null
  )
}
function teamState(room) {
  return room.teams.map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    score: room.domain?.scores?.[team.id] || 0,
    playerIds: [...room.players.values()]
      .filter((player) => player.role !== 'host' && player.teamId === team.id)
      .map((player) => player.playerId),
  }))
}
function getPublicState(room, playerId) {
  const question = currentQuestion(room),
    player = room.players.get(playerId),
    state = room.domain
  const revealed = room.revealed || state?.revealed || ['revealed', 'review'].includes(room.phase)
  const snapshot = {
    ...envelope(room),
    gameType: room.gameType,
    phase: room.phase,
    status: room.status,
    stateVersion: room.stateVersion,
    serverTimeMs: Date.now(),
    timeRemainingMs: room.deadlineMs === null ? null : Math.max(0, room.deadlineMs - life.now()),
    question: question ? projectPublicQuestion(question) : null,
    teams: teamState(room),
    turn: {
      activeTeamId: state?.activeTeamId || room.players.get(room.turnPlayerId)?.teamId || null,
      turnPlayerId: room.turnPlayerId,
    },
    buzz: room.buzz ? { ...room.buzz } : null,
    ownSubmission: player?.ownSubmission ? structuredClone(player.ownSubmission) : null,
    ownEligible: roster.eligible(room, player),
    rosterWindow: roster.assignmentOpen(room),
    leaderboard: leaderboard(room),
    players: [...room.players.values()].map((row) => ({
      playerId: row.playerId,
      name: row.name,
      score: row.score,
      teamId: row.teamId,
      isHost: row.role === 'host',
      eligible: roster.eligible(room, row),
      pending: row.role !== 'host' && roster.usesRoster(room) && !roster.eligible(room, row),
    })),
    revealed:
      revealed && question
        ? {
            question: {
              answerKey: structuredClone(question.answerKey),
              explanation: question.feedback?.explanation || '',
            },
          }
        : null,
  }
  if (room.gameType === 'hot-potato') snapshot.allowLate = room.allowLate
  if (room.gameType === 'quiz')
    snapshot.quiz = {
      showScore: room.config.showScore,
      feedbackMode: room.config.feedbackMode,
      attemptLimit: room.config.attemptLimit,
    }
  if (room.gameType === 'quiz' && question && player?.quiz) {
    const projection = projectQuizFeedback(
      room,
      question,
      player.quiz,
      snapshot.ownSubmission.result
    )
    snapshot.ownSubmission.result = projection.result
    if (projection.reveal) snapshot.ownSubmission.reveal = projection.reveal
  }
  if (room.gameType === 'four-corners')
    snapshot.corners = {
      options: snapshot.question?.options || [],
      eliminated: [...state.eliminated],
    }
  if (room.gameType === 'relay-race')
    snapshot.relay = { positions: { ...state.positions }, goal: room.config.questionsPerRound }
  if (room.gameType === 'trivia-champ')
    snapshot.trivia = {
      roundConfigId: state.roundId,
      mode: room.config.rounds[state.roundIndex]?.mode || null,
      bonus: state.bonus,
    }
  if (room.gameType === 'scattergories') {
    snapshot.scatter = {
      letter: state.letter,
      categories: room.config.categories.map((row) => ({ id: row.id, label: row.label })),
      submitterPlayerId: roster.eligible(room, player)
        ? room.roster.find((id) => {
            const member = room.players.get(id)
            return roster.eligible(room, member) && member.teamId === player.teamId
          }) || null
        : null,
    }
    if (revealed)
      snapshot.revealed = {
        answers: structuredClone(state.answers),
        results: structuredClone(state.results),
        submissions: [...room.scatterSubmissions.values()].map((row) => structuredClone(row)),
        validity: structuredClone(state.validity || {}),
        rows: scatterRows(room),
      }
  }
  if (room.gameType === 'jeopardy')
    snapshot.jeopardy = {
      cells: jeopardy
        .cells(room)
        .map((cell) => ({
          cellId: cell.cellId,
          categoryId: cell.categoryId,
          points: cell.question.points,
          used: state.usedCellIds.includes(cell.cellId),
        })),
      categories: room.config.categories.map((row) => ({ id: row.id, title: row.title })),
      activeCellId: state.activeCellId,
      isDailyDouble: state.isDailyDouble,
      wager: state.currentWager,
      wagerLimits: calculateWagerLimits(
        state.scores[state.activeTeamId] || 0,
        room.config.wagerLimit
      ),
    }
  if (room.gameType === 'poll') snapshot.poll = engagement.pollAggregate(room)
  if (room.gameType === 'word-cloud') snapshot.wordCloud = engagement.cloudAggregate(room)
  if (room.gameType === 'matching') {
    snapshot.matching = engagement.matchingState(room)
    if (room.engagement.revealed) snapshot.revealed = { answerKey: snapshot.matching.answerKey }
  }
  if (room.gameType === 'name-picker')
    snapshot.picker = room.picker
      ? {
          phase: room.picker.phase,
          winner: room.picker.lastWinner,
          diceValues: room.picker.diceValues,
        }
      : { phase: 'ready', winner: null }
  return snapshot
}
module.exports = { getPublicState, currentQuestion, teamState }
