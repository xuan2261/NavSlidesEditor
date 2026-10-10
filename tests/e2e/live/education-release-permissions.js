import { expect } from '@playwright/test'
import { acceptedAt, sameRound, stateAt } from './education-release-authority.js'
import { answerCorrect, submittedPairs } from './education-release-answer-authority.js'
import { scatterReveal } from './education-release-scatter-authority.js'

export const permissionKey = (path) => JSON.stringify(path)
const states = new Set(['game-round-state', 'game-question'])
const receipts = new Set([
  'game-command-result',
  'game-answer-result',
  'game-matching-submit-accepted',
  'game-poll-vote-accepted',
  'game-word-cloud-submit-accepted',
  'game-error',
])
const revealEvents = new Set([
  'game-quiz-reveal',
  'game-fourcorners-reveal',
  'game-trivia-reveal',
  'game-jeopardy-reveal',
  'game-matching-reveal',
  'game-scatter-reveal',
])
const answerEvents = new Set(['game-answer', 'game-relay-answer', 'game-trivia-answer'])
function globalReveal(authority, data, state, records) {
  const explicit = records.some(
    (row) =>
      row.recipient === 'host' &&
      revealEvents.has(row.event) &&
      stateAt(authority, row.receipt)?.questionId === state?.questionId
  )
  if (explicit) return true
  if (
    authority.type === 'trivia-champ' &&
    state?.phase === 'review' &&
    records.some(
      (row) => row.event === 'game-trivia-answer' && row.command.questionId === state.questionId
    )
  )
    return true
  // Deadline review requires the authenticated active-to-review transition, not a learner reveal claim.
  if (
    !['quiz', 'hot-potato', 'four-corners', 'trivia-champ', 'scattergories'].includes(
      authority.type
    )
  )
    return false
  const history = authority.states
    .filter((row) => sameRound(row, data) && row.stateVersion <= data.stateVersion)
    .sort((a, b) => a.stateVersion - b.stateVersion)
  return (
    history.some(
      (row, index) =>
        ['review', 'revealed'].includes(row.phase) &&
        history
          .slice(0, index)
          .some(
            (before) =>
              ['active', 'guessing', 'playing'].includes(before.phase) &&
              before.questionId === row.questionId &&
              before.timeRemainingMs > 0 &&
              Number.isFinite(before.serverTimeMs) &&
              row.serverTimeMs >= before.serverTimeMs + before.timeRemainingMs
          )
    ) && ['review', 'revealed', 'ended'].includes(state?.phase)
  )
}
function answerFacts(authority, row, envelope) {
  const question = authority.questions.find((question) => question.id === row.command.questionId)
  expect(question, 'Accepted answer binds an authored question').toBeDefined()
  const answer =
    authority.type === 'hot-potato'
      ? { optionId: question.options[row.command.answerIndex]?.id }
      : row.command.answer
  const correct = answerCorrect(question, answer)
  const attempts = authority.recipients[row.recipient].commands.filter(
    (record) =>
      answerEvents.has(record.event) &&
      record.receipt.accepted &&
      sameRound(record.receipt, row.receipt) &&
      record.receipt.stateVersion <= row.receipt.stateVersion &&
      record.command.questionId === question.id
  )
  const closed = ['review', 'revealed', 'ended'].includes(stateAt(authority, envelope)?.phase)
  const terminal =
    authority.type !== 'quiz' ||
    correct ||
    new Set(attempts.map((record) => record.command.attemptId)).size >=
      authority.config.attemptLimit ||
    closed
  return {
    question,
    answer,
    correct,
    terminal,
    visible: authority.type !== 'quiz' || authority.config.feedbackMode === 'immediate' || terminal,
  }
}
export function packetPermissions(authority, recipient, name, data) {
  const permissions = new Map(),
    add = (path, expected) => permissions.set(permissionKey(path.split('.')), expected)
  const state = stateAt(authority, data),
    records = acceptedAt(authority, data)
  if (Object.hasOwn(data, 'gameType')) expect(data.gameType).toBe(authority.type)
  if (states.has(name) || ['game-matching-started', 'game-matching-results'].includes(name)) {
    expect(state, `${name} has matching authenticated version/round authority`).toBeDefined()
    const lastVersion = Math.max(
      ...authority.states.filter((row) => sameRound(row, data)).map((row) => row.stateVersion)
    )
    expect(data.stateVersion).toBeLessThanOrEqual(lastVersion)
    if (states.has(name) && authority.type === 'quiz')
      add('quiz.feedbackMode', authority.config.feedbackMode)
    if (data.question) {
      const authored = authority.questions.find(
        (question) => question.id === state.questionId && question.kind === state.questionKind
      )
      expect(authored, 'Active question has authored identity and kind').toBeDefined()
      const { answerKey, feedback, ...publicQuestion } = authored
      expect(data.question).toStrictEqual(publicQuestion)
    }
  }
  if (name === 'game-session') {
    const session = recipient.sessions.find(
      (session) =>
        sameRound(session, data) &&
        session.playerId === data.playerId &&
        session.sessionToken === data.sessionToken
    )
    expect(session, 'Session belongs to this recipient').toBeDefined()
    expect(data).toStrictEqual(session)
    add('sessionToken', session.sessionToken)
  }
  const isState = states.has(name),
    matchingAggregate = ['game-matching-started', 'game-matching-results'].includes(name)
  if ((isState || matchingAggregate) && globalReveal(authority, data, state, records)) {
    if (authority.type === 'matching') {
      const pairs = authority.config.pairs.map(({ promptId, targetId }) => ({ promptId, targetId }))
      submittedPairs(authority.config, pairs)
      if (isState) {
        add('revealed', { answerKey: pairs })
        add('matching.answerKey', pairs)
      }
      if (matchingAggregate) add('answerKey', pairs)
    } else if (authority.type === 'scattergories' && isState)
      add('revealed', scatterReveal(authority, data))
    else if (
      isState &&
      ['quiz', 'hot-potato', 'four-corners', 'trivia-champ', 'jeopardy'].includes(authority.type) &&
      state?.questionId
    ) {
      const question = authority.questions.find(
        (question) => question.id === state.questionId && question.kind === state.questionKind
      )
      expect(question).toBeDefined()
      if (authority.type === 'jeopardy')
        expect(
          records.some(
            (row) =>
              row.event === 'game-jeopardy-select' &&
              row.command.cellId === question.id &&
              state.activeCellId === question.id
          )
        ).toBe(true)
      add('revealed', {
        question: {
          answerKey: question.answerKey,
          explanation: question.feedback?.explanation || '',
        },
      })
    }
  }
  if (isState && data.ownSubmission) {
    const own = data.ownSubmission
    const row = records.find(
      (row) =>
        row.recipient !== 'host' &&
        authority.recipients[row.recipient].playerId === recipient.playerId &&
        row.command.commandId === own.commandId
    )
    expect(row, 'Own disclosure requires this recipient accepted command').toBeDefined()
    const ownEvents = new Set([
      ...answerEvents,
      'game-matching-submit',
      'game-scatter-submit',
      'game-fourcorners-choice',
      'game-poll-submit',
      'game-word-cloud-submit',
    ])
    const latestOwn = records
      .filter((record) => record.recipient === row.recipient && ownEvents.has(record.event))
      .at(-1)
    expect(own.commandId, 'Own disclosure identifies the latest accepted submission').toBe(
      latestOwn?.command.commandId
    )
    if (answerEvents.has(row.event)) {
      expect(own.questionId).toBe(row.command.questionId)
      expect(own.attemptId).toBe(row.command.attemptId)
      const facts = answerFacts(authority, row, data)
      add('ownSubmission.answer', facts.answer)
      add('ownSubmission.result.accepted', true)
      add('ownSubmission.result.terminal', facts.terminal)
      add('ownSubmission.result.questionId', row.command.questionId)
      add('ownSubmission.result.attemptId', row.command.attemptId)
      if (facts.visible) {
        add('ownSubmission.result.correct', facts.correct)
        if (authority.type === 'quiz')
          add(
            'ownSubmission.result.message',
            facts.question.feedback[facts.correct ? 'correct' : 'incorrect']
          )
      }
      if (authority.type === 'quiz' && facts.terminal)
        add('ownSubmission.reveal', {
          answerKey: facts.question.answerKey,
          explanation: facts.question.feedback.explanation,
        })
    } else if (row.event === 'game-matching-submit') {
      add('ownSubmission.pairs', row.command.pairs)
      add(
        'ownSubmission.correct',
        submittedPairs(authority.config, row.command.pairs) === authority.config.pairs.length
      )
    } else if (row.event === 'game-scatter-submit') {
      add(
        'ownSubmission.entries',
        row.command.entries.map(({ categoryId, text }) => ({
          categoryId,
          text: text.trim().normalize('NFC'),
        }))
      )
      expect(own.submissionId).toBe(row.receipt.result.submissionId)
    } else if (row.event === 'game-fourcorners-choice')
      expect(own.cornerId).toBe(row.command.cornerId)
  }
  if (receipts.has(name) && data.commandId) {
    const row = recipient.commands.find(
      (row) =>
        row.command.commandId === data.commandId &&
        sameRound(row.receipt, data) &&
        row.receipt.stateVersion <= data.stateVersion
    )
    expect(row, 'Result disclosure has matched recipient command and receipt').toBeDefined()
    if (name === 'game-answer-result') expect(answerEvents.has(row.event)).toBe(true)
    const acceptedEvents = {
      'game-matching-submit-accepted': 'game-matching-submit',
      'game-poll-vote-accepted': 'game-poll-submit',
      'game-word-cloud-submit-accepted': 'game-word-cloud-submit',
    }
    if (acceptedEvents[name]) expect(row.event).toBe(acceptedEvents[name])
    if (name === 'game-error') expect(row.receipt.accepted).toBe(false)
    add('accepted', row.receipt.accepted)
    if (name === 'game-command-result' || name === 'game-error')
      expect(data.stateVersion).toBe(row.receipt.stateVersion)
    if (row.receipt.accepted && answerEvents.has(row.event)) {
      const facts = answerFacts(authority, row, data)
      add('result.accepted', true)
      add('result.terminal', facts.terminal)
      add('terminal', facts.terminal)
      for (const prefix of ['result.', '']) {
        add(`${prefix}questionId`, row.command.questionId)
        add(`${prefix}attemptId`, row.command.attemptId)
      }
      if (facts.visible) {
        add('result.correct', facts.correct)
        add('correct', facts.correct)
        if (authority.type === 'quiz') {
          const message = facts.question.feedback[facts.correct ? 'correct' : 'incorrect']
          add('result.message', message)
          add('message', message)
        }
      }
    } else if (row.receipt.accepted && row.event === 'game-matching-submit') {
      const correct =
        submittedPairs(authority.config, row.command.pairs) === authority.config.pairs.length
      add('result.correct', correct)
      add('correct', correct)
      add('result.pairs', row.command.pairs)
      add('pairs', row.command.pairs)
      add('result.participantId', recipient.playerId)
      add('participantId', recipient.playerId)
    }
  }
  return permissions
}
