import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { generateRevealHTML } from '../src/htmlGenerator.js'
import { buildGameBootstrapRuntime } from '../src/live-presenter-game-runtime.js'

describe('generated live presenter runtime', () => {
  it('bootstraps authoritative game rooms only for live decks containing games', () => {
    const gameHtml = generateRevealHTML({
      id: 'presentation-1',
      slides: [{ elements: [{ id: 'game-1', type: 'game', gameType: 'name-picker' }] }],
    })
    const plainHtml = generateRevealHTML({
      id: 'presentation-2',
      slides: [{ elements: [{ id: 'text-1', type: 'text', content: '<p>Hello</p>' }] }],
    })

    expect(gameHtml).toContain("fetch('/api/presentations/'")
    expect(gameHtml).toContain("encodeURIComponent('presentation-1')")
    expect(gameHtml).toContain('/present/game-bootstrap')
    expect(gameHtml).toContain("io('/games'")
    expect(gameHtml).toContain("role: 'host'")
    expect(gameHtml).toContain('hostCapabilities')
    expect(gameHtml).toContain('function createHostPlayerId()')
    expect(gameHtml).not.toContain("playerId: 'presenter-' + gameId")
    expect(gameHtml).toContain("if (typeof livePresentationReady === 'function') livePresentationReady();")
    expect(gameHtml).toContain('function rebootGameHost(state, gameSocket)')
    expect(gameHtml).toContain("data.message === 'room-not-found'")
    expect(gameHtml).toContain("gameSocket.on('game-room-expired'")
    expect(gameHtml).toContain('if (state.socket !== gameSocket) return;')
    expect(gameHtml).toContain("message.type !== 'navslides:game-shortcut'")
    expect(gameHtml).toContain("if (action === 'startPoll' && state.gameType === 'poll')")
    expect(plainHtml).not.toContain('/present/game-bootstrap')
  })

  it('preserves hostile capability keys and drains queued shortcuts safely', async () => {
    const persistedCapabilities = Object.fromEntries([
      ['__proto__', 'persisted-proto'],
      ['constructor', 'persisted-constructor'],
      ['toString', 'persisted-to-string'],
    ])
    const stored = new Map([
      ['navslides-game-host-capabilities:presentation-1', JSON.stringify(persistedCapabilities)],
    ])
    const sockets = []
    const hostileGameIds = ['__proto__', 'constructor', 'toString']
    const lifecycleEvents = []
    const opener = {
      closed: false,
      postMessage: vi.fn((message) => lifecycleEvents.push(message.type)),
    }
    const window = {
      crypto: { randomUUID: () => 'host-1' },
      location: { origin: 'https://app.test' },
      opener,
      addEventListener: vi.fn((event) => lifecycleEvents.push(`listener:${event}`)),
    }
    const io = vi.fn(() => {
      const handlers = {}
      const socket = {
        connected: true,
        disconnected: false,
        emitted: [],
        on(event, handler) {
          handlers[event] = handler
          return socket
        },
        emit(event, payload) {
          socket.emitted.push({ event, payload })
        },
        disconnect() {
          lifecycleEvents.push('socket:disconnect')
          socket.connected = false
          socket.disconnected = true
        },
      }
      socket.handlers = handlers
      sockets.push(socket)
      return socket
    })
    const fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        games: [
          { gameId: 'poll-game', gameType: 'poll', hostCapability: 'capability' },
          { gameId: '__proto__', gameType: 'poll', hostCapability: 'capability-proto' },
          { gameId: 'constructor', gameType: 'poll', hostCapability: 'capability-constructor' },
          { gameId: 'toString', gameType: 'poll', hostCapability: 'capability-to-string' },
          { gameId: 'hot-game', gameType: 'hot-potato', hostCapability: 'hot-capability' },
        ],
      }),
    }))
    const livePresenterSocket = {
      connected: true,
      emitted: [],
      emit(event, payload) {
        this.emitted.push({ event, payload })
      },
    }
    const context = {
      liveRoom: 'ROOM1',
      presenterToken: 'presenter-token',
      io,
      fetch,
      livePresenterSocket,
      sessionStorage: {
        getItem: (key) => stored.get(key) || null,
        setItem: (key, value) => stored.set(key, value),
      },
      window,
      livePresentationReady: null,
      encodeURIComponent,
      setTimeout,
      clearTimeout,
      Date,
      Math,
      Uint8Array,
    }

    runInNewContext(
      `var liveRoom = 'ROOM1'; var presenterToken = 'presenter-token'; var livePresentationReady = null; ${buildGameBootstrapRuntime('presentation-1')}`,
      context
    )

    const messageHandler = window.addEventListener.mock.calls.find(([event]) => event === 'message')[1]
    expect(opener.postMessage).toHaveBeenCalledWith({
      type: 'navslides:presenter-ready',
      presentationId: 'presentation-1',
      roomCode: 'ROOM1',
    }, 'https://app.test')

    expect(lifecycleEvents.indexOf('listener:message')).toBeLessThan(
      lifecycleEvents.indexOf('navslides:presenter-ready')
    )
    const beforeUnloadHandler = window.addEventListener.mock.calls.find(
      ([event]) => event === 'beforeunload'
    )[1]

    // The popup listener exists before game bootstrap; this command must survive
    // until its host socket has joined.
    messageHandler({
      origin: 'https://app.test',
      source: opener,
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'presentation-1',
        roomCode: 'ROOM1',
        detail: { elementId: 'poll-game', gameType: 'poll', action: 'startPoll' },
      },
    })
    messageHandler({
      origin: 'https://app.test',
      source: opener,
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'presentation-1',
        roomCode: 'ROOM1',
        detail: { elementId: '__proto__', gameType: 'poll', action: 'startPoll' },
      },
    })

    context.livePresentationReady()
    const bootstrapCapabilities = JSON.parse(fetch.mock.calls[0][1].body).hostCapabilities
    expect(bootstrapCapabilities['__proto__']).toBe('persisted-proto')
    expect(bootstrapCapabilities.constructor).toBe('persisted-constructor')
    expect(bootstrapCapabilities.toString).toBe('persisted-to-string')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const expectedHostCapabilities = new Map([
      ['__proto__', 'capability-proto'],
      ['constructor', 'capability-constructor'],
      ['toString', 'capability-to-string'],
    ])
    expectedHostCapabilities.forEach((hostCapability, gameId) => {
      const socket = sockets.find((candidate) => candidate.emitted.some(
        ({ event, payload }) => event === 'game-join' && payload.gameId === gameId
      ))
      expect(socket).toBeDefined()
      const join = socket.emitted.find(
        ({ event, payload }) => event === 'game-join' && payload.gameId === gameId
      )
      expect(join.payload).toMatchObject({ gameId, hostCapability })
    })
    sockets.forEach((socket) => socket.handlers['game-player-joined']())

    messageHandler({
      origin: 'https://evil.test',
      source: opener,
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'presentation-1',
        roomCode: 'ROOM1',
        detail: { elementId: 'poll-game', gameType: 'poll', action: 'startPoll' },
      },
    })
    messageHandler({
      origin: 'https://app.test',
      source: {},
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'presentation-1',
        roomCode: 'ROOM1',
        detail: { elementId: 'poll-game', gameType: 'poll', action: 'startPoll' },
      },
    })
    messageHandler({
      origin: 'https://app.test',
      source: opener,
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'another-presentation',
        roomCode: 'ROOM1',
        detail: { elementId: 'poll-game', gameType: 'poll', action: 'startPoll' },
      },
    })
    messageHandler({
      origin: 'https://app.test',
      source: opener,
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'presentation-1',
        roomCode: 'ROOM1',
        detail: { elementId: 'poll-game', gameType: 'poll', action: 'refreshResults' },
      },
    })
    messageHandler({
      origin: 'https://app.test',
      source: opener,
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'presentation-1',
        roomCode: 'ROOM1',
        detail: { elementId: 'poll-game', gameType: 'poll', action: 'next' },
      },
    })
    messageHandler({
      origin: 'https://app.test',
      source: opener,
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'presentation-1',
        roomCode: 'ROOM1',
        detail: { elementId: 'poll-game', gameType: 'poll', action: 'pause' },
      },
    })
    hostileGameIds.filter((gameId) => gameId !== '__proto__').forEach((gameId) => {
      messageHandler({
        origin: 'https://app.test',
        source: opener,
        data: {
          type: 'navslides:game-shortcut',
          presentationId: 'presentation-1',
          roomCode: 'ROOM1',
          detail: { elementId: gameId, gameType: 'poll', action: 'startPoll' },
        },
      })
    })
    messageHandler({
      origin: 'https://app.test',
      source: opener,
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'presentation-1',
        roomCode: 'ROOM1',
        detail: {
          elementId: 'hot-game',
          gameType: 'hot-potato',
          action: 'startTimer',
          duration: 45,
        },
      },
    })
    messageHandler({
      origin: 'https://app.test',
      source: opener,
      data: {
        type: 'navslides:game-shortcut',
        presentationId: 'presentation-1',
        roomCode: 'ROOM1',
        detail: {
          elementId: 'hot-game',
          gameType: 'hot-potato',
          action: 'addTime',
          delta: 10,
        },
      },
    })
    expect(livePresenterSocket.emitted).toEqual([
      { event: 'game-timer-start', payload: { elementId: 'hot-game', duration: 45 } },
      { event: 'game-timer-adjust', payload: { elementId: 'hot-game', delta: 10 } },
    ])

    expect(sockets[0].emitted.filter(({ event }) => event !== 'game-join')).toEqual([
      { event: 'game-poll-start', payload: { gameId: 'poll-game' } },
      { event: 'game-poll-reveal', payload: { gameId: 'poll-game' } },
    ])
    expect(sockets.slice(1, 4).map((socket) =>
      socket.emitted.filter(({ event }) => event !== 'game-join')
    )).toEqual(hostileGameIds.map((gameId) => [
      { event: 'game-poll-start', payload: { gameId } },
    ]))
    expect(JSON.parse(stored.get('navslides-game-host-capabilities:presentation-1'))).toMatchObject(
      Object.fromEntries([
        ['poll-game', 'capability'],
        ['__proto__', 'capability-proto'],
        ['constructor', 'capability-constructor'],
        ['toString', 'capability-to-string'],
      ])
    )

    beforeUnloadHandler()
    expect(opener.postMessage).toHaveBeenLastCalledWith({
      type: 'navslides:presenter-unready',
      presentationId: 'presentation-1',
      roomCode: 'ROOM1',
    }, 'https://app.test')
    expect(lifecycleEvents.indexOf('navslides:presenter-unready')).toBeLessThan(
      lifecycleEvents.indexOf('socket:disconnect')
    )
  })

  it('keeps capabilities out of generated source and exported static paths', () => {
    const html = generateRevealHTML({
      id: 'presentation-1',
      slides: [{ elements: [{ id: 'game-1', type: 'game', gameType: 'poll' }] }],
    })

    expect(html).not.toContain('hostCapability: "')
    expect(html).not.toContain('hostCapability: \'')
    expect(html).not.toContain('window.name =')
    expect(html).toContain("if (liveRoom)")
  })

  it('rotates persisted legacy host identities before joining the game room', async () => {
    const stored = new Map([
      [
        'navslides-game-host-state:presentation-1:legacy-game',
        JSON.stringify({
          gameId: 'legacy-game',
          playerId: 'presenter-legacy-game',
          sessionToken: 'stale-session',
        }),
      ],
    ])
    const sessionStorage = {
      getItem: (key) => stored.get(key) || null,
      setItem: (key, value) => stored.set(key, value),
    }
    const sockets = []
    const io = vi.fn(() => {
      const handlers = {}
      const socket = {
        connected: true,
        disconnected: false,
        emitted: [],
        on(event, handler) {
          handlers[event] = handler
          return socket
        },
        emit(event, payload) {
          socket.emitted.push({ event, payload })
        },
        disconnect() {
          socket.connected = false
          socket.disconnected = true
        },
      }
      socket.handlers = handlers
      sockets.push(socket)
      return socket
    })
    const fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        games: [{ gameId: 'legacy-game', gameType: 'poll', hostCapability: 'capability' }],
      }),
    }))
    const context = {
      liveRoom: 'ROOM1',
      presenterToken: 'presenter-token',
      io,
      fetch,
      sessionStorage,
      window: {
        crypto: { randomUUID: () => 'fresh-host' },
        addEventListener: vi.fn(),
      },
      livePresentationReady: null,
      encodeURIComponent,
      setTimeout,
      clearTimeout,
      Date,
      Math,
      Uint8Array,
    }

    runInNewContext(
      `var liveRoom = 'ROOM1'; var presenterToken = 'presenter-token'; var livePresentationReady = null; ${buildGameBootstrapRuntime('presentation-1')}`,
      context
    )
    context.livePresentationReady()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const join = sockets[0].emitted.find((entry) => entry.event === 'game-join')
    expect(join.payload.playerId).toBe('presenter-host-fresh-host')
    expect(join.payload).not.toHaveProperty('sessionToken')
    expect(JSON.parse(stored.get('navslides-game-host-state:presentation-1:legacy-game')).playerId)
      .toBe('presenter-host-fresh-host')
  })
})
