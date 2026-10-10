import { describe, expect, it, vi } from 'vitest'
import { bindings, fixture, shortcut, stateOf, success } from './helpers/education-live-document.js'

describe('generated live presenter authority boundaries', () => {
  it('rejects foreign origins, sources, presentations and room contexts before dispatch', async () => {
    const { dom, sockets } = await fixture(success(bindings())),
      window = dom.window
    await vi.waitFor(() =>
      expect(sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    const games = sockets.filter((socket) => socket.namespace === '/games')
    shortcut(window, { action: 'startPoll' }, {}, window.opener, 'https://foreign.test')
    shortcut(window, { action: 'startPoll' }, {}, null)
    shortcut(window, { action: 'startPoll' }, { presentationId: 'other-deck' })
    shortcut(window, { action: 'startPoll' }, { roomCode: 'OTHER' })
    expect(games.map((socket) => stateOf(socket).phase)).toEqual(['waiting', 'waiting'])
    shortcut(window, { action: 'startPoll' })
    expect(stateOf(games[0]).phase).toBe('active')
    expect(stateOf(games[1]).phase).toBe('waiting')
  })
  it.each(['__proto__', 'constructor', 'toString'])(
    'preserves private recovery for a hostile %s transport key without prototype lookup',
    async (id) => {
      const games = bindings()
      games[0].transportGameId = id
      const first = await fixture(success(games))
      await vi.waitFor(() =>
        expect(first.sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
      )
      const stored = Object.fromEntries(
        Object.keys(first.dom.window.sessionStorage).map((key) => [
          key,
          first.dom.window.sessionStorage.getItem(key),
        ])
      )
      const refreshed = await fixture(success(games), stored)
      await vi.waitFor(() =>
        expect(refreshed.sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
      )
      const game = refreshed.sockets.find((socket) => socket.gameId === id)
      expect(Object.hasOwn(refreshed.requests[0].hostCapabilities, id)).toBe(true)
      expect(refreshed.requests[0].hostCapabilities[id]).toBe(game.authority.hostCapability)
      shortcut(refreshed.dom.window, { action: 'startPoll' })
      expect(stateOf(game).phase).toBe('active')
      expect(refreshed.dom.window.document.documentElement.outerHTML).not.toContain(
        game.authority.hostCapability
      )
    }
  )
  it('rotates a persisted preclaimable legacy host identity and discards its stale session token', async () => {
    const first = await fixture(success(bindings()))
    await vi.waitFor(() =>
      expect(first.sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    const firstGame = first.sockets.find((socket) => socket.namespace === '/games')
    const originalId = firstGame.emitted.find((row) => row.event === 'game-join').payload.playerId
    const stored = Object.fromEntries(
      Object.keys(first.dom.window.sessionStorage).map((key) => [
        key,
        first.dom.window.sessionStorage.getItem(key),
      ])
    )
    const key = Object.keys(stored).find((key) => JSON.parse(stored[key]).playerId === originalId)
    stored[key] = JSON.stringify({ playerId: 'presenter-opaque-0', sessionToken: 'stale-session' })
    const refreshed = await fixture(success(bindings()), stored)
    await vi.waitFor(() =>
      expect(refreshed.sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    const join = refreshed.sockets
      .find((socket) => socket.namespace === '/games')
      .emitted.find((row) => row.event === 'game-join')
    expect(join.payload.playerId).not.toBe('presenter-opaque-0')
    expect(join.payload.playerId).not.toBe(originalId)
    expect(join.payload).toMatchObject({ role: 'host', gameId: 'opaque-0' })
    expect(join.payload).not.toHaveProperty('sessionToken')
    expect(JSON.parse(refreshed.dom.window.sessionStorage.getItem(key)).playerId).toBe(
      join.payload.playerId
    )
  })
})
