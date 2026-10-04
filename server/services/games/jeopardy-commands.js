const {
  reduceJeopardy,
  calculateWagerLimits,
} = require('revealjs-shared/src/education/games/jeopardy.js')
const life = require('./room-lifecycle')
function cells(room) {
  return room.config.categories.flatMap((category) =>
    category.questions.map((question) => ({
      cellId: question.id,
      categoryId: category.id,
      question,
    }))
  )
}
function command(room, event, payload) {
  const state = room.domain
  let mutation
  if (event === 'game-jeopardy-select') {
    if (state.phase !== 'board') return { error: 'cell-active' }
    const cell = cells(room).find((row) => row.cellId === payload.cellId)
    if (!cell) return { error: 'unknown-cell' }
    if (state.usedCellIds.includes(cell.cellId)) return { error: 'cell-used' }
    if (payload.teamId !== undefined) {
      if (!room.teams.some((team) => team.id === payload.teamId)) return { error: 'unknown-team' }
      room.domain = reduceJeopardy(
        room.config,
        state,
        { type: 'select-team', generation: room.generation, teamId: payload.teamId },
        { now: life.now }
      )
    }
    mutation = {
      type: 'select-cell',
      cellId: cell.cellId,
      question: cell.question,
      isDailyDouble: room.config.dailyDouble.includes(cell.cellId),
    }
  } else if (event === 'game-jeopardy-wager') {
    if (
      state.phase !== 'wager' ||
      typeof payload.amount !== 'number' ||
      !Number.isFinite(payload.amount) ||
      !Number.isInteger(payload.amount)
    )
      return { error: 'invalid-wager' }
    const limits = calculateWagerLimits(state.scores[state.activeTeamId], room.config.wagerLimit)
    if (payload.amount < limits.min || payload.amount > limits.max)
      return { error: 'invalid-wager' }
    mutation = { type: 'submit-wager', wager: payload.amount }
  } else if (event === 'game-jeopardy-reveal') mutation = { type: 'reveal' }
  else if (event === 'game-jeopardy-adjudicate') {
    if (!state.revealed || typeof payload.correct !== 'boolean')
      return { error: 'invalid-adjudication' }
    mutation = { type: 'adjudicate', correct: payload.correct }
  } else return { error: 'unsupported-command' }
  const next = reduceJeopardy(
    room.config,
    room.domain,
    { ...mutation, generation: room.generation, activeCellId: room.domain.activeCellId },
    { now: life.now }
  )
  if (next === room.domain) return { error: 'invalid-transition' }
  room.domain = next
  room.phase = next.phase
  room.status = 'active'
  if (mutation.type === 'select-cell') room.roundId++
  if (
    next.phase === 'question' &&
    (mutation.type === 'select-cell' || mutation.type === 'submit-wager')
  ) {
    life.armRound(room, life.now() + room.config.timerDuration * 1000, (current) => {
      current.domain = reduceJeopardy(
        current.config,
        current.domain,
        {
          type: 'reveal',
          generation: current.generation,
          activeCellId: current.domain.activeCellId,
        },
        { now: life.now }
      )
      current.phase = current.domain.phase
    })
  } else if (next.phase !== 'question') life.cancelRound(room)
  if (next.usedCellIds.length === cells(room).length) life.endGame(room.gameId)
  return { result: { phase: room.phase, cellId: next.activeCellId } }
}
module.exports = { cells, command }
