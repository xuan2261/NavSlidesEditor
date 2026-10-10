import { describe, expect, it } from 'vitest'
import { createDefaultGameConfig } from '../../src/education/game-defaults.js'
import { createHotPotatoState, reduceHotPotato } from '../../src/education/games/hot-potato.js'
import {
  createFourCornersState,
  reduceFourCorners,
} from '../../src/education/games/four-corners.js'
import { createJeopardyState, reduceJeopardy } from '../../src/education/games/jeopardy.js'

function fixture(type, create, reduce, patch = {}) {
  const config = { ...createDefaultGameConfig(type), ...patch }
  let now = 100,
    state = { ...create(config, { random: () => 0 }), generation: 0 }
  return {
    config,
    get state() {
      return state
    },
    time: (value) => {
      now = value
    },
    send: (type, fields = {}) =>
      (state = reduce(
        config,
        state,
        { type, generation: state.generation, ...fields },
        { now: () => now, random: () => 0 }
      )),
  }
}

describe('canonical classroom question games', () => {
  it('keeps prototype-named hot-potato participants independent with numeric once-only awards', () => {
    const config = createDefaultGameConfig('hot-potato'),
      question = { ...config.questions[0], points: 7, timeLimit: null }
    const f = fixture('hot-potato', createHotPotatoState, reduceHotPotato, {
      questions: [question],
    })
    f.send('start')
    for (const playerId of ['constructor', 'toString', '__proto__']) {
      f.send('submit-answer', { playerId, answer: { optionId: question.answerKey.optionId } })
      expect(Object.hasOwn(f.state.scores, playerId)).toBe(true)
      expect(f.state.scores[playerId]).toBe(7)
      expect(f.state.answeredPlayers[playerId]).toMatchObject({ correct: true, points: 7 })
      const accepted = f.state
      expect(
        f.send('submit-answer', { playerId, answer: { optionId: question.answerKey.optionId } })
      ).toBe(accepted)
    }
    expect(f.state.leaderboard.map((row) => row.score)).toEqual([7, 7, 7])
  })
  it('records prototype-named corner votes and awards each numeric score once per round', () => {
    const config = createDefaultGameConfig('four-corners'),
      question = { ...config.questions[0], points: 7 }
    const f = fixture('four-corners', createFourCornersState, reduceFourCorners, {
      questions: [question],
    })
    f.send('start-round')
    for (const participantId of ['constructor', 'toString', '__proto__']) {
      f.send('vote', { participantId, cornerId: question.answerKey.optionId })
      expect(Object.hasOwn(f.state.votes, participantId)).toBe(true)
      expect(f.state.votes[participantId]).toBe(question.answerKey.optionId)
    }
    f.send('reveal')
    for (const id of ['constructor', 'toString', '__proto__']) {
      expect(Object.hasOwn(f.state.scores, id)).toBe(true)
      expect(f.state.scores[id]).toBe(7)
    }
    const accepted = f.state
    expect(f.send('reveal')).toBe(accepted)
  })
  it('accepts one hot-potato answer per participant and rejects invalid/stale input without awarding', () => {
    const f = fixture('hot-potato', createHotPotatoState, reduceHotPotato)
    f.send('start')
    const active = f.state,
      q = active.currentQuestion
    expect(
      f.send('submit-answer', { playerId: 'a', answer: { optionId: 'missing' }, questionId: q.id })
    ).toMatchObject({ scores: {}, answeredPlayers: {} })
    f.time(1100)
    f.send('submit-answer', {
      playerId: 'a',
      answer: { optionId: q.answerKey.optionId },
      questionId: q.id,
    })
    const scored = f.state
    expect(scored.scores.a).toBe(20)
    expect(
      f.send('submit-answer', {
        playerId: 'a',
        answer: { optionId: q.answerKey.optionId },
        questionId: q.id,
      })
    ).toBe(scored)
    expect(
      f.send('submit-answer', {
        playerId: 'b',
        answer: { optionId: q.answerKey.optionId },
        generation: 9,
      })
    ).toBe(scored)
    expect(f.send('start')).toBe(scored)
    f.send('reveal')
    f.send('next-question')
    expect(f.state.phase).toBe('ended')
  })
  it('honors hot-potato zero points, null deadline and exact expiry boundary', () => {
    const cfg = createDefaultGameConfig('hot-potato'),
      question = cfg.questions[0]
    const f = fixture('hot-potato', createHotPotatoState, reduceHotPotato, {
      questions: [{ ...question, points: 0, timeLimit: null }],
    })
    f.send('start')
    expect(f.state.deadline).toBeNull()
    f.time(999999)
    f.send('submit-answer', { playerId: 'a', answer: { optionId: question.answerKey.optionId } })
    expect(f.state.scores.a).toBe(0)
    expect(f.state.answeredPlayers.a.correct).toBe(true)
    const timed = fixture('hot-potato', createHotPotatoState, reduceHotPotato)
    timed.send('start')
    timed.time(timed.state.deadline)
    timed.send('submit-answer', {
      playerId: 'a',
      answer: { optionId: question.answerKey.optionId },
    })
    expect(timed.state.answeredPlayers.a).toMatchObject({ correct: false, points: 0, late: true })
  })
  it('uses the authored corner identity and preserves a single round deadline through votes', () => {
    const cfg = createDefaultGameConfig('four-corners'),
      question = { ...cfg.questions[0], points: 0 }
    const f = fixture('four-corners', createFourCornersState, reduceFourCorners, {
      questions: [question],
    })
    f.send('start-round')
    const active = f.state,
      deadline = active.deadline
    expect(f.send('vote', { participantId: 'a', cornerId: 'missing' })).toBe(active)
    f.time(1000)
    f.send('vote', {
      participantId: 'a',
      cornerId: question.answerKey.optionId,
      questionId: question.id,
    })
    f.send('vote', { participantId: 'b', cornerId: question.options[1].id })
    expect(f.state.deadline).toBe(deadline)
    f.send('reveal')
    expect(f.state.scores.a).toBe(0)
    expect(f.state.eliminated).toEqual(['b'])
    const reviewed = f.state
    expect(f.send('reveal')).toBe(reviewed)
    f.send('start-round')
    expect(f.state.phase).toBe('ended')
  })
  it('derives jeopardy cells from authored config and accepts adjudication exactly once', () => {
    const f = fixture('jeopardy', createJeopardyState, reduceJeopardy)
    const q = f.config.categories[0].questions[0]
    const board = f.state
    expect(f.send('select-team', { teamId: 'missing' })).toBe(board)
    expect(f.send('select-cell', { cellId: 'missing', question: q })).toBe(board)
    f.send('select-cell', { cellId: q.id, question: { ...q, points: 100000 } })
    expect(f.state.currentWager).toBe(q.points)
    const active = f.state
    expect(f.send('adjudicate', { correct: true })).toBe(active)
    f.send('reveal')
    f.send('adjudicate', { correct: true, activeCellId: q.id })
    expect(f.state.scores['team-1']).toBe(q.points)
    expect(f.state.usedCellIds).toEqual([q.id])
    const scored = f.state
    expect(f.send('adjudicate', { correct: true, activeCellId: q.id })).toBe(scored)
    expect(f.send('select-cell', { cellId: q.id })).toBe(scored)
  })
  it('rejects jeopardy invalid wagers and clamps negative adjudication at zero', () => {
    const cfg = createDefaultGameConfig('jeopardy'),
      q = cfg.categories[0].questions[0]
    const f = fixture('jeopardy', createJeopardyState, reduceJeopardy, {
      dailyDouble: [q.id],
      negativePoints: true,
    })
    f.send('select-cell', { cellId: q.id })
    const wagering = f.state
    expect(f.send('submit-wager', { wager: 1001 })).toBe(wagering)
    expect(f.send('submit-wager', { wager: 0.5 })).toBe(wagering)
    f.send('submit-wager', { wager: 500 })
    f.send('reveal')
    f.send('adjudicate', { correct: false })
    expect(f.state.scores['team-1']).toBe(0)
    expect(f.state.usedCellIds).toEqual([q.id])
  })
})
