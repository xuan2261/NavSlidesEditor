// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { engine, wireHarness, once } from './game-live-wire-fixture'
let wire
beforeEach(async () => {
  wire = await wireHarness()
})
afterEach(async () => {
  await wire.close()
})
describe('Jeopardy wire authority', () => {
  it('owns select/wager/reveal/adjudicate and ignores score deltas', async () => {
    const f = await wire.fixture('jeopardy', { dailyDouble: ['cell-100'], negativePoints: true })
    expect((await f.a.command('game-jeopardy-select', { cellId: 'cell-100' })).error).toBe(
      'host-only'
    )
    expect((await f.host.command('game-jeopardy-select', { cellId: 'unknown' })).error).toBe(
      'unknown-cell'
    )
    await f.host.command('game-jeopardy-select', { cellId: 'cell-100', teamId: 'team-1' })
    expect(JSON.stringify(engine.getPublicState('jeopardy'))).not.toContain('answerKey')
    expect((await f.host.command('game-jeopardy-wager', { amount: 1001 })).error).toBe(
      'invalid-wager'
    )
    await f.host.command('game-jeopardy-wager', { amount: 1000 })
    expect((await f.host.command('game-jeopardy-adjudicate', { correct: true })).error).toBe(
      'invalid-adjudication'
    )
    await f.host.command('game-jeopardy-reveal')
    const payload = f.host.envelope({ correct: true, points: 999999 })
    const first = once(f.host.socket, 'game-command-result')
    f.host.socket.emit('game-jeopardy-adjudicate', payload)
    expect((await first).accepted).toBe(true)
    const duplicate = once(f.host.socket, 'game-command-result')
    f.host.socket.emit('game-jeopardy-adjudicate', payload)
    expect((await duplicate).duplicate).toBe(true)
    expect(engine.getPublicState('jeopardy').teams[0].score).toBe(1000)
    expect((await f.host.command('game-jeopardy-select', { cellId: 'cell-100' })).error).toBe(
      'cell-used'
    )
    await f.host.command('game-jeopardy-select', { cellId: 'cell-200' })
    await f.host.command('game-jeopardy-reveal')
    await f.host.command('game-jeopardy-adjudicate', { correct: false, points: 10000 })
    expect(engine.getPublicState('jeopardy').teams[0].score).toBe(800)
    expect(engine.getPublicState('jeopardy', 'alice').teams).toEqual(
      engine.getPublicState('jeopardy', 'bob').teams
    )
  })
  it('clamps wrong negative adjudication to zero and protects the next generation', async () => {
    const f = await wire.fixture('jeopardy', { negativePoints: true })
    await f.host.command('game-jeopardy-select', { cellId: 'cell-100' })
    await f.host.command('game-jeopardy-reveal')
    const old = f.host.envelope({ correct: false })
    await f.host.command('game-reset')
    const rejected = once(f.host.socket, 'game-command-result')
    f.host.socket.emit('game-jeopardy-adjudicate', old)
    expect((await rejected).error).toBe('stale-generation')
    await f.host.command('game-jeopardy-select', { cellId: 'cell-100' })
    await f.host.command('game-jeopardy-reveal')
    await f.host.command('game-jeopardy-adjudicate', { correct: false })
    expect(engine.getPublicState('jeopardy').teams[0].score).toBe(0)
  })
})
