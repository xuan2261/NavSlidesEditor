// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { wireHarness, once, engine } from './game-live-wire-fixture.js'
const require = createRequire(import.meta.url)
const { createGameConnection } = require('../../shared/src/education/browser/game-connection.js')
const {
  createLivePlayerState,
  reduceLivePlayerState,
} = require('../../shared/src/education/live-player-state.js')
let wire
const connections = []
beforeEach(async () => {
  wire = await wireHarness()
})
afterEach(async () => {
  connections.splice(0).forEach((connection) => connection.release())
  await wire.close()
})
function stateWhen(connection, predicate) {
  if (predicate(connection.getSnapshot())) return Promise.resolve(connection.getSnapshot())
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      detach()
      reject(new Error('Missing recovered consumer state'))
    }, 4000)
    const detach = connection.subscribe((state) => {
      if (predicate(state)) {
        clearTimeout(timer)
        detach()
        resolve(state)
      }
    })
  })
}
async function learner(fixture) {
  const client = await wire.client(),
    values = new Map()
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  }
  const connection = createGameConnection({
    socket: client.socket,
    gameId: fixture.room.gameId,
    playerName: 'Recovery',
    storage,
  })
  connections.push(connection)
  await stateWhen(connection, (state) => state.hydrated)
  return { socket: client.socket, connection }
}
async function reconnect(socket) {
  socket.disconnect()
  const ready = once(socket, 'connect')
  socket.connect()
  await ready
}

describe('learner lost-command recovery over real sockets', () => {
  it('recovers an undelivered vote using the original command identity and retained draft', async () => {
    const f = await wire.fixture('poll')
    await f.host.command('game-poll-start')
    const { socket, connection } = await learner(f),
      originalEmit = socket.emit.bind(socket)
    let undelivered
    socket.emit = (event, payload, ...rest) => {
      if (event === 'game-poll-submit' && !undelivered) {
        undelivered = structuredClone(payload)
        return socket
      }
      return originalEmit(event, payload, ...rest)
    }
    connection.setDraft({ optionId: f.room.config.options[0].id })
    expect(connection.emit('game-poll-submit', { optionId: f.room.config.options[0].id })).toBe(
      true
    )
    expect(connection.getSnapshot().pending.commandId).toBe(undelivered.commandId)
    await reconnect(socket)
    const recovered = await stateWhen(
      connection,
      (state) => state.hydrated && !state.pending && state.poll?.totalVotes === 1
    )
    expect(recovered.draft).toEqual({ optionId: f.room.config.options[0].id })
    expect(f.room.engagement.votes).toEqual([
      { participantId: connection.playerId, optionId: f.room.config.options[0].id },
    ])
    expect(recovered.ownSubmission.commandId).toBe(undelivered.commandId)
  })

  it('recovers a lost rejection even after a newer peer snapshot and lets the learner correct it', async () => {
    const f = await wire.fixture('poll')
    await f.host.command('game-poll-start')
    const { socket, connection } = await learner(f),
      originalEvent = socket.onevent.bind(socket)
    let block = true
    socket.onevent = (packet) => {
      if (
        block &&
        ['game-command-result', 'game-error'].includes(packet.data?.[0]) &&
        packet.data?.[1]?.commandId
      )
        return
      originalEvent(packet)
    }
    connection.setDraft({ optionId: 'missing' })
    const rejected = once(socket, 'game-poll-results')
    connection.emit('game-poll-submit', { optionId: 'missing' })
    await f.b.command('game-poll-submit', { optionId: f.room.config.options[1].id })
    await rejected
    expect(connection.getSnapshot().pending).not.toBeNull()
    block = false
    await reconnect(socket)
    const recovered = await stateWhen(
      connection,
      (state) => state.hydrated && !state.pending && Boolean(state.error)
    )
    expect(recovered.error).toBe('invalid-poll-option')
    expect(recovered.draft).toEqual({ optionId: 'missing' })
    const voted = stateWhen(connection, (state) => state.poll?.totalVotes === 2 && !state.pending)
    expect(connection.emit('game-poll-submit', { optionId: f.room.config.options[0].id })).toBe(
      true
    )
    await voted
    expect(f.room.engagement.votes.map((row) => row.participantId).sort()).toEqual(
      ['bob', connection.playerId].sort()
    )
  })

  it('hydrates an accepted vote whose receipt was lost without applying it twice', async () => {
    const f = await wire.fixture('poll')
    await f.host.command('game-poll-start')
    const { socket, connection } = await learner(f),
      originalEvent = socket.onevent.bind(socket)
    let block = true
    socket.onevent = (packet) => {
      if (
        block &&
        ['game-command-result', 'game-round-state', 'game-poll-vote-accepted'].includes(
          packet.data?.[0]
        )
      )
        return
      originalEvent(packet)
    }
    const committed = once(f.b.socket, 'game-round-state', (state) => state.poll?.totalVotes === 1)
    connection.emit('game-poll-submit', { optionId: f.room.config.options[0].id })
    await committed
    const count = f.room.receipts.size
    block = false
    await reconnect(socket)
    const recovered = await stateWhen(
      connection,
      (state) => state.hydrated && !state.pending && state.poll?.totalVotes === 1
    )
    expect(recovered.ownSubmission.optionId).toBe(f.room.config.options[0].id)
    expect(f.room.receipts.size).toBe(count)
    expect(f.room.engagement.votes).toHaveLength(1)
  })
})

