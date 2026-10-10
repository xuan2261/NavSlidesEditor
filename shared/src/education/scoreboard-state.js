const { createUtilityConfig, isCurrentCommand } = require('./utility-config.js')

function createScoreboardState(config) {
  const authored = createUtilityConfig('scoreboard', config)
  return {
    scores: Object.fromEntries(
      authored.teams
        .filter((team) => team.variableId === undefined)
        .map((team) => [team.id, team.initialScore])
    ),
    generation: 0,
  }
}
function reduceScoreboard(config, state, command) {
  if (!isCurrentCommand(state, command)) return state
  if (command.type === 'reset')
    return { ...createScoreboardState(config), generation: state.generation + 1 }
  if (command.type !== 'change') return state
  const team = config.teams.find((item) => item.id === command.teamId)
  if (!team) throw new RangeError('Choose an authored scoreboard team.')
  if (command.direction !== 1 && command.direction !== -1)
    throw new RangeError('Score direction must be +1 or -1.')
  // Bound scores belong only to the document variable store, never this session.
  if (team.variableId !== undefined) return state
  const score = state.scores[team.id]
  if (!Number.isFinite(score) || score < config.minScore || score > config.maxScore)
    throw new RangeError('Team score is outside its authored bounds.')
  const next = Math.min(
    config.maxScore,
    Math.max(config.minScore, score + command.direction * config.step)
  )
  return next === score ? state : { ...state, scores: { ...state.scores, [team.id]: next } }
}
module.exports = { createScoreboardState, reduceScoreboard }
