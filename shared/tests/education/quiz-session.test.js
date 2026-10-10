import { describe, expect, it } from 'vitest'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import { normalizeQuizConfig } from '../../src/education/quiz-config.js'
import { createQuizSession, reduceQuizSession } from '../../src/education/quiz-session.js'
import { projectPublicQuiz } from '../../src/education/quiz-public-projection.js'

const question = (id = 'q', overrides = {}) =>
  createCanonicalQuestion({
    id,
    kind: 'true-false',
    timeLimit: 5,
    feedback: { correct: 'Well done', incorrect: 'Try again', explanation: 'Private explanation' },
    ...overrides,
  })
const start = (config = {}, options) =>
  createQuizSession({ questions: [question()], ...config }, options)
const command = (state, type, fields = {}) =>
  reduceQuizSession(state, {
    type,
    generation: state.generation,
    questionId: state.questionId,
    now: 0,
    ...fields,
  })
const answer = (state, value, fields = {}) =>
  command(state, 'submit', { attemptId: 'a', answer: { value }, ...fields })

describe('quiz attempts and lifecycle', () => {
  it('extends local timed questions only while active, without changing points or attempts', () => {
    const initial = start()
    const extended = command(initial, 'extend-time', { now: 1000 })
    expect(extended.deadline).toBe(35000)
    expect(extended.score).toBe(0)
    expect(extended.attempts).toEqual([])
    expect(answer(extended, true, { now: 6000 }).score).toBe(10)
    expect(command(initial, 'extend-time', { now: 5000 }).status).toBe('terminal')
    const finished = answer(initial, true)
    expect(command(finished, 'extend-time')).toBe(finished)
  })

  it('ends on the configured last wrong attempt without awarding points', () => {
    const first = answer(start({ attemptLimit: 2 }), false)
    expect(first.status).toBe('active')
    const second = answer(first, false, { attemptId: 'b' })
    expect(second.status).toBe('terminal')
    expect(second.score).toBe(0)
    expect(answer(second, true, { attemptId: 'c' }).attempts).toHaveLength(2)
  })

  it('replays an accepted attempt, rejects payload reuse, and never doubles its score', () => {
    const finished = answer(start(), true)
    const replay = answer(finished, true, { now: 9000 })
    expect(replay.lastResult).toEqual(finished.lastResult)
    expect(replay.score).toBe(10)
    expect(replay.attempts).toHaveLength(1)
    const conflict = answer(finished, false)
    expect(conflict.lastResult.error).toBe('attempt-id-conflict')
    expect(conflict.score).toBe(10)
  })

  it('treats structured object property order as the same attempt', () => {
    const q = question('q', { kind: 'image-hotspot' })
    const initial = start({ questions: [q] })
    const accepted = command(initial, 'submit', {
      attemptId: 'a',
      answer: { mode: 'point', x: 0.5, y: 0.5 },
    })
    const replay = command(accepted, 'submit', {
      attemptId: 'a',
      answer: { y: 0.5, x: 0.5, mode: 'point' },
    })
    expect(replay.lastResult).toEqual(accepted.lastResult)
    expect(replay.score).toBe(10)
  })

  it('accepts strictly before the deadline and rejects at or after it', () => {
    const initial = start({}, { now: 1000 })
    expect(initial.deadline).toBe(6000)
    expect(answer(initial, true, { now: 5999 }).score).toBe(10)
    for (const now of [6000, 6001]) {
      const expired = answer(initial, true, { now })
      expect(expired.status).toBe('terminal')
      expect(expired.score).toBe(0)
      expect(expired.attempts).toEqual([])
      expect(expired.lastResult.error).toBe('deadline')
    }
  })

  it('ignores early and unrelated expiry events; untimed questions stay active', () => {
    const initial = start()
    expect(command(initial, 'expire', { now: 4999 })).toBe(initial)
    expect(command(initial, 'expire', { now: 5000, questionId: 'other' })).toBe(initial)
    expect(command(initial, 'expire', { now: 5000 }).status).toBe('terminal')
    const untimed = start({ questions: [question('q', { timeLimit: null })] })
    expect(command(untimed, 'expire', { now: 100000 })).toBe(untimed)
  })

  it('reset clears state and makes stale submissions, expiry, and resets harmless', () => {
    const finished = answer(start(), true)
    const reset = command(finished, 'reset', { now: 100 })
    expect(reset).toMatchObject({
      generation: 1,
      status: 'active',
      score: 0,
      attempts: [],
      lastResult: null,
      deadline: 5100,
    })
    for (const type of ['submit', 'expire', 'reset']) {
      expect(
        command(reset, type, {
          generation: 0,
          now: 10000,
          attemptId: 'old',
          answer: { value: true },
        })
      ).toBe(reset)
    }
    expect(answer(reset, true).score).toBe(10)
  })

  it('advances only terminal questions and rejects cross-question attempt ID reuse', () => {
    const initial = start({ questions: [question('q'), question('r', { points: 30 })] })
    expect(command(initial, 'next')).toBe(initial)
    const first = answer(initial, true)
    const next = command(first, 'next', { now: 100 })
    expect(next).toMatchObject({ questionId: 'r', deadline: 5100, score: 10 })
    expect(answer(next, true).lastResult.error).toBe('attempt-id-conflict')
    expect(answer(next, true, { attemptId: 'b', questionId: 'q' }).lastResult.error).toBe(
      'inactive-question'
    )
    const second = answer(next, true, { attemptId: 'b' })
    expect(second.score).toBe(40)
    expect(command(second, 'next')).toMatchObject({
      status: 'complete',
      questionId: null,
      deadline: null,
    })
  })

  it('isolates authoring state and shuffles question IDs without changing their keys', () => {
    const config = {
      questions: [question('a'), question('b'), question('c')],
      shuffleQuestions: true,
    }
    const state = createQuizSession(config, { random: () => 0 })
    expect(state.questionIds).toEqual(['b', 'c', 'a'])
    config.questions[1].answerKey.value = false
    expect(answer(state, true).score).toBe(10)
    expect(config.questions.map((q) => q.id)).toEqual(['a', 'b', 'c'])
  })

  it('rejects invalid settings and duplicate question identities', () => {
    for (const attemptLimit of [0, 11, 1.5, '2']) expect(() => start({ attemptLimit })).toThrow()
    expect(() => start({ questions: [question(), question()] })).toThrow()
    expect(() => normalizeQuizConfig({ feedbackMode: 'always' })).toThrow()
  })
})

