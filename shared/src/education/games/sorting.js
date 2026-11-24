const {
  createAssignmentState,
  reduceAssignment,
  assignmentAnswer,
} = require('../assignment-state.js')
const { sortingAssignmentConfig, evaluateSortingAnswer } = require('../sorting-config.js')

function createSortingState() {
  return {
    gameType: 'sorting',
    phase: 'active',
    assignment: createAssignmentState(),
    attempts: 0,
    score: 0,
    feedback: null,
    error: null,
  }
}

function reduceSorting(config, state, command) {
  if (!command || (command.generation !== undefined && command.generation !== state.generation))
    return state
  if (state.phase !== 'active') return state
  if (['select', 'assign', 'clear', 'cancel'].includes(command.type)) {
    const assignment = reduceAssignment(sortingAssignmentConfig(config), state.assignment, command)
    if (assignment === state.assignment) return state
    return { ...state, assignment, feedback: null, error: assignment.error }
  }
  if (command.type !== 'submit') return state
  const result = evaluateSortingAnswer(config, {
    assignments: assignmentAnswer(state.assignment, 'itemId', 'bucketId'),
  })
  if (!result.valid) return { ...state, error: result.error }
  const attempts = state.attempts + 1
  return {
    ...state,
    attempts,
    feedback: result.correct ? 'correct' : 'incorrect',
    error: null,
    score: result.correct ? config.points : state.score,
    phase: result.correct ? 'complete' : attempts >= config.attemptLimit ? 'exhausted' : 'active',
  }
}

module.exports = { createSortingState, reduceSorting }
