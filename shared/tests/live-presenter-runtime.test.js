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
    expect(plainHtml).not.toContain('/present/game-bootstrap')
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
