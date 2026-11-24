const {
  createAssignmentState,
  reduceAssignment,
  assignmentAnswer,
} = require('../assignment-state.js')
const { createCanonicalQuestion } = require('../question-factory.js')
const { evaluateAnswer } = require('../answer-evaluator.js')
const {
  initialSubmissionState,
  stale,
  rosterCommand,
  startSubmission,
  activeError,
  actionReceipt,
  accept,
  reject,
  expiry,
} = require('./poll-submission-state.js')
function createMatchingState(config, { mode = 'local' } = {}) {
  const initial = initialSubmissionState('matching', config)
  const targets = config.pairs.map((row) => row.targetId)
  return {
    ...initial,
    mode,
    assignment: createAssignmentState(),
    submissions: [],
    revealed: false,
    targetOrder: [...targets.slice(1), targets[0]],
  }
}
function matchingPairs(config, submitted) {
  if (!Array.isArray(submitted)) return null
  const prompts = new Set(config.pairs.map((row) => row.promptId)),
    targets = new Set(config.pairs.map((row) => row.targetId))
  const seenPrompts = new Set(),
    seenTargets = new Set(),
    pairs = []
  for (const row of submitted) {
    const promptId = String(row?.promptId || ''),
      targetId = String(row?.targetId || '')
    if (
      !prompts.has(promptId) ||
      !targets.has(targetId) ||
      seenPrompts.has(promptId) ||
      seenTargets.has(targetId)
    )
      return null
    seenPrompts.add(promptId)
    seenTargets.add(targetId)
    pairs.push({ promptId, targetId })
  }
  return pairs
}
function evaluateLocalMatching(config, pairs) {
  const question = createCanonicalQuestion({
    id: 'local-matching',
    kind: 'matching',
    prompt: config.prompt,
    points: config.pairs.length,
    options: {
      left: config.pairs.map((row) => ({ id: row.promptId, text: row.prompt })),
      right: config.pairs.map((row) => ({ id: row.targetId, text: row.target })),
    },
  })
  return evaluateAnswer(question, {
    pairs: pairs.map((row) => ({ leftId: row.promptId, rightId: row.targetId })),
  })
}
function reduceMatching(config, state, command, inputs = {}) {
  if (!command || stale(state, command)) return state
  const roster = rosterCommand(state, command)
  if (roster)
    return command.type === 'leave'
      ? {
          ...roster,
          submissions: state.submissions.filter(
            (row) => row.participantId !== command.participantId
          ),
        }
      : roster
  if (command.type === 'start') {
    const next = startSubmission(config, state, inputs)
    return next === state
      ? state
      : {
          ...next,
          assignment: createAssignmentState(),
          submissions: [],
          accepted: [],
          revealed: false,
        }
  }
  if (command.type === 'expire') return expiry(state, inputs, command)
  if (command.type === 'end') return { ...state, phase: 'ended', deadline: null }
  if (command.type === 'reveal') return { ...state, revealed: true }
  if (['select', 'assign', 'clear', 'cancel'].includes(command.type)) {
    if (command.type !== 'cancel' && state.phase !== 'active') return state
    const assignment = reduceAssignment(
      {
        sourceIds: config.pairs.map((row) => row.promptId),
        targetIds: state.targetOrder,
        bijection: true,
      },
      state.assignment,
      command
    )
    return assignment === state.assignment ? state : { ...state, assignment }
  }
  if (command.type !== 'submit') return state
  const error = activeError('matching', state, command, inputs)
  if (error) return reject(state, error)
  const accepted =
    state.mode === 'local' &&
    state.submissions.find((row) => row.participantId === command.participantId && row.terminal)
  if (accepted) return { ...state, lastResult: accepted }
  const pairs = matchingPairs(
    config,
    command.pairs === undefined
      ? assignmentAnswer(state.assignment, 'promptId', 'targetId')
      : command.pairs
  )
  if (!pairs) return reject(state, 'invalid-matching-pairs')
  const evaluated = state.mode === 'local' ? evaluateLocalMatching(config, pairs) : null
  if (evaluated && !evaluated.valid) return reject(state, 'invalid-matching-pairs')
  const payload = JSON.stringify(
    [...pairs].sort((a, b) => (a.promptId < b.promptId ? -1 : a.promptId > b.promptId ? 1 : 0))
  )
  const receipt = actionReceipt(state, command, payload)
  if (receipt)
    return receipt.error ? reject(state, receipt.error) : { ...state, lastResult: receipt.result }
  const score = evaluated
    ? evaluated.correct
      ? config.pairs.length
      : 0
    : pairs.reduce(
        (sum, row) =>
          sum +
          Number(
            config.pairs.some(
              (pair) => pair.promptId === row.promptId && pair.targetId === row.targetId
            )
          ),
        0
      )
  const result = {
    ok: true,
    participantId: command.participantId,
    pairs,
    score,
    total: config.pairs.length,
    correct: score === config.pairs.length,
    ...(evaluated ? { terminal: evaluated.correct } : {}),
  }
  const exists = state.submissions.some((row) => row.participantId === command.participantId)
  const submissions = exists
    ? state.submissions.map((row) => (row.participantId === command.participantId ? result : row))
    : [...state.submissions, result]
  return accept(state, command, payload, result, { submissions })
}
module.exports = { createMatchingState, reduceMatching, matchingPairs }
