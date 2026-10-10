// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { wireHarness, once, engine } from './game-live-wire-fixture'
let wire
beforeEach(async () => {
  wire = await wireHarness()
})
afterEach(async () => {
  await wire.close()
})
describe('matching reveal persistence over real sockets', () => {
  it('hydrates late recipients with revealed stable pairs then cleanly starts a new round', async () => {
    const f = await wire.fixture('matching', {
      pairs: [
        { promptId: 'p1', prompt: 'HTTP', targetId: 't1', target: 'Protocol' },
        { promptId: 'p2', prompt: 'TLS', targetId: 't2', target: 'Security' },
      ],
    })
    const started = once(f.a.socket, 'game-round-state', (state) => state.roundId === 1)
    await f.host.command('game-matching-start')
    await started
    expect(f.a.state().matching).not.toHaveProperty('answerKey')
    const accepted = await f.a.command('game-matching-submit', {
      pairs: [
        { promptId: 'p1', targetId: 't1' },
        { promptId: 'p2', targetId: 't2' },
      ],
    })
    expect(accepted.result).toMatchObject({ score: 2, total: 2, correct: true })
    await f.host.command('game-matching-reveal')
    const late = await wire.client()
    await late.join('matching', 'late')
    expect(late.state().matching).toMatchObject({
      submissions: 1,
      answerKey: [
        { promptId: 'p1', targetId: 't1' },
        { promptId: 'p2', targetId: 't2' },
      ],
    })
    await f.host.command('game-end')
    expect(engine.getRoom('matching').cleanupKind).toBe('finished')
    await f.host.command('game-reset')
    await f.host.command('game-matching-start')
    expect(engine.getRoom('matching')).toMatchObject({ status: 'active', cleanupKind: null })
    expect(engine.getMatchingState('matching')).toMatchObject({ submissions: 0 })
    expect(engine.getMatchingState('matching')).not.toHaveProperty('answerKey')
  })
})
