const { identity } = require('./command-ledger')
function inspectAttempt(room, playerId, payload, answer) {
  const key = JSON.stringify([playerId, room.generation, room.roundId, payload.attemptId])
  const fingerprint = identity({ questionId: payload.questionId, answer }),
    previous = room.attempts.get(key)
  if (previous)
    return previous.fingerprint === fingerprint
      ? { duplicate: true, result: previous.result }
      : { error: 'attempt-id-conflict' }
  return { key, fingerprint }
}
function commitAttempt(room, attempt, result) {
  room.attempts.set(attempt.key, {
    fingerprint: attempt.fingerprint,
    result: structuredClone(result),
  })
}
module.exports = { inspectAttempt, commitAttempt }
