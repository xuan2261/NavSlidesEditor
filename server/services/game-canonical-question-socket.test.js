// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { wireHarness, once, engine } from './game-live-wire-fixture'
import { now } from './game-authority-test-fixture'
let wire
const question = () => ({
  id: 'q',
  kind: 'single-choice',
  prompt: 'Choose B',
  points: 10,
  timeLimit: 30,
  options: [
    { id: 'b', text: 'B' },
    { id: 'a', text: 'A' },
  ],
  answerKey: { optionId: 'b' },
  feedback: { correct: 'private', incorrect: 'private', explanation: 'private' },
})
beforeEach(async () => {
  wire = await wireHarness()
})
afterEach(async () => {
  await wire.close()
})
async function start(options = {}) {
  const f = await wire.fixture('hot-potato', { questions: [question()], ...options }, 'room')
  const ready = once(f.a.socket, 'game-round-state', (state) => state.roundId === 1)
  await f.host.command('game-next')
  await ready
  return f
}
const answer = (f, answerIndex, fields = {}) =>
  f.a.command('game-answer', {
    questionId: 'q',
    attemptId: `attempt-${Math.random()}`,
    answerIndex,
    ...fields,
  })
describe('canonical Hot Potato wire contract', () => {
  it('grades reordered stable keys and projects only public option fields', async () => {
    const q = question()
    q.options.reverse()
    const f = await start({ questions: [q] })
    expect(f.a.state().question.options).toEqual([
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ])
    expect(JSON.stringify(f.a.state())).not.toContain('answerKey')
    expect((await answer(f, 1)).result).toMatchObject({ correct: true, selectedOptionId: 'b' })
  })
  it('redacts legacy nested markers while retaining canonical correctIndex admission', async () => {
    const legacy = {
      id: 'q',
      question: 'Choose B',
      points: 10,
      timeLimit: 30,
      correctIndex: 0,
      options: [
        {
          id: 'b',
          text: 'B',
          answerKey: { secret: 'private' },
          feedback: 'private',
          nested: { correct: true },
        },
        { id: 'a', text: 'A' },
      ],
    }
    const f = await start({ questions: [legacy] })
    expect(f.a.state().question).toEqual({
      id: 'q',
      kind: 'single-choice',
      prompt: 'Choose B',
      points: 10,
      timeLimit: 30,
      options: [
        { id: 'b', text: 'B' },
        { id: 'a', text: 'A' },
      ],
    })
    expect((await answer(f, 0)).result.correct).toBe(true)
  })
  it('rejects invalid indices without consuming attempts and returns original terminal own receipt', async () => {
    const f = await start()
    for (const index of [-1, 2, 0.5, '0', null])
      expect((await answer(f, index)).error).toBe('invalid-answer')
    expect(f.room.players.get('alice').answers).toEqual([])
    const first = await answer(f, 1),
      repeated = await answer(f, 0)
    expect(repeated.result).toEqual(first.result)
    expect(f.room.players.get('alice').score).toBe(0)
    expect(f.room.players.get('alice').answers).toHaveLength(1)
  })
  it('hydrates only the reconnecting learner receipt and revokes old socket mutations', async () => {
    const f = await start()
    const accepted = await answer(f, 0)
    const reconnected = await wire.client()
    await reconnected.join('room', 'alice', { sessionToken: f.a.session().sessionToken })
    expect(reconnected.state().ownSubmission.result).toEqual(accepted.result)
    expect(engine.getPublicState('room', 'bob').ownSubmission).toBeNull()
    expect((await answer(f, 1)).error).toBe('stale-player-session')
  })
  it('requires current host socket session and trusted host recovery capability', async () => {
    const f = await start()
    expect((await f.a.command('game-next')).error).toBe('host-only')
    const capability = f.host.session().sessionToken
    const fresh = await wire.client()
    const denied = once(fresh.socket, 'game-error')
    fresh.socket.emit('game-join', {
      gameId: 'room',
      playerId: 'host',
      playerName: 'Host',
      role: 'host',
      hostCapability: capability,
    })
    expect((await denied).error).toBe('invalid-host-capability')
    const room = engine.getRoom('room'),
      raw = f.room.hostCapabilityHash
    expect(raw).not.toBe(capability)
    expect(room.currentQuestion).toBe(0)
  })
  it('uses monotonic speed and fractional authored deadlines instead of UTC/client elapsed', async () => {
    const f = await start({ questions: [{ ...question(), timeLimit: 5.5 }] })
    expect(f.a.state().question.timeLimit).toBe(5.5)
    f.room.questionStartedAt = now() - 3000
    expect((await answer(f, 0, { timeSpentMs: 0 })).result.points).toBe(15)
    expect((await answer(f, 0, { timeSpentMs: -1 })).error).toBe('invalid-time-spent')
  })
  it.each([false, true])(
    'preserves late policy %s and never accepts forged timing authority',
    async (allowLate) => {
      const f = await start({ allowLate })
      f.room.questionStartedAt = now() - 60000
      f.room.deadlineMs = now() - 30000
      const result = await answer(f, 0, { timeSpentMs: 0 })
      if (allowLate) expect(result.result.points).toBe(10)
      else {
        expect(result.error).toBe('question-expired')
        expect(f.room.players.get('alice').answers).toEqual([])
      }
    }
  )
  it('rejects malformed canonical admission and unsupported Hot Potato typed questions', () => {
    expect(() =>
      engine.createRoom('bad', 'hot-potato', { questions: [question(), question()] })
    ).toThrow(/unique|duplicate/i)
    expect(() => engine.createRoom('bad', 'hot-potato', { questions: [null] })).toThrow()
    expect(() =>
      engine.createRoom('typed', 'hot-potato', {
        questions: [{ ...question(), kind: 'multi-choice', answerKey: { optionIds: ['b'] } }],
      })
    ).toThrow(/single-choice/i)
    expect(engine.getRoom('typed')).toBeUndefined()
  })
})
