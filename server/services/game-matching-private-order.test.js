// @vitest-environment node
import crypto from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { engine, fixture } from './game-authority-test-fixture'

const pairs = [
  { promptId: 'p1', prompt: 'HTTP', targetId: 't1', target: 'Protocol' },
  { promptId: 'p2', prompt: 'TLS', targetId: 't2', target: 'Security' },
  { promptId: 'p3', prompt: 'DNS', targetId: 't3', target: 'Names' },
  { promptId: 'p4', prompt: 'TCP', targetId: 't4', target: 'Transport' },
]
const targetIds = (state) => state.matching.targets.map((row) => row.id)
function controlEntropy(...choices) {
  vi.spyOn(crypto, 'randomInt').mockImplementation((max) => {
    const choice = choices.shift()
    if (!Number.isInteger(choice) || choice < 0 || choice >= max)
      throw new Error('Unexpected matching entropy request')
    return choice
  })
}
function expectStableProjection(expected, ...playerIds) {
  for (const playerId of [undefined, ...playerIds]) {
    expect(engine.getPublicState('room', playerId).matching).toEqual(expected)
    expect(engine.getPublicState('room', playerId).matching).toEqual(expected)
  }
  expect(engine.getMatchingState('room')).toEqual(expected)
}
afterEach(() => {
  engine._reset()
  vi.restoreAllMocks()
})

