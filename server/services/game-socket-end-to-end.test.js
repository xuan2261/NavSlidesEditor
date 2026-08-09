// @vitest-environment node
/**
 * Socket-LAYER end-to-end tests for game mode.
 *
 * These tests traverse the REAL socket.io transport the same way the client
 * hooks do (namespace '/games', path '/ws', the fixed client payload shapes).
 * Calling GameEngine directly is what hid the namespace/field-name dead-end
 * (defect C1), so every assertion here is driven through emit/receive.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { Server } from 'socket.io'
import { io as ioClient } from 'socket.io-client'

// Both modules are CommonJS and the handler pulls GameEngine via require().
// Load them through the same require() here so the test shares the EXACT
// singleton instance the handler mutates — an ESM import would resolve to a
// separate module copy under vitest and the room state would not line up.
const require = createRequire(import.meta.url)
const GameEngine = require('./game-room-manager-singleton-service')
const { setupGameSocketHandlers } = require('./game-socket-handler')

let httpServer
let io
let port
const clients = []

function connectClient() {
  // Mirror the hook exactly: namespace '/games', path '/ws'.
  const sock = ioClient(`http://localhost:${port}/games`, {
    path: '/ws',
    reconnection: false,
    forceNew: true,
    transports: ['websocket'],
  })
  clients.push(sock)
  return sock
}

function waitConnect(sock) {
  return new Promise((resolve, reject) => {
    sock.once('connect', resolve)
    sock.once('connect_error', reject)
  })
}

function once(sock, event) {
  return new Promise((resolve) => sock.once(event, resolve))
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function joinAndWait(sock, payload) {
  let hostCapability = payload.hostCapability
  if (payload.role === 'host' && !GameEngine.getRoom(payload.gameId) && payload.gameType) {
    GameEngine.createRoom(payload.gameId, payload.gameType, payload.options || {})
  }
  if (payload.role === 'host' && !hostCapability) {
    hostCapability = GameEngine.takeHostCapability(payload.gameId)
  }
  const joined = once(sock, 'game-player-joined')
  sock.emit('game-join', {
    ...payload,
    ...(hostCapability ? { hostCapability } : {}),
  })
  return joined
}

beforeEach(async () => {
  GameEngine._reset()
  httpServer = createServer()
  io = new Server(httpServer, { path: '/ws' })
  setupGameSocketHandlers(io)
  await new Promise((resolve) => httpServer.listen(0, resolve))
  port = httpServer.address().port
})

afterEach(async () => {
  for (const sock of clients) sock.disconnect()
  clients.length = 0
  io.close()
  await new Promise((resolve) => httpServer.close(resolve))
  GameEngine._reset()
})

describe('game socket end-to-end', () => {
  it('rejects malformed unauthenticated payloads without disconnecting the socket', async () => {
    const sock = connectClient()
    await waitConnect(sock)

    const nextError = once(sock, 'game-error')
    sock.emit('game-next')
    expect(await nextError).toMatchObject({ message: 'Not in a game room' })
    expect(sock.connected).toBe(true)

    const answerError = once(sock, 'game-error')
    sock.emit('game-answer')
    expect(await answerError).toMatchObject({ message: 'Not in a game room' })
    expect(sock.connected).toBe(true)

    const nullNextError = once(sock, 'game-error')
    sock.emit('game-next', null)
    expect(await nullNextError).toMatchObject({ message: 'Not in a game room' })
    const nullAnswerError = once(sock, 'game-error')
    sock.emit('game-answer', null)
    expect(await nullAnswerError).toMatchObject({ message: 'Not in a game room' })
    expect(sock.connected).toBe(true)
  })

  it('redacts answer keys from public question events and rejects missing timing', async () => {
    GameEngine.createRoom('redaction-room', 'hot-potato', {
      questions: [{
        id: 'q-secret',
        question: 'Which option is correct?',
        options: ['A', 'B'],
        correctIndex: 1,
        explanation: 'Private explanation',
        timeLimit: 30,
        points: 10,
      }],
    })
    const host = connectClient()
    const player = connectClient()
    await Promise.all([waitConnect(host), waitConnect(player)])
    await joinAndWait(host, {
      gameId: 'redaction-room',
      gameType: 'hot-potato',
      role: 'host',
      playerName: 'Presenter',
      playerId: 'host-player',
    })
    await joinAndWait(player, {
      gameId: 'redaction-room',
      gameType: 'hot-potato',
      role: 'player',
      playerName: 'Learner',
      playerId: 'learner-player',
    })

    const questionEvent = once(player, 'game-question')
    host.emit('game-next', { gameId: 'redaction-room' })
    const question = await questionEvent
    expect(question.question).toMatchObject({
      id: 'q-secret',
      question: 'Which option is correct?',
      options: ['A', 'B'],
    })
    expect(question.question).not.toHaveProperty('correctIndex')
    expect(question.question).not.toHaveProperty('explanation')
    expect(question.allowLate).toBe(false)
    expect(question.questionStartedAt).toEqual(expect.any(Number))
    expect(question.timeRemainingMs).toBeGreaterThan(0)

    GameEngine.getRoom('redaction-room').questionStartedAt = Date.now() - 15000
    const answerResult = once(player, 'game-answer-result')
    player.emit('game-answer', { gameId: 'redaction-room', questionId: 'q-secret', answerIndex: 1 })
    const result = await answerResult
    expect(result.correct).toBe(true)
    expect(result.points).toBeGreaterThan(10)
    expect(result.points).toBeLessThan(20)
  })

  it('redacts answer markers from object options and scores by correctIndex', async () => {
    GameEngine.createRoom('object-option-redaction-room', 'hot-potato', {
      questions: [{
        id: 'q-object-options',
        question: 'Choose the canonical answer',
        options: [
          { text: 'A', correct: true },
          { text: 'B', correct: false },
        ],
        correctIndex: 1,
        timeLimit: 30,
        points: 10,
      }],
    })
    const host = connectClient()
    const player = connectClient()
    await Promise.all([waitConnect(host), waitConnect(player)])
    await joinAndWait(host, {
      gameId: 'object-option-redaction-room',
      gameType: 'hot-potato',
      role: 'host',
      playerName: 'Presenter',
      playerId: 'object-option-host',
    })
    await joinAndWait(player, {
      gameId: 'object-option-redaction-room',
      gameType: 'hot-potato',
      role: 'player',
      playerName: 'Learner',
      playerId: 'object-option-player',
    })

    const questionEvent = once(player, 'game-question')
    host.emit('game-next', { gameId: 'object-option-redaction-room' })
    const question = await questionEvent

    expect(question.question.options).toEqual(['A', 'B'])
    expect(question.question.options.some((option) => option && typeof option === 'object')).toBe(false)

    const answerResult = once(player, 'game-answer-result')
    player.emit('game-answer', {
      gameId: 'object-option-redaction-room',
      questionId: 'q-object-options',
      answerIndex: 1,
      timeSpentMs: 100,
    })
    expect(await answerResult).toMatchObject({ correct: true, answerIndex: 1 })
  })

  it('rejects an answer bound to a previous question after the host advances', async () => {
    GameEngine.createRoom('stale-question-room', 'hot-potato', {
      questions: [
        { id: 'q1', correctIndex: 0, points: 10 },
        { id: 'q2', correctIndex: 1, points: 10 },
      ],
    })
    const host = connectClient()
    const player = connectClient()
    await Promise.all([waitConnect(host), waitConnect(player)])
    await joinAndWait(host, {
      gameId: 'stale-question-room',
      gameType: 'hot-potato',
      role: 'host',
      playerName: 'Presenter',
      playerId: 'p-host',
    })
    await joinAndWait(player, {
      gameId: 'stale-question-room',
      gameType: 'hot-potato',
      role: 'player',
      playerName: 'Learner',
      playerId: 'p-learner',
    })

    const firstQuestion = once(player, 'game-question')
    host.emit('game-next', { gameId: 'stale-question-room' })
    expect((await firstQuestion).question.id).toBe('q1')

    const secondQuestion = once(player, 'game-question')
    host.emit('game-next', { gameId: 'stale-question-room' })
    expect((await secondQuestion).question.id).toBe('q2')

    const stale = once(player, 'game-error')
    player.emit('game-answer', {
      gameId: 'stale-question-room',
      questionId: 'q1',
      answerIndex: 0,
      timeSpentMs: 100,
    })
    expect(await stale).toMatchObject({ message: 'stale-question' })
    const playerState = GameEngine.getRoom('stale-question-room').players.get('p-learner')
    expect(playerState.score).toBe(0)
    expect(playerState.answers).toHaveLength(0)

    const valid = once(player, 'game-answer-result')
    player.emit('game-answer', {
      gameId: 'stale-question-room',
      questionId: 'q2',
      answerIndex: 1,
      timeSpentMs: 100,
    })
    expect(await valid).toMatchObject({ correct: true, totalScore: 10 })
    expect(playerState.answers).toHaveLength(1)
  })

  it('emits game-ended instead of replaying the final question', async () => {
    GameEngine.createRoom('final-question-room', 'hot-potato', {
      questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
    })
    const host = connectClient()
    await waitConnect(host)
    await joinAndWait(host, {
      gameId: 'final-question-room',
      gameType: 'hot-potato',
      role: 'host',
      playerName: 'Presenter',
      playerId: 'p-host',
    })

    const firstQuestion = once(host, 'game-question')
    host.emit('game-next', { gameId: 'final-question-room' })
    expect((await firstQuestion).question.id).toBe('q1')

    const ended = once(host, 'game-ended')
    host.emit('game-next', { gameId: 'final-question-room' })
    expect(await ended).toMatchObject({ finalScores: [{ playerId: 'p-host', score: 0 }] })
  })

  // C1 tripwire: namespace + field names line up across the wire.
  it('join flow: client receives game-player-joined with itself listed', async () => {
    GameEngine.createRoom('room1', 'name-picker', { items: ['A'] })
    const sock = connectClient()
    await waitConnect(sock)

    const data = await joinAndWait(sock, {
      gameId: 'room1',
      playerName: 'Alice',
      playerId: 'p-alice',
    })

    expect(data.players.some((p) => p.name === 'Alice')).toBe(true)
  })

  it('rejects player-id impersonation without the server-issued session', async () => {
    GameEngine.createRoom('session-host-room', 'hot-potato', {
      questions: [{ id: 'q1', correctIndex: 0, points: 10 }, { id: 'q2', correctIndex: 1, points: 10 }],
    })
    const host = connectClient()
    await waitConnect(host)
    const hostSession = once(host, 'game-session')
    await joinAndWait(host, {
      gameId: 'session-host-room',
      playerName: 'Host',
      playerId: 'p-host',
      role: 'host',
    })
    const session = await hostSession
    expect(session).toMatchObject({ playerId: 'p-host' })
    expect(typeof session.sessionToken).toBe('string')

    const attacker = connectClient()
    await waitConnect(attacker)
    const impersonationError = once(attacker, 'game-error')
    attacker.emit('game-join', {
      gameId: 'session-host-room',
      playerName: 'Attacker',
      playerId: 'p-host',
      role: 'player',
    })

    expect((await impersonationError).message).toBe('invalid-player-session')
    expect(GameEngine.getRoom('session-host-room').players.get('p-host').socketId).toBe(host.id)

    const hostQuestion = once(host, 'game-question')
    host.emit('game-next', { gameId: 'session-host-room' })
    expect((await hostQuestion).question.id).toBe('q1')
  })

  it('reissues a host session when a reconnect loses the initial session event', async () => {
    GameEngine.createRoom('host-session-recovery-room', 'name-picker', { items: ['A', 'B'] })
    const hostCapability = GameEngine.peekHostCapability('host-session-recovery-room')
    const first = connectClient()
    await waitConnect(first)
    const firstSessionEvent = once(first, 'game-session')
    await joinAndWait(first, {
      gameId: 'host-session-recovery-room',
      playerName: 'Host',
      playerId: 'p-host',
      role: 'host',
      hostCapability,
    })
    const firstSession = await firstSessionEvent
    first.disconnect()

    const second = connectClient()
    await waitConnect(second)
    const recoveredSessionEvent = once(second, 'game-session')
    await joinAndWait(second, {
      gameId: 'host-session-recovery-room',
      playerName: 'Host',
      playerId: 'p-host',
      role: 'host',
      hostCapability,
    })
    const recoveredSession = await recoveredSessionEvent

    expect(recoveredSession.playerId).toBe('p-host')
    expect(recoveredSession.sessionToken).toEqual(expect.any(String))
    expect(recoveredSession.sessionToken).not.toBe(firstSession.sessionToken)
  })

  it('evicts stale socket membership before an expired game ID is recreated', async () => {
    GameEngine._setUnclaimedRoomTtl(1000)
    GameEngine.createRoom('expired-generation-room', 'name-picker', { items: ['A'] })
    const player = connectClient()
    await waitConnect(player)
    const expired = once(player, 'game-room-expired')
    await joinAndWait(player, {
      gameId: 'expired-generation-room',
      playerName: 'Waiting Player',
      playerId: 'p-waiting',
      role: 'player',
    })

    // The manager timer is covered separately; call cleanup after membership
    // is established so this socket-generation regression is deterministic.
    GameEngine.cleanup('expired-generation-room')
    expect((await expired).gameId).toBe('expired-generation-room')
    expect(GameEngine.getRoom('expired-generation-room')).toBeUndefined()

    let staleBroadcast = false
    const onStaleBroadcast = () => { staleBroadcast = true }
    player.on('game-player-joined', onStaleBroadcast)

    GameEngine.createRoom('expired-generation-room', 'name-picker', { items: ['B'] })
    const host = connectClient()
    await waitConnect(host)
    const hostCapability = GameEngine.peekHostCapability('expired-generation-room')
    await joinAndWait(host, {
      gameId: 'expired-generation-room',
      playerName: 'New Host',
      playerId: 'p-new-host',
      role: 'host',
      hostCapability,
    })
    await delay(10)
    player.off('game-player-joined', onStaleBroadcast)

    expect(staleBroadcast).toBe(false)
  })

  it('rejects answers from a stale socket after a valid player reconnects', async () => {
    GameEngine.createRoom('session-player-room', 'hot-potato', {
      questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
    })
    GameEngine.nextQuestion('session-player-room')
    const first = connectClient()
    await waitConnect(first)
    const firstSession = once(first, 'game-session')
    await joinAndWait(first, {
      gameId: 'session-player-room',
      playerName: 'Alice',
      playerId: 'p-alice',
      role: 'player',
    })
    const { sessionToken } = await firstSession

    const second = connectClient()
    await waitConnect(second)
    await joinAndWait(second, {
      gameId: 'session-player-room',
      playerName: 'Alice',
      playerId: 'p-alice',
      role: 'player',
      sessionToken,
    })

    const staleError = once(first, 'game-error')
    first.emit('game-answer', { gameId: 'session-player-room', questionId: 'q1', answerIndex: 0, timeSpentMs: 1000 })
    expect((await staleError).message).toBe('stale-player-session')
    expect(GameEngine.getRoom('session-player-room').players.get('p-alice').score).toBe(0)

    const answerResult = once(second, 'game-answer-result')
    second.emit('game-answer', { gameId: 'session-player-room', questionId: 'q1', answerIndex: 0, timeSpentMs: 1000 })
    expect((await answerResult).totalScore).toBe(10)
  })

  it('hydrates an answered question after the player reconnects', async () => {
    GameEngine.createRoom('reconnect-answer-room', 'hot-potato', {
      questions: [{ id: 'q1', correctIndex: 1, points: 10, timeLimit: 30 }],
    })
    GameEngine.nextQuestion('reconnect-answer-room')

    const first = connectClient()
    await waitConnect(first)
    const firstSession = once(first, 'game-session')
    const firstQuestion = once(first, 'game-question')
    await joinAndWait(first, {
      gameId: 'reconnect-answer-room',
      playerName: 'Alice',
      playerId: 'p-alice',
      role: 'player',
    })
    const { sessionToken } = await firstSession
    await firstQuestion

    const firstResult = once(first, 'game-answer-result')
    first.emit('game-answer', {
      gameId: 'reconnect-answer-room',
      questionId: 'q1',
      answerIndex: 0,
      timeSpentMs: 1000,
    })
    await expect(firstResult).resolves.toMatchObject({
      correct: false,
      correctIndex: 1,
      answerIndex: 0,
      points: 0,
    })
    first.disconnect()

    const second = connectClient()
    await waitConnect(second)
    const hydratedQuestion = once(second, 'game-question')
    const hydratedResult = once(second, 'game-answer-result')
    await joinAndWait(second, {
      gameId: 'reconnect-answer-room',
      playerName: 'Alice',
      playerId: 'p-alice',
      role: 'player',
      sessionToken,
    })

    const [question, result] = await Promise.all([hydratedQuestion, hydratedResult])
    expect(question.question).not.toHaveProperty('correctIndex')
    expect(result).toMatchObject({
      correct: false,
      correctIndex: 1,
      answerIndex: 0,
      points: 0,
      totalScore: 0,
    })
  })

  it('rejects an expired answer when late answers are disabled', async () => {
    GameEngine.createRoom('expired-answer-room', 'hot-potato', {
      allowLate: false,
      questions: [{ id: 'q1', correctIndex: 0, points: 10, timeLimit: 5 }],
    })
    GameEngine.nextQuestion('expired-answer-room')
    GameEngine.getRoom('expired-answer-room').questionStartedAt = Date.now() - 6000

    const sock = connectClient()
    await waitConnect(sock)
    await joinAndWait(sock, {
      gameId: 'expired-answer-room',
      playerName: 'Alice',
      playerId: 'p-alice',
    })

    const expired = once(sock, 'game-error')
    sock.emit('game-answer', { gameId: 'expired-answer-room', questionId: 'q1', answerIndex: 0, timeSpentMs: 0 })
    expect(await expired).toMatchObject({ message: 'question-expired' })
    expect(GameEngine.getRoom('expired-answer-room').players.get('p-alice').score).toBe(0)
  })

  it('lets an editor observe a game without claiming host authority', async () => {
    const host = connectClient()
    await waitConnect(host)
    await joinAndWait(host, {
      gameId: 'observer-room',
      playerName: 'Host',
      playerId: 'p-host',
      role: 'host',
      gameType: 'hot-potato',
      options: { questions: [{ id: 'q1', correctIndex: 0, points: 10 }] },
    })
    expect(GameEngine.getRoom('observer-room')).toMatchObject({
      hostPlayerId: 'p-host',
      hostSocketId: host.id,
    })
    GameEngine.nextQuestion('observer-room')

    const observer = connectClient()
    await waitConnect(observer)
    const initialLeaderboard = once(observer, 'game-leaderboard')
    observer.emit('game-join', {
      gameId: 'observer-room',
      playerName: 'editor-observer',
      playerId: 'editor-observer',
      role: 'observer',
    })

    expect((await initialLeaderboard).scores).toEqual([
      { playerId: 'p-host', name: 'Host', score: 0 },
    ])
    expect(GameEngine.getRoom('observer-room').players.size).toBe(1)
    expect(GameEngine.getRoom('observer-room')).toMatchObject({
      hostPlayerId: 'p-host',
      hostSocketId: host.id,
    })

    const player = connectClient()
    await waitConnect(player)
    await joinAndWait(player, {
      gameId: 'observer-room',
      playerName: 'Alice',
      playerId: 'p-alice',
      role: 'player',
    })
    expect(GameEngine.isHost('observer-room', 'p-alice')).toBe(false)

    const observerLeaderboard = once(observer, 'game-leaderboard')
    player.emit('game-answer', { gameId: 'observer-room', questionId: 'q1', answerIndex: 0, timeSpentMs: 1000 })
    const updatedScores = await observerLeaderboard
    expect(updatedScores.scores).toHaveLength(2)
    expect(updatedScores.scores[0]).toMatchObject({ playerId: 'p-alice', score: 10 })
  })

  // 2. Anti-cheat: answering the same question twice scores only once.
  it('rejects duplicate answers — score increments only once', async () => {
    GameEngine.createRoom('room2', 'hot-potato', {
      questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
    })
    GameEngine.nextQuestion('room2')
    const sock = connectClient()
    await waitConnect(sock)
    await joinAndWait(sock, { gameId: 'room2', playerName: 'Bob', playerId: 'p-bob' })

    const r1 = once(sock, 'game-answer-result')
    sock.emit('game-answer', { gameId: 'room2', questionId: 'q1', answerIndex: 0, timeSpentMs: 1000 })
    await r1

    // The repeat returns the persisted result, not a misleading pending error.
    const dup = once(sock, 'game-answer-result')
    sock.emit('game-answer', { gameId: 'room2', questionId: 'q1', answerIndex: 0, timeSpentMs: 1000 })
    expect((await dup)).toMatchObject({ correct: true, answerIndex: 0, points: 10, totalScore: 10 })

    const room = GameEngine.getRoom('room2')
    const player = [...room.players.values()][0]
    expect(player.score).toBe(10)
    expect(player.answers).toHaveLength(1)
  })

  // 3. Authorization: a non-host socket cannot advance the question.
  it('rejects presenter event (game-next) from a non-host socket', async () => {
    GameEngine.createRoom('room3', 'hot-potato', {
      questions: [{ id: 'q1', correctIndex: 0, points: 10 }, { id: 'q2', correctIndex: 1, points: 10 }],
    })

    const host = connectClient()
    await waitConnect(host)
    await joinAndWait(host, { gameId: 'room3', playerName: 'Host', playerId: 'p-host', role: 'host' })

    const player = connectClient()
    await waitConnect(player)
    await joinAndWait(player, { gameId: 'room3', playerName: 'P', playerId: 'p-2', role: 'player' })

    const errP = once(player, 'game-error')
    player.emit('game-next', { gameId: 'room3' })
    const err = await errP

    expect(err.message).toBeDefined()
    expect(GameEngine.getRoom('room3').currentQuestion).toBe(-1)

    GameEngine.createRoom('room3-other', 'name-picker', { items: ['A'] })
    const otherHostCapability = GameEngine.takeHostCapability('room3-other')
    GameEngine.joinRoom('room3-other', 'p-host', 'Host', {
      socketId: host.id,
      role: 'host',
      hostCapability: otherHostCapability,
    })
    const crossRoomErr = once(host, 'game-error')
    host.emit('game-random', { gameId: 'room3-other' })
    expect((await crossRoomErr).message).toBe('Invalid game room for this socket')
  })

  it('rejects a second room join without leaking the original membership', async () => {
    GameEngine._setEmptyRoomTtl(10)
    GameEngine.createRoom('room-switch-a', 'name-picker', { items: ['A'] })
    GameEngine.createRoom('room-switch-b', 'name-picker', { items: ['B'] })

    const sock = connectClient()
    await waitConnect(sock)
    await joinAndWait(sock, {
      gameId: 'room-switch-a',
      playerName: 'Alice',
      playerId: 'p-alice',
    })

    const crossRoomErr = once(sock, 'game-error')
    sock.emit('game-join', {
      gameId: 'room-switch-b',
      playerName: 'Alice',
      playerId: 'p-alice',
    })

    expect((await crossRoomErr).message).toBe('already-joined-room')
    expect(GameEngine.getRoom('room-switch-a').players.get('p-alice').socketId).toBe(sock.id)
    expect(GameEngine.getRoom('room-switch-b').players.size).toBe(0)

    sock.disconnect()
    await delay(30)
    expect(GameEngine.getRoom('room-switch-a')).toBeUndefined()
    expect(GameEngine.getRoom('room-switch-b')).toBeDefined()
  })

  // 4. Room cleanup with reconnect grace.
  it('cancels pending empty-room cleanup when the same playerId rejoins', async () => {
    GameEngine._setEmptyRoomTtl(300)
    GameEngine.createRoom('room4', 'name-picker', { items: ['A'] })

    const sock = connectClient()
    await waitConnect(sock)
    await joinAndWait(sock, { gameId: 'room4', playerName: 'Solo', playerId: 'p-solo' })

    sock.emit('game-leave', { gameId: 'room4' })
    await delay(50)
    // Cleanup scheduled but not yet fired — room still present.
    expect(GameEngine.getRoom('room4')).toBeDefined()

    // Rejoin with the SAME playerId before the TTL elapses.
    const sock2 = connectClient()
    await waitConnect(sock2)
    await joinAndWait(sock2, { gameId: 'room4', playerName: 'Solo', playerId: 'p-solo' })

    // Wait past the original TTL — rejoin must have cancelled cleanup.
    await delay(400)
    expect(GameEngine.getRoom('room4')).toBeDefined()
  })

  it('schedules cleanup after the last connected player leaves', async () => {
    GameEngine._setEmptyRoomTtl(300)
    GameEngine.createRoom('room4-stale-player', 'name-picker', { items: ['A'] })

    const host = connectClient()
    const player = connectClient()
    await Promise.all([waitConnect(host), waitConnect(player)])
    await joinAndWait(host, {
      gameId: 'room4-stale-player',
      gameType: 'name-picker',
      playerName: 'Presenter',
      playerId: 'p-host',
      role: 'host',
    })
    await joinAndWait(player, {
      gameId: 'room4-stale-player',
      playerName: 'Alice',
      playerId: 'p-player',
      role: 'player',
    })

    player.disconnect()
    await delay(50)
    expect(GameEngine.getRoom('room4-stale-player').players.get('p-player').socketId).toBeNull()

    host.emit('game-leave', { gameId: 'room4-stale-player' })
    await delay(50)
    expect(GameEngine.getRoom('room4-stale-player').cleanupKind).toBe('empty')
  })

  // 5. Random determinism: every client sees the SAME server-chosen index.
  it('broadcasts identical winnerIndex to all clients on game-random', async () => {
    GameEngine.createRoom('room5', 'name-picker', { items: ['A', 'B', 'C'], excludeAfterPick: false })

    const host = connectClient()
    await waitConnect(host)
    await joinAndWait(host, { gameId: 'room5', playerName: 'Host', playerId: 'p-host', role: 'host' })

    const viewer = connectClient()
    await waitConnect(viewer)
    await joinAndWait(viewer, { gameId: 'room5', playerName: 'V', playerId: 'p-v', role: 'player' })

    const hostResult = once(host, 'game-random-result')
    const viewerResult = once(viewer, 'game-random-result')
    host.emit('game-random', { gameId: 'room5' })

    const [hr, vr] = await Promise.all([hostResult, viewerResult])
    expect(typeof hr.winnerIndex).toBe('number')
    expect(hr.winnerIndex).toBe(vr.winnerIndex)
  })

  it('broadcasts the stable picked value after excluded items shift server indexes', async () => {
    const random = vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.99)
    try {
      GameEngine.createRoom('room5-excluded', 'name-picker', {
        items: ['A', 'B', 'C'],
        excludeAfterPick: true,
      })

      const host = connectClient()
      await waitConnect(host)
      await joinAndWait(host, {
        gameId: 'room5-excluded',
        playerName: 'Host',
        playerId: 'p-host',
        role: 'host',
      })

      const firstResult = once(host, 'game-random-result')
      host.emit('game-random', { gameId: 'room5-excluded' })
      expect(await firstResult).toMatchObject({ winnerIndex: 1, winner: 'B' })

      const secondResult = once(host, 'game-random-result')
      host.emit('game-random', { gameId: 'room5-excluded' })
      expect(await secondResult).toMatchObject({ winnerIndex: 1, winner: 'C' })
    } finally {
      random.mockRestore()
    }
  })

  it('runs poll start, vote update, host authorization, and aggregate broadcast through sockets', async () => {
    const host = connectClient()
    await waitConnect(host)
    await joinAndWait(host, {
      gameId: 'poll-room',
      playerName: 'Host',
      playerId: 'p-host',
      role: 'host',
      gameType: 'poll',
      options: {
        prompt: 'Choose one',
        options: [
          { id: 'a', text: 'Alpha' },
          { id: 'b', text: 'Beta' },
        ],
      },
    })

    const player = connectClient()
    await waitConnect(player)
    await joinAndWait(player, {
      gameId: 'poll-room',
      playerName: 'Alice',
      playerId: 'p-alice',
      role: 'player',
    })

    const inactiveErr = once(player, 'game-error')
    player.emit('game-poll-submit', { gameId: 'poll-room', optionId: 'a' })
    expect((await inactiveErr).message).toBe('poll-not-active')

    const nonHostErr = once(player, 'game-error')
    player.emit('game-poll-reveal', { gameId: 'poll-room' })
    expect((await nonHostErr).message).toContain('host only')

    const startedHost = once(host, 'game-poll-started')
    const startedPlayer = once(player, 'game-poll-started')
    host.emit('game-poll-start', { gameId: 'poll-room' })
    await Promise.all([startedHost, startedPlayer])

    const firstAggregate = once(host, 'game-poll-results')
    player.emit('game-poll-submit', { gameId: 'poll-room', optionId: 'a' })
    expect(await firstAggregate).toMatchObject({
      totalVotes: 1,
      options: [
        { id: 'a', votes: 1 },
        { id: 'b', votes: 0 },
      ],
    })

    const updatedAggregate = once(host, 'game-poll-results')
    player.emit('game-poll-submit', { gameId: 'poll-room', optionId: 'b' })
    expect(await updatedAggregate).toMatchObject({
      totalVotes: 1,
      options: [
        { id: 'a', votes: 0 },
        { id: 'b', votes: 1 },
      ],
    })

    const crossRoomErr = once(player, 'game-error')
    player.emit('game-poll-submit', { gameId: 'other-room', optionId: 'b' })
    expect((await crossRoomErr).message).toBe('Invalid game room for this socket')

    const leaveAggregate = once(host, 'game-poll-results')
    player.emit('game-leave', { gameId: 'poll-room' })
    expect(await leaveAggregate).toMatchObject({ totalVotes: 0 })
  })

  it('runs word cloud start, bounded text submit, rate limit, and clear through sockets', async () => {
    const host = connectClient()
    await waitConnect(host)
    await joinAndWait(host, {
      gameId: 'cloud-room',
      playerName: 'Host',
      playerId: 'p-host',
      role: 'host',
      gameType: 'word-cloud',
      options: {
        prompt: 'One word',
      },
    })

    const player = connectClient()
    await waitConnect(player)
    await joinAndWait(player, {
      gameId: 'cloud-room',
      playerName: 'Alice',
      playerId: 'p-alice',
      role: 'player',
    })

    const inactiveErr = once(player, 'game-error')
    player.emit('game-word-cloud-submit', { gameId: 'cloud-room', text: 'early' })
    expect((await inactiveErr).message).toBe('word-cloud-not-active')

    const nonHostErr = once(player, 'game-error')
    player.emit('game-word-cloud-clear', { gameId: 'cloud-room' })
    expect((await nonHostErr).message).toContain('host only')

    const startedHost = once(host, 'game-word-cloud-started')
    const startedPlayer = once(player, 'game-word-cloud-started')
    host.emit('game-word-cloud-start', { gameId: 'cloud-room' })
    await Promise.all([startedHost, startedPlayer])

    const firstAggregate = once(host, 'game-word-cloud-results')
    player.emit('game-word-cloud-submit', { gameId: 'cloud-room', text: '  Quantum   Field  ' })
    expect(await firstAggregate).toMatchObject({
      totalSubmissions: 1,
      entries: [{ text: 'quantum field', count: 1 }],
    })

    const revealedAggregate = once(host, 'game-word-cloud-results')
    host.emit('game-word-cloud-reveal', { gameId: 'cloud-room' })
    expect(await revealedAggregate).toMatchObject({
      totalSubmissions: 1,
      entries: [{ text: 'quantum field', count: 1 }],
    })

    for (let i = 0; i < 4; i++) {
      const aggregate = once(host, 'game-word-cloud-results')
      player.emit('game-word-cloud-submit', { gameId: 'cloud-room', text: `term ${i}` })
      await aggregate
    }
    const limitErr = once(player, 'game-error')
    player.emit('game-word-cloud-submit', { gameId: 'cloud-room', text: 'term 5' })
    expect((await limitErr).message).toBe('word-cloud-rate-limit')

    const crossRoomErr = once(player, 'game-error')
    player.emit('game-word-cloud-submit', { gameId: 'other-room', text: 'wrong room' })
    expect((await crossRoomErr).message).toBe('Invalid game room for this socket')

    const cleared = once(host, 'game-word-cloud-results')
    host.emit('game-word-cloud-clear', { gameId: 'cloud-room' })
    expect(await cleared).toMatchObject({ totalSubmissions: 0, entries: [] })
  })

  it('hydrates late players with the active state for each game mode', async () => {
    const hydrate = async ({ gameId, gameType, options, event, startEvent, expected }) => {
      const host = connectClient()
      await waitConnect(host)
      await joinAndWait(host, {
        gameId,
        playerName: 'Host',
        playerId: `${gameId}-host`,
        role: 'host',
        gameType,
        options,
      })

      if (gameType === 'hot-potato') {
        const question = once(host, 'game-question')
        host.emit('game-next', { gameId })
        await question
      } else {
        const started = once(host, event)
        host.emit(startEvent, { gameId })
        await started
      }

      const player = connectClient()
      await waitConnect(player)
      const hydrated = once(player, event)
      await joinAndWait(player, {
        gameId,
        playerName: 'Late Player',
        playerId: `${gameId}-player`,
        role: 'player',
      })
      expect(await hydrated).toMatchObject(expected)
    }

    await hydrate({
      gameId: 'hydrate-quiz',
      gameType: 'hot-potato',
      options: { questions: [{ id: 'q1', question: 'One?', options: ['Yes'], correctIndex: 0 }] },
      event: 'game-question',
      expected: { question: { id: 'q1' }, questionNumber: 1 },
    })
    await hydrate({
      gameId: 'hydrate-poll',
      gameType: 'poll',
      options: { prompt: 'Choose one', options: [{ id: 'a', text: 'Alpha' }] },
      event: 'game-poll-started',
      startEvent: 'game-poll-start',
      expected: { prompt: 'Choose one' },
    })
    await hydrate({
      gameId: 'hydrate-cloud',
      gameType: 'word-cloud',
      options: { prompt: 'One word' },
      event: 'game-word-cloud-started',
      startEvent: 'game-word-cloud-start',
      expected: { prompt: 'One word' },
    })
    await hydrate({
      gameId: 'hydrate-matching',
      gameType: 'matching',
      options: { prompt: 'Match terms', pairs: [{ promptId: 'p1', prompt: 'A', targetId: 't1', target: 'B' }] },
      event: 'game-matching-started',
      startEvent: 'game-matching-start',
      expected: { prompt: 'Match terms' },
    })
  })

  it('runs matching start, submit, reveal, and room binding through sockets', async () => {
    const host = connectClient()
    await waitConnect(host)
    await joinAndWait(host, {
      gameId: 'match-room',
      playerName: 'Host',
      playerId: 'p-host',
      role: 'host',
      gameType: 'matching',
      options: {
        prompt: 'Match terms',
        pairs: [
          { promptId: 'p-http', prompt: 'HTTP', targetId: 't-protocol', target: 'Protocol' },
          { promptId: 'p-tls', prompt: 'TLS', targetId: 't-security', target: 'Security' },
        ],
      },
    })

    const player = connectClient()
    await waitConnect(player)
    await joinAndWait(player, {
      gameId: 'match-room',
      playerName: 'Alice',
      playerId: 'p-alice',
      role: 'player',
    })

    const inactiveErr = once(player, 'game-error')
    player.emit('game-matching-submit', {
      gameId: 'match-room',
      pairs: [{ promptId: 'p-http', targetId: 't-protocol' }],
    })
    expect((await inactiveErr).message).toBe('matching-not-active')

    const startedPlayer = once(player, 'game-matching-started')
    host.emit('game-matching-start', { gameId: 'match-room' })
    expect(await startedPlayer).toMatchObject({
      prompt: 'Match terms',
      prompts: [{ id: 'p-http', text: 'HTTP' }, { id: 'p-tls', text: 'TLS' }],
      targets: [{ id: 't-security', text: 'Security' }, { id: 't-protocol', text: 'Protocol' }],
    })

    const accepted = once(player, 'game-matching-submit-accepted')
    const summary = once(host, 'game-matching-results')
    player.emit('game-matching-submit', {
      gameId: 'match-room',
      pairs: [
        { promptId: 'p-http', targetId: 't-protocol' },
        { promptId: 'p-tls', targetId: 't-security' },
      ],
    })
    expect(await accepted).toMatchObject({ score: 2, total: 2, correct: true })
    expect(await summary).toMatchObject({ submissions: 1 })

    const crossRoomErr = once(player, 'game-error')
    player.emit('game-matching-submit', {
      gameId: 'other-room',
      pairs: [{ promptId: 'p-http', targetId: 't-protocol' }],
    })
    expect((await crossRoomErr).message).toBe('Invalid game room for this socket')

    const revealed = once(player, 'game-matching-results')
    host.emit('game-matching-reveal', { gameId: 'match-room' })
    expect(await revealed).toMatchObject({
      answerKey: [
        { promptId: 'p-http', targetId: 't-protocol' },
        { promptId: 'p-tls', targetId: 't-security' },
      ],
    })

    const latePlayer = connectClient()
    await waitConnect(latePlayer)
    const lateState = once(latePlayer, 'game-matching-started')
    await joinAndWait(latePlayer, {
      gameId: 'match-room',
      playerName: 'Late Player',
      playerId: 'p-late',
      role: 'player',
    })
    expect(await lateState).toMatchObject({
      answerKey: [
        { promptId: 'p-http', targetId: 't-protocol' },
        { promptId: 'p-tls', targetId: 't-security' },
      ],
    })

    const ended = once(host, 'game-ended')
    host.emit('game-end', { gameId: 'match-room' })
    await ended
    expect(GameEngine.getRoom('match-room').cleanupKind).toBe('finished')

    const restarted = once(host, 'game-matching-started')
    host.emit('game-matching-start', { gameId: 'match-room' })
    expect(await restarted).toMatchObject({ submissions: 0 })
    expect(await restarted).not.toHaveProperty('answerKey')
    expect(GameEngine.getRoom('match-room')).toMatchObject({ status: 'active', cleanupKind: null })
  })
})
