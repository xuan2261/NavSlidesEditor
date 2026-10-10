const poll = require('revealjs-shared/src/education/games/poll.js')
const cloud = require('revealjs-shared/src/education/games/word-cloud.js')
const matching = require('revealjs-shared/src/education/games/matching.js')
const { createLiveMatchingState } = require('./live-matching-state')
const life = require('./room-lifecycle')
const { hash } = require('./room-store')
const reducers = {
  poll: poll.reducePoll,
  'word-cloud': cloud.reduceWordCloud,
  matching: matching.reduceMatching,
}
function apply(room, type, fields = {}) {
  const before = room.engagement
  const next = reducers[room.gameType](
    room.config,
    before,
    { type, generation: room.generation, roundId: before.roundId, ...fields },
    { now: life.now }
  )
  if (next.lastResult?.error) return { error: next.lastResult.error }
  if (next === before) return { error: 'invalid-transition' }
  room.engagement = next
  room.phase = next.phase
  room.status = next.phase === 'ended' ? 'finished' : 'active'
  if (next.roundId !== before.roundId || type === 'clear') {
    room.roundId++
    for (const player of room.players.values()) player.ownSubmission = null
  }
  if (next.revealed) room.revealed = true
  life.armRound(room, next.phase === 'active' ? next.deadline : null, (current) =>
    apply(current, 'expire')
  )
  return { result: next.lastResult || { phase: room.phase } }
}
function start(room) {
  clearTimeout(room.cleanupTimer)
  room.cleanupTimer = null
  room.cleanupKind = null
  room.revealed = false
  if (room.gameType === 'matching')
    room.engagement = {
      ...createLiveMatchingState(room.config),
      generation: room.generation,
      roundId: room.engagement.roundId,
    }
  for (const player of room.players.values()) {
    if (player.role !== 'host')
      room.engagement = reducers[room.gameType](room.config, room.engagement, {
        type: 'join',
        participantId: player.playerId,
        name: player.name,
      })
  }
  return apply(room, 'start')
}
function submit(room, payload, player) {
  if (room.engagement.accepted.length >= 1000) return { error: 'submission-limit' }
  if (!room.engagement.participants.some((row) => row.id === player.playerId)) {
    room.engagement = reducers[room.gameType](room.config, room.engagement, {
      type: 'join',
      participantId: player.playerId,
      name: player.name,
    })
  }
  if (
    room.gameType === 'word-cloud' &&
    (typeof payload.text !== 'string' || payload.text.length > 40)
  )
    return { error: 'invalid-word-cloud-text' }
  if (room.gameType === 'matching' && (!Array.isArray(payload.pairs) || payload.pairs.length > 8))
    return { error: 'invalid-matching-pairs' }
  const type = room.gameType === 'poll' ? 'vote' : 'submit'
  const outcome = apply(room, type, {
    participantId: player.playerId,
    actionId: hash(JSON.stringify([player.playerId, payload.commandId])),
    optionId: payload.optionId,
    text: payload.text,
    pairs: payload.pairs,
  })
  if (!outcome.error) {
    const result = outcome.result
    player.ownSubmission =
      room.gameType === 'poll'
        ? { optionId: payload.optionId }
        : room.gameType === 'word-cloud'
          ? { count: result.submissions, lastText: result.text }
          : {
              pairs: result.pairs,
              score: result.score,
              total: result.total,
              correct: result.correct,
            }
    player.ownSubmission.commandId = payload.commandId
  }
  return outcome
}
function pollAggregate(room) {
  const aggregate = poll.pollAggregate(room.config, room.engagement)
  return {
    prompt: room.config.prompt,
    allowChangeVote: room.config.allowVoteChange,
    options: aggregate.options.map((row) => ({ id: row.id, text: row.text, votes: row.votes })),
    totalVotes: aggregate.totalVotes,
    votes: aggregate.options.map((row) => ({
      optionId: row.id,
      count: row.votes,
      percentage: aggregate.totalVotes ? (row.votes / aggregate.totalVotes) * 100 : 0,
    })),
  }
}
function cloudAggregate(room) {
  const aggregate = cloud.wordCloudAggregate(room.config, room.engagement)
  return {
    prompt: room.config.prompt,
    ...aggregate,
    words: aggregate.entries,
    maxPhraseLength: room.config.maxPhraseLength,
    maxSubmissionsPerPlayer: room.config.maxSubmissionsPerPlayer,
  }
}
function matchingState(room, revealed = room.engagement.revealed) {
  return {
    prompt: room.config.prompt,
    prompts: room.config.pairs.map((row) => ({ id: row.promptId, text: row.prompt })),
    targets: room.engagement.targetOrder.map((id) => ({
      id,
      text: room.config.pairs.find((row) => row.targetId === id).target,
    })),
    submissions: room.engagement.submissions.length,
    ...(revealed
      ? {
          answerKey: room.config.pairs.map((row) => ({
            promptId: row.promptId,
            targetId: row.targetId,
          })),
        }
      : {}),
  }
}
module.exports = { apply, start, submit, pollAggregate, cloudAggregate, matchingState }
