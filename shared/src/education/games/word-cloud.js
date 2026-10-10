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
function createWordCloudState(config) {
  return {
    ...initialSubmissionState('word-cloud', config),
    counts: [],
    quotas: [],
    revealed: false,
  }
}
function normalizeWordCloudText(text, limit) {
  return String(text || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, limit)
}
function wordCloudAggregate(config, state) {
  return {
    entries: [...state.counts]
      .sort((a, b) => b.count - a.count || (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
      .slice(0, config.displayLimit),
    totalSubmissions: state.counts.reduce((sum, row) => sum + row.count, 0),
  }
}
function reduceWordCloud(config, state, command, inputs = {}) {
  if (!command || stale(state, command)) return state
  const roster = rosterCommand(state, command)
  if (roster) return roster
  if (command.type === 'start') return startSubmission(config, state, inputs)
  if (command.type === 'expire') return expiry(state, inputs, command)
  if (command.type === 'end') return { ...state, phase: 'ended', deadline: null }
  if (command.type === 'reveal') return { ...state, revealed: true }
  if (command.type === 'clear')
    return {
      ...state,
      roundId: state.roundId + 1,
      counts: [],
      quotas: [],
      accepted: [],
      lastResult: null,
    }
  if (command.type !== 'submit') return state
  const error = activeError('word-cloud', state, command, inputs)
  if (error) return reject(state, error)
  if (command.roundId !== state.roundId) return reject(state, 'stale-round')
  const text = normalizeWordCloudText(command.text, config.maxPhraseLength)
  if (!text) return reject(state, 'empty-word-cloud-text')
  const receipt = actionReceipt(state, command, text)
  if (receipt)
    return receipt.error ? reject(state, receipt.error) : { ...state, lastResult: receipt.result }
  const quota = state.quotas.find((row) => row.participantId === command.participantId)
  if ((quota?.count || 0) >= config.maxSubmissionsPerPlayer)
    return reject(state, 'word-cloud-rate-limit')
  const nextQuota = { participantId: command.participantId, count: (quota?.count || 0) + 1 }
  const quotas = quota
    ? state.quotas.map((row) => (row === quota ? nextQuota : row))
    : [...state.quotas, nextQuota]
  const previous = state.counts.find((row) => row.text === text)
  const counts = previous
    ? state.counts.map((row) => (row === previous ? { text, count: row.count + 1 } : row))
    : [...state.counts, { text, count: 1 }]
  return accept(
    state,
    command,
    text,
    { ok: true, text, submissions: nextQuota.count },
    { counts, quotas }
  )
}
module.exports = {
  createWordCloudState,
  reduceWordCloud,
  wordCloudAggregate,
  normalizeWordCloudText,
}