describe('public live admission and answer secrecy boundaries', () => {
  it.each([true, false])(
    'hydrates the admitted 200-learner room with reserved host (host first: %s)',
    (hostFirst) => {
      engine.createRoom('capacity', 'poll', {})
      const room = engine.getRoom('capacity'),
        capability = engine.peekHostCapability('capacity')
      const host = () =>
        engine.joinRoom('capacity', 'host', 'Host', {
          role: 'host',
          hostCapability: capability,
          socketId: 'host-socket',
        })
      if (hostFirst) expect(host().ok).toBe(true)
      for (let i = 0; i < 200; i++)
        expect(
          engine.joinRoom('capacity', `p-${i}`, `Learner ${i}`, { socketId: `s-${i}` }).ok
        ).toBe(true)
      if (!hostFirst) expect(host().ok).toBe(true)
      expect(engine.joinRoom('capacity', 'overflow', 'Overflow').error).toBe('room-full')
      const snapshot = engine.getPublicState('capacity', 'p-199')
      let state = reduceLivePlayerState(createLivePlayerState('capacity'), 'game-session', {
        ...snapshot,
        playerId: 'p-199',
      })
      state = reduceLivePlayerState(state, 'game-round-state', snapshot)
      expect(state).toMatchObject({ hydrated: true, error: null })
      expect(state.players.filter((player) => !player.isHost)).toHaveLength(200)
      expect(state.players.find((player) => player.isHost).playerId).toBe('host')
      expect(room.players.size).toBe(201)
    }
  )

  it('keeps Hot Potato keys out of wrong-answer receipts, duplicates and reconnect until room reveal', async () => {
    const f = await wire.fixture('hot-potato'),
      active = once(f.a.socket, 'game-round-state', (state) => state.roundId === 1)
    await f.host.command('game-next')
    await active
    const question = f.room.questions[0],
      wrong = question.options.findIndex((option) => option.id !== question.answerKey.optionId)
    const fields = {
      questionId: question.id,
      attemptId: 'wrong-once',
      answerIndex: wrong,
      commandId: 'wrong-command',
    }
    const answered = once(f.a.socket, 'game-answer-result')
    const receipt = await f.a.command('game-answer', fields),
      result = await answered
    expect(receipt.result).toMatchObject({
      correct: false,
      points: 0,
      selectedOptionId: question.options[wrong].id,
    })
    for (const output of [
      receipt,
      result,
      await f.a.command('game-answer', fields),
      engine.getPublicState(f.room.gameId, 'alice'),
    ]) {
      expect(output).not.toHaveProperty('correctOptionId')
      expect(JSON.stringify(output)).not.toContain('correctOptionId')
      expect(JSON.stringify(output)).not.toContain('answerKey')
    }
    const fresh = await wire.client()
    await fresh.join(f.room.gameId, 'alice', { sessionToken: f.a.session().sessionToken })
    expect(fresh.state().ownSubmission.result).not.toHaveProperty('correctOptionId')
    const revealed = once(fresh.socket, 'game-round-state', (state) => Boolean(state.revealed))
    await f.host.command('game-quiz-reveal')
    expect((await revealed).revealed.question.answerKey).toEqual(question.answerKey)
    expect(
      engine
        .getPublicState(f.room.gameId, 'alice')
        .leaderboard.find((row) => row.playerId === 'alice').score
    ).toBe(0)
  })
})
