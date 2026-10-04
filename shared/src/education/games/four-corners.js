const { isId } = require('../question-shape.js')
const { makeAwardKey } = require('../game-score-policy.js')
function createFourCornersState(config) {
  return {
    gameType: 'four-corners',
    phase: 'setup',
    questionIndex: -1,
    currentQuestion: null,
    votes: {},
    eliminated: [],
    scores: {},
    roundCount: config.questions.length,
    awardedKeys: [],
    deadline: null,
  }
}
function reduceFourCorners(config, state, command, { now = Date.now } = {}) {
  if (!command || (command.generation !== undefined && command.generation !== state.generation))
    return state
  if (command.type === 'start-round') {
    if (!['setup', 'revealed'].includes(state.phase)) return state
    const index = state.questionIndex + 1,
      question = config.questions[index]
    if (!question) return { ...state, phase: 'ended', currentQuestion: null, deadline: null }
    return {
      ...state,
      phase: 'guessing',
      questionIndex: index,
      currentQuestion: question,
      votes: {},
      eliminated: [],
      deadline: question.timeLimit === null ? null : now() + config.timerDuration * 1000,
    }
  }
  if (command.questionId !== undefined && command.questionId !== state.currentQuestion?.id)
    return state
  if (command.type === 'end')
    return state.phase === 'ended' ? state : { ...state, phase: 'ended', deadline: null }
  if (state.phase !== 'guessing') return state
  if (command.type === 'vote') {
    const { participantId, cornerId } = command
    if (
      !isId(participantId) ||
      !state.currentQuestion.options.some((option) => option.id === cornerId) ||
      state.eliminated.includes(participantId) ||
      (state.deadline !== null && now() >= state.deadline) ||
      (Object.hasOwn(state.votes, participantId) && state.votes[participantId] === cornerId)
    )
      return state
    return { ...state, votes: { ...state.votes, [participantId]: cornerId } }
  }
  if (command.type !== 'reveal' && command.type !== 'deadline') return state
  if (command.type === 'deadline' && (state.deadline === null || now() < state.deadline))
    return state
  const question = state.currentQuestion,
    scores = { __proto__: null, ...state.scores },
    eliminated = [],
    awardedKeys = [...state.awardedKeys]
  for (const [participantId, cornerId] of Object.entries(state.votes)) {
    if (cornerId === question.answerKey.optionId) {
      const key = makeAwardKey({
        generation: state.generation ?? 0,
        gameType: 'four-corners',
        contextId: JSON.stringify([question.id, participantId]),
        awardKind: 'correct',
      })
      if (!awardedKeys.includes(key)) {
        scores[participantId] =
          (Object.hasOwn(scores, participantId) ? scores[participantId] : 0) + question.points
        awardedKeys.push(key)
      }
    } else if (config.eliminateMode === 'wrong') eliminated.push(participantId)
  }
  return { ...state, phase: 'revealed', scores, eliminated, awardedKeys, deadline: null }
}
module.exports = { createFourCornersState, reduceFourCorners }
