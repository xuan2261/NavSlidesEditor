// @vitest-environment node
/**
 * Socket-LAYER end-to-end tests for game mode.
 *
 * These tests traverse the REAL socket.io transport the same way the client
 * hooks do (namespace '/games', path '/ws', the fixed client payload shapes).
 * Calling GameEngine directly is what hid the namespace/field-name dead-end
 * (defect C1), so every assertion here is driven through emit/receive.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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
  const joined = once(sock, 'game-player-joined')
  sock.emit('game-join', payload)
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
  // 1. C1 tripwire: namespace + field names line up across the wire.
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

  // 2. Anti-cheat: answering the same question twice scores only once.
  it('rejects duplicate answers — score increments only once', async () => {
    GameEngine.createRoom('room2', 'hot-potato', {
      questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
    })
    const sock = connectClient()
    await waitConnect(sock)
    await joinAndWait(sock, { gameId: 'room2', playerName: 'Bob', playerId: 'p-bob' })

    const r1 = once(sock, 'game-answer-result')
    sock.emit('game-answer', { gameId: 'room2', answerIndex: 0, timeSpentMs: 1000 })
    await r1

    // The repeat for the same question is rejected with game-error, not scored.
    const dup = once(sock, 'game-error')
    sock.emit('game-answer', { gameId: 'room2', answerIndex: 0, timeSpentMs: 1000 })
    await dup

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
    expect(GameEngine.getRoom('room3').currentQuestion).toBe(0)
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
  })
})