describe('quiz public projection feedback timing', () => {
  const roundtrip = (state) => JSON.parse(JSON.stringify(projectPublicQuiz(state.config, state)))
  it.each(['immediate', 'after-question'])(
    'keeps keys and explanation private until terminal with %s feedback',
    (feedbackMode) => {
      const initial = start({ attemptLimit: 2, feedbackMode })
      const first = answer(initial, false)
      const publicFirst = roundtrip(first)
      const serialized = JSON.stringify(publicFirst)
      expect(serialized).not.toContain('answerKey')
      expect(serialized).not.toContain('Private explanation')
      expect(serialized).not.toContain('accepted')
      expect(publicFirst.questions[0].attemptsUsed).toBe(1)
      if (feedbackMode === 'immediate')
        expect(publicFirst.questions[0].result).toEqual({
          correct: false,
          pointsAwarded: 0,
          message: 'Try again',
        })
      else expect(publicFirst.questions[0].result).toBeUndefined()
      const terminal = answer(first, true, { attemptId: 'b' })
      expect(roundtrip(terminal).questions[0]).toMatchObject({
        terminal: true,
        result: { correct: true, message: 'Well done' },
        reveal: { answerKey: { value: true }, explanation: 'Private explanation' },
      })
    }
  )

  it('does not reveal future questions and omits hidden score', () => {
    const state = start({ questions: [question('q'), question('r')], showScore: false })
    const projected = roundtrip(answer(state, true))
    expect(projected.score).toBeUndefined()
    expect(projected.questions[1].reveal).toBeUndefined()
    expect(projected.questions[1].question.feedback).toBeUndefined()
    expect(projectPublicQuiz(state.config).questions[0].question.answerKey).toBeUndefined()
  })

  it('ends feedback secrecy at timeout and restores it on reset', () => {
    const retry = answer(start({ attemptLimit: 2, feedbackMode: 'after-question' }), false)
    const expired = command(retry, 'expire', { now: 5000 })
    expect(roundtrip(expired).questions[0].result.message).toBe('Try again')
    expect(roundtrip(expired).questions[0].reveal.explanation).toBe('Private explanation')
    const reset = command(expired, 'reset')
    expect(roundtrip(reset).questions[0].reveal).toBeUndefined()
    expect(roundtrip(reset).questions[0].result).toBeUndefined()
  })
})
