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
function createPollState(config) {
  return {
    ...initialSubmissionState('poll', config),
    votes: [],
    revealed: false,
    resultsVisible: config.showResults,
  }
}
function pollAggregate(config, state) {
  return {
    options: config.options.map((option) => ({
      ...option,
      votes: state.votes.filter((vote) => vote.optionId === option.id).length,
    })),
    totalVotes: state.votes.length,
  }
}
function reducePoll(config, state, command, inputs = {}) {
  if (!command || stale(state, command)) return state
  const roster = rosterCommand(state, command)
  if (roster)
    return command.type === 'leave'
      ? {
          ...roster,
          votes: state.votes.filter((row) => row.participantId !== command.participantId),
        }
      : roster
  if (command.type === 'start') return startSubmission(config, state, inputs)
  if (command.type === 'expire') return expiry(state, inputs, command)
  if (command.type === 'end') return { ...state, phase: 'ended', deadline: null }
  if (command.type === 'reveal') return { ...state, revealed: true, resultsVisible: true }
  if (command.type !== 'vote') return state
  const error = activeError('poll', state, command, inputs)
  if (error) return reject(state, error)
  if (!config.options.some((row) => row.id === command.optionId))
    return reject(state, 'invalid-poll-option')
  const receipt = actionReceipt(state, command, command.optionId)
  if (receipt)
    return receipt.error ? reject(state, receipt.error) : { ...state, lastResult: receipt.result }
  const previous = state.votes.find((row) => row.participantId === command.participantId)
  if (previous && previous.optionId !== command.optionId && !config.allowVoteChange)
    return reject(state, 'vote-change-disabled')
  const vote = { participantId: command.participantId, optionId: command.optionId }
  const votes = previous
    ? state.votes.map((row) => (row.participantId === command.participantId ? vote : row))
    : [...state.votes, vote]
  return accept(
    state,
    command,
    command.optionId,
    { ok: true, optionId: command.optionId },
    { votes }
  )
}
module.exports = { createPollState, reducePoll, pollAggregate }