describe('server-private live matching presentation order', () => {
  it('uses controlled private entropy for create/reset waiting projections and preserves it on join and reconnect', () => {
    controlEntropy(1, 2, 0, 0, 1, 0)
    const f = fixture('matching', { pairs })
    const waiting = engine.getPublicState('room')
    expect(waiting.phase).toBe('waiting')
    expect(targetIds(waiting)).toEqual(['t4', 't1', 't3', 't2'])
    expect(waiting.matching.prompts).toEqual(
      pairs.map(({ promptId, prompt }) => ({ id: promptId, text: prompt }))
    )
    expect(waiting.matching.targets).toEqual(
      ['t4', 't1', 't3', 't2'].map((id) => ({
        id,
        text: pairs.find((pair) => pair.targetId === id).target,
      }))
    )
    expect(waiting.matching).not.toHaveProperty('answerKey')
    expect(waiting.revealed).toBeNull()
    expect(f.join().ok).toBe(true)
    expect(f.join('late').ok).toBe(true)
    expect(engine.observeRoom('room').ok).toBe(true)
    expectStableProjection(waiting.matching, 'host', 'learner', 'late')
    expect(engine.disconnectRoom('room', 'learner', 'learner-socket').ok).toBe(true)
    expect(f.join('learner', 'Learner', { socketId: 'waiting-reconnected' }).ok).toBe(true)
    expectStableProjection(waiting.matching, 'learner')

    expect(f.command('game-reset').accepted).toBe(true)
    const reset = engine.getPublicState('room')
    expect(reset).toMatchObject({
      phase: 'waiting',
      generation: waiting.generation + 1,
      roundId: 0,
      revealed: null,
    })
    expect(targetIds(reset)).toEqual(['t3', 't4', 't2', 't1'])
    expect(reset.matching).not.toHaveProperty('answerKey')
    expectStableProjection(reset.matching, 'host', 'learner', 'late')
    expect(f.join('learner', 'Learner', { socketId: 'reset-reconnected' }).ok).toBe(true)
    expectStableProjection(reset.matching, 'learner')
  })

  it('keeps active order stable through scoring/reveal/reconnect and initializes controlled subsequent rounds', () => {
    controlEntropy(1, 2, 0, 2, 0, 1, 3, 2, 1, 0, 1, 0, 2, 0, 1)
    const f = fixture('matching', { pairs })
    f.join()
    f.join('wrong')
    expect(f.command('game-matching-start').accepted).toBe(true)
    const active = engine.getPublicState('room')
    expect(active).toMatchObject({ phase: 'active', roundId: 1, revealed: null })
    expect(targetIds(active)).toEqual(['t4', 't2', 't1', 't3'])
    expect(active.matching).not.toHaveProperty('answerKey')
    expect(f.join('late').ok).toBe(true)
    expectStableProjection(active.matching, 'host', 'learner', 'late')
    expect(f.command('game-matching-reveal', {}, 'learner').error).toBe('host-only')
    expectStableProjection(active.matching, 'learner')

    const correctPairs = pairs.map(({ promptId, targetId }) => ({ promptId, targetId }))
    const payload = f.envelope({ commandId: 'score-once', pairs: correctPairs })
    const scored = engine.command('game-matching-submit', payload, f.playerActors.get('learner'))
    expect(scored).toMatchObject({
      accepted: true,
      duplicate: false,
      result: { score: 4, total: 4, correct: true },
    })
    expect(
      engine.command('game-matching-submit', payload, f.playerActors.get('learner'))
    ).toMatchObject({
      accepted: true,
      duplicate: true,
      stateVersion: scored.stateVersion,
      result: { score: 4, total: 4, correct: true },
    })
    expect(engine.getPublicState('room', 'learner').ownSubmission).toMatchObject({
      score: 4,
      total: 4,
      correct: true,
    })
    expect(engine.getMatchingState('room').submissions).toBe(1)
    const wrongPairs = pairs.map(({ promptId }, index) => ({
      promptId,
      targetId: pairs[(index + 1) % pairs.length].targetId,
    }))
    expect(f.command('game-matching-submit', { pairs: wrongPairs }, 'wrong').result).toMatchObject({
      score: 0,
      total: 4,
      correct: false,
    })
    const submitted = { ...active.matching, submissions: 2 }
    expectStableProjection(submitted, 'host', 'learner', 'wrong')
    expect(engine.disconnectRoom('room', 'learner', 'learner-socket').ok).toBe(true)
    expect(f.join('learner', 'Learner', { socketId: 'active-reconnected' }).ok).toBe(true)
    expect(engine.getPublicState('room', 'learner').ownSubmission).toMatchObject({
      score: 4,
      total: 4,
      correct: true,
    })
    expectStableProjection(submitted, 'learner', 'late')

    const revealPayload = f.envelope({ commandId: 'reveal-once' })
    const revealed = engine.command('game-matching-reveal', revealPayload, f.hostActor)
    expect(revealed.accepted).toBe(true)
    expect(engine.command('game-matching-reveal', revealPayload, f.hostActor)).toMatchObject({
      accepted: true,
      duplicate: true,
      stateVersion: revealed.stateVersion,
    })
    const revealedProjection = { ...submitted, answerKey: correctPairs }
    expectStableProjection(revealedProjection, 'host', 'learner', 'late')
    expect(engine.getPublicState('room').revealed).toEqual({ answerKey: correctPairs })
    expect(f.join('learner', 'Learner', { socketId: 'revealed-reconnected' }).ok).toBe(true)
    expectStableProjection(revealedProjection, 'learner')

    expect(f.command('game-end').accepted).toBe(true)
    expect(f.command('game-matching-start').accepted).toBe(true)
    const next = engine.getPublicState('room', 'learner')
    expect(next).toMatchObject({ phase: 'active', roundId: 2, revealed: null, ownSubmission: null })
    // Identity and repeated permutations are valid entropy outcomes, not privacy failures.
    expect(targetIds(next)).toEqual(['t1', 't2', 't3', 't4'])
    expect(next.matching.submissions).toBe(0)
    expect(next.matching).not.toHaveProperty('answerKey')
    expectStableProjection(next.matching, 'learner', 'late')

    expect(f.command('game-reset').accepted).toBe(true)
    const reset = engine.getPublicState('room')
    expect(reset).toMatchObject({
      phase: 'waiting',
      generation: active.generation + 1,
      roundId: 0,
      revealed: null,
    })
    expect(targetIds(reset)).toEqual(['t3', 't4', 't2', 't1'])
    expect(reset.matching).not.toHaveProperty('answerKey')
    expectStableProjection(reset.matching, 'learner')
    expect(f.command('game-matching-start').accepted).toBe(true)
    const restarted = engine.getPublicState('room', 'learner')
    expect(restarted).toMatchObject({
      phase: 'active',
      generation: active.generation + 1,
      roundId: 1,
      revealed: null,
      ownSubmission: null,
    })
    expect(targetIds(restarted)).toEqual(targetIds(active))
    expect(restarted.matching).toMatchObject({ submissions: 0 })
    expect(restarted.matching).not.toHaveProperty('answerKey')
    expectStableProjection(restarted.matching, 'host', 'learner', 'late')
  })
})
