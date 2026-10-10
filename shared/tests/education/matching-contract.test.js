import { describe, expect, it } from 'vitest'
import { createDefaultGameConfig } from '../../src/education/game-defaults.js'
import { createMatchingState, reduceMatching } from '../../src/education/games/matching.js'

function classroom() {
  const config = createDefaultGameConfig('matching')
  let state = createMatchingState(config)
  const send = (type, fields = {}, now = 0) => {
    state = reduceMatching(
      config,
      state,
      { type, generation: state.generation, roundId: state.roundId, ...fields },
      { now }
    )
    return state
  }
  send('join', { participantId: 'learner', name: 'Learner' })
  send('start')
  const pairs = config.pairs.map(({ promptId, targetId }) => ({ promptId, targetId }))
  return {
    config,
    pairs,
    send,
    get state() {
      return state
    },
  }
}

describe('local Matching exact-match and accepted-result contract', () => {
  it('rejects incomplete mappings, permits a wrong complete retry and preserves the first correct award', () => {
    const game = classroom(),
      [first, second] = game.pairs
    game.send('submit', { participantId: 'learner', actionId: 'partial', pairs: [first] })
    expect(game.state.lastResult).toMatchObject({ ok: false })
    expect(game.state.submissions).toEqual([])
    const wrong = [
      { ...first, targetId: second.targetId },
      { ...second, targetId: first.targetId },
    ]
    game.send('submit', { participantId: 'learner', actionId: 'wrong', pairs: wrong })
    expect(game.state.lastResult).toMatchObject({
      ok: true,
      correct: false,
      score: 0,
      terminal: false,
    })
    game.send('submit', {
      participantId: 'learner',
      actionId: 'correct',
      pairs: [...game.pairs].reverse(),
    })
    expect(game.state.lastResult).toMatchObject({ correct: true, score: 2, terminal: true })
    const accepted = game.state.submissions[0]
    game.send('submit', { participantId: 'learner', actionId: 'new-after-correct', pairs: wrong })
    expect(game.state.submissions).toEqual([accepted])
    expect(game.state.lastResult).toEqual(accepted)
  })

  it('does not erase active assignments, results or deadline on repeated Start', () => {
    const game = classroom(),
      first = game.pairs[0]
    game.send('select', { sourceId: first.promptId })
    game.send('assign', { targetId: first.targetId })
    game.send('submit', { participantId: 'learner', actionId: 'correct', pairs: game.pairs })
    const active = game.state
    expect(game.send('start', {}, 1000)).toBe(active)
    expect(game.send('start', {}, 2000)).toBe(active)
    game.send('end')
    game.send('start', {}, 3000)
    expect(game.state.roundId).toBe(active.roundId + 1)
    expect(game.state.submissions).toEqual([])
    expect(game.state.assignment.assignments).toEqual([])
  })

  it('keeps accepted results independent across stable participants and clean replay', () => {
    const game = classroom()
    game.send('join', { participantId: 'second', name: 'Learner' })
    game.send('submit', { participantId: 'learner', actionId: 'first', pairs: game.pairs })
    game.send('submit', { participantId: 'second', actionId: 'second', pairs: game.pairs })
    expect(game.state.submissions.map((row) => [row.participantId, row.score])).toEqual([
      ['learner', 2],
      ['second', 2],
    ])
    expect(createMatchingState(game.config)).toMatchObject({
      submissions: [],
      phase: 'idle',
      accepted: [],
    })
  })
})
