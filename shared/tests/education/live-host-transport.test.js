import { afterEach, describe, expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const engine = require('../../../server/services/game-room-manager-singleton-service')
const { createLiveHostTransport } = require('../../src/education/browser/live-host-transport')
const { createDefaultGameConfig } = require('../../src/education/game-defaults')
const { projectPublicGameConfig } = require('../../src/education/game-public-projection')
const fixtures = []
function fixture(types = ['poll', 'poll']) {
  const dom = new JSDOM(
    '<html data-ns-presentation-id="deck" data-ns-content-revision="revision"><body></body></html>',
    { url: 'https://localhost/present?live=ROOM' }
  )
  const window = dom.window,
    sockets = [],
    requests = [],
    opener = { closed: false, postMessage: vi.fn() }
  window.name = JSON.stringify({ roomCode: 'ROOM', presenterToken: 'presenter-token' })
  Object.defineProperty(window, 'opener', { value: opener })
  let sequence = 0
  Object.defineProperty(window.crypto, 'randomUUID', { value: () => `identity-${++sequence}` })
  let games = types.map((gameType, index) => {
    const transportGameId = `game-${index}`,
      config = createDefaultGameConfig(gameType)
    engine.createRoom(transportGameId, gameType, config)
    const game = {
      transportGameId,
      gameType,
      config,
      hostCapability: engine.peekHostCapability(transportGameId),
      effectiveSlideId: `slide-${index}`,
      elementId: 'inherited-game',
    }
    const section = window.document.createElement('section')
    section.dataset.nsEffectiveSlideId = game.effectiveSlideId
    const root = window.document.createElement('div')
    root.dataset.nsGame = ''
    root.dataset.nsGameType = gameType
    root.dataset.nsElementId = game.elementId
    const script = window.document.createElement('script')
    script.dataset.nsGameConfig = ''
    script.textContent = JSON.stringify(projectPublicGameConfig(gameType, config))
    root.append(script)
    section.append(root)
    window.document.body.append(section)
    return game
  })
  function socket(namespace) {
    const listeners = new Map(),
      emitted = [],
      receipts = []
    let actor, gameId
    const result = {
      namespace,
      connected: true,
      emitted,
      listeners,
      receipts,
      on(event, fn) {
        const entries = listeners.get(event) || new Set()
        entries.add(fn)
        listeners.set(event, entries)
      },
      off(event, fn) {
        const entries = listeners.get(event)
        entries?.delete(fn)
        if (!entries?.size) listeners.delete(event)
      },
      receive(event, data) {
        for (const fn of [...(listeners.get(event) || [])]) fn(data)
      },
      emit(event, payload) {
        emitted.push({ event, payload })
        if (event === 'game-join') {
          gameId = payload.gameId
          const joined = engine.joinRoom(gameId, payload.playerId, payload.playerName, {
            ...payload,
            socketId: namespace + gameId,
          })
          actor = {
            playerId: payload.playerId,
            socketId: namespace + gameId,
            sessionToken: joined.sessionToken,
            hostCapability: payload.hostCapability,
          }
          result.receive('game-session', {
            ...engine.getPublicState(gameId),
            playerId: payload.playerId,
            sessionToken: joined.sessionToken,
            isHost: true,
          })
          result.receive('game-round-state', engine.getPublicState(gameId, payload.playerId))
        } else if (namespace === '/games') {
          const receipt = engine.command(event, payload, actor)
          receipts.push(receipt)
          result.receive('game-round-state', engine.getPublicState(gameId, actor.playerId))
          result.receive('game-command-result', receipt)
        }
      },
      disconnect() {
        result.connected = false
        result.receive('disconnect')
      },
    }
    sockets.push(result)
    return result
  }
  window.io = (namespace) => socket(namespace)
  window.fetch = vi.fn(async (url, options) => {
    requests.push(JSON.parse(options.body))
    return {
      ok: true,
      json: async () => ({
        presentationId: 'deck',
        presentationRevision: 'revision',
        presentationGeneration: 1,
        allocationGeneration: 'allocation',
        games,
      }),
    }
  })
  const presenter = socket('/'),
    transport = createLiveHostTransport(window)
  const ready = () =>
    transport.presentationReady({ presentationId: 'deck', presentationGeneration: 1 }, presenter)
  const shortcut = (detail) => {
    const event = new window.MessageEvent('message', {
      origin: window.location.origin,
      data: { type: 'navslides:game-shortcut', presentationId: 'deck', roomCode: 'ROOM', detail },
      source: opener,
    })
    window.dispatchEvent(event)
  }
  const f = {
    window,
    games,
    sockets,
    requests,
    presenter,
    transport,
    ready,
    shortcut,
    replaceGames: (next) => {
      games = next
    },
    close: () => {
      transport.destroy()
      dom.window.close()
    },
  }
  fixtures.push(f)
  return f
}
afterEach(() => {
  for (const f of fixtures.splice(0)) f.close()
  engine._reset()
})
describe('effective-room generated host transport', () => {
  it('starts and replays independent inherited rooms with absolute authoritative state', async () => {
    const f = fixture(),
      states = []
    f.transport.subscribe(f.games[0], (snapshot) => states.push(snapshot))
    f.ready()
    await vi.waitFor(() =>
      expect(f.sockets.filter((s) => s.namespace === '/games')).toHaveLength(2)
    )
    expect(f.transport.dispatch(f.games[0], { action: 'start' })).toBe(true)
    const first = engine.getPublicState('game-0', f.sockets[1].emitted[0].payload.playerId),
      second = engine.getPublicState('game-1')
    expect(first.phase).toBe('active')
    expect(second.phase).toBe('waiting')
    const command = f.sockets[1].emitted.find((row) => row.event === 'game-poll-start').payload
    expect(command).toMatchObject({
      gameId: first.gameId,
      roomInstanceId: first.roomInstanceId,
      generation: 0,
      roundId: 0,
      commandId: expect.any(String),
    })
    expect(states.at(-1).state).toMatchObject({
      gameId: 'game-0',
      roomInstanceId: first.roomInstanceId,
      generation: 0,
      roundId: 1,
      stateVersion: 1,
      status: 'active',
      phase: 'active',
    })
    expect(states.at(-1).state.timeRemainingMs).toBeGreaterThan(0)
    expect(states.at(-1).state.timeRemainingMs).toBeLessThanOrEqual(30000)
    expect(f.transport.dispatch(f.games[0], { action: 'replay' })).toBe(true)
    expect(engine.getPublicState('game-0').generation).toBe(1)
    expect(engine.getPublicState('game-1').generation).toBe(0)
    f.sockets[1].receive('game-round-state', first)
    expect(states.at(-1).state.generation).toBe(1)
    expect(f.presenter.emitted).toEqual([])
  })
  it('keeps opener shortcuts and timer routing isolated from games sockets', async () => {
    const f = fixture(),
      snapshots = []
    f.transport.subscribe(f.games[1], (state) => snapshots.push(state))
    f.shortcut({ ...f.games[1], action: 'startPoll' })
    f.ready()
    await vi.waitFor(() => expect(engine.getPublicState('game-1').phase).toBe('active'))
    expect(engine.getPublicState('game-0').phase).toBe('waiting')
    f.shortcut({ ...f.games[1], action: 'startTimer', duration: 45 })
    expect(f.presenter.emitted).toEqual([
      {
        event: 'game-timer-start',
        payload: { effectiveSlideId: 'slide-1', elementId: 'inherited-game', duration: 45 },
      },
    ])
    const timer = {
      effectiveSlideId: 'slide-1',
      elementId: 'inherited-game',
      running: true,
      remaining: 45,
    }
    f.presenter.receive('timer:sync', timer)
    expect(snapshots.at(-1).state.timer).toEqual(timer)
    expect(
      f.sockets
        .filter((s) => s.namespace === '/games')
        .flatMap((s) => s.emitted)
        .some((row) => row.event.startsWith('game-timer-'))
    ).toBe(false)
  })
  it('retains host identity and capabilities on reconnect and releases every listener', async () => {
    const f = fixture()
    f.ready()
    await vi.waitFor(() =>
      expect(f.sockets.filter((s) => s.namespace === '/games')).toHaveLength(2)
    )
    const firstSocket = f.sockets[1],
      original = firstSocket.emitted[0].payload
    firstSocket.disconnect()
    firstSocket.connected = true
    firstSocket.receive('connect')
    expect(firstSocket.emitted.at(-1).payload).toMatchObject({
      playerId: original.playerId,
      sessionToken: expect.any(String),
      hostCapability: original.hostCapability,
    })
    expect(
      JSON.parse(f.window.sessionStorage.getItem('navslides-game-host-state:deck:game-0'))
    ).toMatchObject({ playerId: original.playerId, sessionToken: expect.any(String) })
    f.ready()
    await vi.waitFor(() => expect(f.requests).toHaveLength(2))
    expect(f.requests[1].hostCapabilities).toMatchObject({ 'game-0': original.hostCapability })
    expect(f.sockets.filter((s) => s.namespace === '/games')).toHaveLength(2)
    f.transport.destroy()
    expect(firstSocket.connected).toBe(false)
    for (const socket of f.sockets) expect(socket.listeners.size).toBe(0)
    expect(f.presenter.connected).toBe(true)
  })
  it('rebootstraps an expired binding without reviving its old room or leaking its socket', async () => {
    const f = fixture()
    f.ready()
    await vi.waitFor(() =>
      expect(f.sockets.filter((s) => s.namespace === '/games')).toHaveLength(2)
    )
    const oldSocket = f.sockets[1],
      expired = engine.getPublicState('game-0'),
      original = f.games[0]
    engine.cleanup('game-0')
    engine.createRoom('replacement', original.gameType, original.config)
    const replacement = {
      ...original,
      transportGameId: 'replacement',
      hostCapability: engine.peekHostCapability('replacement'),
    }
    f.replaceGames([replacement, f.games[1]])
    oldSocket.receive('game-room-expired', expired)
    expect(f.transport.dispatch(original, { action: 'start' })).toBe(false)
    await vi.waitFor(() =>
      expect(f.transport.getHostBinding(original).transportGameId).toBe('replacement')
    )
    expect(oldSocket.connected).toBe(false)
    expect(oldSocket.listeners.size).toBe(0)
    oldSocket.receive('game-session', { ...expired, isHost: true })
    expect(f.transport.dispatch(original, { action: 'start' })).toBe(true)
    expect(engine.getPublicState('replacement').phase).toBe('active')
    expect(engine.getPublicState('game-1').phase).toBe('waiting')
  })
  it('uses current round envelopes for Next, team assignment and Jeopardy adjudication', async () => {
    const f = fixture(['hot-potato', 'jeopardy', 'scattergories'])
    f.ready()
    await vi.waitFor(() =>
      expect(f.sockets.filter((s) => s.namespace === '/games')).toHaveLength(3)
    )
    f.transport.dispatch(f.games[0], { action: 'start' })
    const active = engine.getPublicState('game-0')
    f.transport.dispatch(f.games[0], { action: 'nextQuestion' })
    expect(f.sockets[1].emitted.at(-1).payload).toMatchObject({
      gameId: active.gameId,
      roomInstanceId: active.roomInstanceId,
      generation: active.generation,
      roundId: active.roundId,
    })
    expect(f.sockets[1].receipts.every((receipt) => receipt.accepted)).toBe(true)
    engine.joinRoom('game-2', 'learner', 'Learner', { socketId: 'learner' })
    f.transport.dispatch(f.games[2], {
      action: 'assignTeam',
      playerId: 'learner',
      teamId: 'team-1',
    })
    expect(engine.getRoom('game-2').players.get('learner').teamId).toBe('team-1')
    f.transport.dispatch(f.games[1], { action: 'select', cellId: 'cell-100', teamId: 'team-1' })
    f.transport.dispatch(f.games[1], { action: 'reveal' })
    f.transport.dispatch(f.games[1], { action: 'adjudicate', correct: true })
    expect(engine.getRoom('game-1').domain.scores['team-1']).toBe(100)
    expect(f.sockets[2].receipts.every((receipt) => receipt.accepted)).toBe(true)
    expect(engine.getPublicState('game-2').roundId).toBe(0)
    expect(f.presenter.emitted).toEqual([])
  })
  it('disables host mutation when the server revokes its capability', async () => {
    const f = fixture(),
      states = []
    f.transport.subscribe(f.games[0], (state) => states.push(state))
    f.ready()
    await vi.waitFor(() =>
      expect(f.sockets.filter((s) => s.namespace === '/games')).toHaveLength(2)
    )
    f.sockets[1].receive('game-error', { message: 'invalid-host-capability' })
    expect(f.transport.dispatch(f.games[0], { action: 'start' })).toBe(false)
    expect(states.at(-1).connection).toBe('disconnected')
    expect(engine.getPublicState('game-0').phase).toBe('waiting')
  })
})
