// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { engine, fixture, now } from './game-authority-test-fixture'
const q = (timeLimit = null) => ({
  id: 'q',
  question: 'Choose A',
  options: ['A', 'B'],
  correctIndex: 0,
  points: 10,
  timeLimit,
})
afterEach(() => {
  vi.useRealTimers()
  engine._reset()
})
describe('game room membership and lifecycle', () => {
  it('isolates instances, private capability and mutable player state', () => {
    const a = fixture('hot-potato', { questions: [q()] }, 'a'),
      b = fixture('name-picker', { items: ['A', 'B'] }, 'b')
    a.join('same', 'Alice')
    b.join('same', 'Alice')
    a.command('game-next')
    a.command('game-answer', { questionId: 'q', attemptId: 'a', answerIndex: 0 }, 'same')
    expect(engine.getLeaderboard('a')[0]).toMatchObject({ name: 'Alice', score: 10 })
    expect(engine.getLeaderboard('b').find((player) => player.playerId === 'same').score).toBe(0)
    expect(a.room.roomInstanceId).not.toBe(b.room.roomInstanceId)
    expect(a.room).not.toHaveProperty('hostCapability')
    expect(engine.createRoom('a', 'name-picker')).toBeNull()
  })
  it.each([NaN, Infinity, -Infinity])(
    'rejects nonfinite configuration before legacy normalization: %s',
    (number) => {
      expect(() =>
        engine.createRoom('bad', 'hot-potato', { questions: [{ ...q(30), points: number }] })
      ).toThrow(/finite/)
      expect(engine.getRoom('bad')).toBeUndefined()
    }
  )
  it('reserves host admission while limiting an unclaimed room to 200 learners', () => {
    engine.createRoom('capacity', 'name-picker')
    for (let i = 0; i < 200; i++)
      expect(engine.joinRoom('capacity', `p-${i}`, 'Learner', { socketId: `socket-${i}` }).ok).toBe(
        true
      )
    expect(engine.joinRoom('capacity', 'overflow', 'Learner', { socketId: 'overflow' }).error).toBe(
      'room-full'
    )
    expect(
      engine.joinRoom('capacity', 'host', 'Host', {
        socketId: 'host',
        role: 'host',
        hostCapability: engine.peekHostCapability('capacity'),
      }).isHost
    ).toBe(true)
    expect(
      engine.getPublicState('capacity').players.filter((player) => !player.isHost)
    ).toHaveLength(200)
  })
  it('does not downgrade an authenticated host identity through learner rejoin', () => {
    const f = fixture('hot-potato', { questions: [q()] })
    expect(engine.joinRoom('room', 'host', 'Host', { ...f.hostActor, role: 'player' }).error).toBe(
      'invalid-role'
    )
    expect(
      engine.isHost(
        'room',
        f.hostActor.playerId,
        f.hostActor.socketId,
        f.hostActor.sessionToken,
        f.hostActor.hostCapability
      )
    ).toBe(true)
    expect(
      engine.getPublicState('room').players.find((player) => player.playerId === 'host').isHost
    ).toBe(true)
  })
  it('requires sessions on rejoin and invalidates superseded socket rights', () => {
    const f = fixture('hot-potato', { questions: [q()] })
    const joined = f.join()
    expect(engine.joinRoom('room', 'learner', 'Imposter', { socketId: 'attacker' }).error).toBe(
      'invalid-player-session'
    )
    f.command('game-next')
    const old = f.playerActors.get('learner')
    engine.disconnectRoom('room', 'learner', old.socketId)
    expect(f.join('learner', 'Learner', { socketId: 'reconnected' }).sessionToken).toBe(
      joined.sessionToken
    )
    expect(
      engine.command(
        'game-answer',
        f.envelope({ questionId: 'q', attemptId: 'a', answerIndex: 0 }),
        old
      ).error
    ).toBe('stale-player-session')
    expect(
      f.command('game-answer', { questionId: 'q', attemptId: 'a', answerIndex: 0 }, 'learner')
        .result.totalScore
    ).toBe(10)
  })
  it('reaps unclaimed capabilities independently from player grace', () => {
    vi.useFakeTimers()
    engine._setUnclaimedRoomTtl(100)
    engine._setEmptyRoomTtl(1000)
    const room = engine.createRoom('unclaimed', 'name-picker')
    engine.joinRoom('unclaimed', 'learner', 'Learner', { socketId: 's' })
    engine.disconnectRoom('unclaimed', 'learner', 's')
    expect(engine.peekHostCapability('unclaimed')).toBeTypeOf('string')
    vi.advanceTimersByTime(100)
    expect(engine.getRoom('unclaimed')).toBeUndefined()
    expect(engine.peekHostCapability('unclaimed')).toBeNull()
    expect(room.players.size).toBe(0)
  })
  it('cancels empty grace on authenticated reconnect without cancelling finished TTL', () => {
    vi.useFakeTimers()
    engine._setEmptyRoomTtl(100)
    const f = fixture('name-picker')
    f.join()
    engine.disconnectRoom('room', 'host', 'host-socket')
    engine.disconnectRoom('room', 'learner', 'learner-socket')
    f.join('learner', 'Learner', { socketId: 'new' })
    vi.advanceTimersByTime(100)
    expect(engine.getRoom('room')).toBe(f.room)
    const recovered = engine.joinRoom('room', 'host', 'Host', {
      socketId: 'new-host',
      role: 'host',
      hostCapability: f.hostActor.hostCapability,
    })
    Object.assign(f.hostActor, { socketId: 'new-host', sessionToken: recovered.sessionToken })
    f.command('game-end')
    f.join('learner', 'Learner', { socketId: 'newer' })
    expect(f.room.cleanupKind).toBe('finished')
    vi.advanceTimersByTime(300000)
    expect(engine.getRoom('room')).toBeUndefined()
  })
  it('requires replay before quiz advancement or picker mutations after host end', () => {
    const quiz = fixture('quiz', {}, 'quiz'),
      picker = fixture('name-picker', {}, 'picker')
    quiz.command('game-end')
    picker.command('game-end')
    expect(quiz.command('game-next').error).toBe('game-ended')
    expect(picker.command('game-random').error).toBe('game-ended')
    quiz.command('game-reset')
    picker.command('game-reset')
    expect(quiz.command('game-next').accepted).toBe(true)
    expect(picker.command('game-random').accepted).toBe(true)
  })
  it('removes explicit members and cleans only the requested instance', () => {
    const f = fixture('name-picker')
    f.join()
    fixture('name-picker', {}, 'other')
    engine.leaveRoom('room', 'learner', { ...f.playerActors.get('learner'), requireSession: true })
    expect(f.room.players.has('learner')).toBe(false)
    engine.cleanup('room')
    expect(engine.getRoom('other')).toBeDefined()
    expect(engine.getRoom('room')).toBeUndefined()
  })
})
describe('Hot Potato authoritative scoring', () => {
  it.each([
    [0, true, 10],
    [1, false, 0],
  ])('grades boundary index %i once', (answerIndex, correct, points) => {
    const f = fixture('hot-potato', { questions: [q()] })
    f.join()
    f.command('game-next')
    const result = f.command(
      'game-answer',
      { questionId: 'q', attemptId: 'a', answerIndex },
      'learner'
    )
    expect(result.result).toMatchObject({ correct, points, totalScore: points })
    f.command(
      'game-answer',
      { questionId: 'q', attemptId: 'b', answerIndex: 1 - answerIndex },
      'learner'
    )
    expect(f.room.players.get('learner').score).toBe(points)
    expect(f.room.players.get('learner').answers).toHaveLength(1)
  })
  it('uses monotonic server elapsed for speed while ignoring forged client timing and points', () => {
    const f = fixture('hot-potato', { questions: [q(30)] })
    f.join()
    f.command('game-next')
    f.room.questionStartedAt = now() - 15000
    expect(
      f.command(
        'game-answer',
        { questionId: 'q', attemptId: 'a', answerIndex: 0, timeSpentMs: 0, points: 100000 },
        'learner'
      ).result.points
    ).toBe(15)
  })
  it.each([false, true])('enforces explicit late policy %s', (allowLate) => {
    const f = fixture('hot-potato', { allowLate, questions: [q(5)] })
    f.join()
    f.command('game-next')
    f.room.questionStartedAt = now() - 6000
    f.room.deadlineMs = now() - 1000
    const result = f.command(
      'game-answer',
      { questionId: 'q', attemptId: 'a', answerIndex: 0 },
      'learner'
    )
    if (allowLate) expect(result.result.points).toBe(10)
    else {
      expect(result.error).toBe('question-expired')
      expect(f.room.players.get('learner').score).toBe(0)
    }
  })
  it('rejects invalid index/question/timing and final advancement finishes', () => {
    const f = fixture('hot-potato', { questions: [q()] })
    f.join()
    f.command('game-next')
    for (const fields of [
      { answerIndex: -1 },
      { answerIndex: 0, questionId: 'stale' },
      { answerIndex: 0, timeSpentMs: -1 },
    ]) {
      expect(
        f.command('game-answer', { questionId: 'q', attemptId: 'a', ...fields }, 'learner').accepted
      ).toBe(false)
    }
    expect(f.room.players.get('learner').answers).toEqual([])
    f.command('game-next')
    expect(f.room.status).toBe('finished')
  })
  it('migrates legacy bounds but rejects malformed canonical IDs/kinds', () => {
    const f = fixture('hot-potato', { questions: [{ ...q(9999), points: 100000 }] })
    expect(f.room.questions[0]).toMatchObject({ timeLimit: 300, points: 1000 })
    expect(() => engine.createRoom('bad', 'hot-potato', { questions: [q(), q()] })).toThrow(
      /unique|duplicate/i
    )
    expect(() => engine.createRoom('bad', 'hot-potato', { questions: [null] })).toThrow()
  })
})
describe('shared weighted name picker', () => {
  it('preserves stable winner after exclusion shifts public indices and exhausts', () => {
    const f = fixture('name-picker', { items: ['A', 'B', 'C'], excludeAfterPick: true })
    const random = vi
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0)
    expect(f.command('game-random').result).toMatchObject({ winnerIndex: 1, winner: 'B' })
    expect(f.command('game-random').result).toMatchObject({ winnerIndex: 1, winner: 'C' })
    expect(f.command('game-random').result.winner).toBe('A')
    expect(f.command('game-random').result.winnerIndex).toBe(-1)
    random.mockRestore()
  })
})
