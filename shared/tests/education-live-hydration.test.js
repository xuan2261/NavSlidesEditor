import { describe, expect, it, vi } from 'vitest'
import { bindings, fixture, shortcut, stateOf, success } from './helpers/education-live-document.js'
describe('authenticated host hydration in the actual generated IIFE', () => {
  it('starts inherited copies independently without serializing private authority', async () => {
    const { dom, sockets } = await fixture(success(bindings())),
      { document } = dom.window
    const roots = [...document.querySelectorAll('[data-ns-game]')]
    await vi.waitFor(() =>
      expect(sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    const games = sockets.filter((socket) => socket.namespace === '/games')
    const start = roots[0].querySelector('[data-ns-command="startPoll"]')
    expect(start.disabled).toBe(false)
    start.click()
    expect(stateOf(games[0]).phase).toBe('active')
    expect(stateOf(games[1]).phase).toBe('waiting')
    for (const socket of games) {
      expect(document.documentElement.outerHTML).not.toContain(socket.authority.hostCapability)
      expect(document.documentElement.outerHTML).not.toContain(socket.authority.sessionToken)
    }
    expect(document.documentElement.outerHTML).not.toContain('PRIVATE_PRESENTER')
  })
  it.each(['generation', 'tuple', 'config', 'revision'])(
    'rejects a mismatched %s batch atomically without raw-ID fallback',
    async (mismatch) => {
      const data = success(bindings())
      if (mismatch === 'generation') data.presentationGeneration = 3
      if (mismatch === 'tuple') data.games[1].effectiveSlideId = 'absent'
      if (mismatch === 'config') data.games[1].config.prompt = 'Stale question'
      if (mismatch === 'revision') data.presentationRevision = 'revision-0'
      const { dom, sockets } = await fixture(data)
      await vi.waitFor(() =>
        expect(
          dom.window.NavSlidesEducation.mount(
            dom.window.document.querySelector('[data-ns-game]')
          ).getState().connection
        ).toBe('disconnected')
      )
      expect(sockets.filter((socket) => socket.namespace === '/games')).toEqual([])
      expect(
        [...dom.window.document.querySelectorAll('[data-ns-game]')].flatMap((root) => [
          ...root.querySelectorAll('button, input, select'),
        ])
      ).toEqual([])
      expect(dom.window.document.querySelector('[data-ns-transport-game-id]')).toBeNull()
    }
  )
  it('revokes joined host controls on presenter disconnect rather than scoring locally', async () => {
    const { dom, sockets, live } = await fixture(success(bindings()))
    await vi.waitFor(() =>
      expect(sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    expect(dom.window.document.querySelector('[data-ns-command="startPoll"]').disabled).toBe(false)
    live.receive('disconnect')
    expect(dom.window.document.querySelector('[data-ns-command="startPoll"]')).toBeNull()
    expect(dom.window.document.querySelector('[data-ns-transport-game-id]')).toBeNull()
    expect(
      sockets.filter((socket) => socket.namespace === '/games').map((socket) => socket.disconnected)
    ).toEqual([true, true])
    const root = dom.window.document.querySelector('[data-ns-game]')
    expect(dom.window.NavSlidesEducation.mount(root).getState()).toMatchObject({
      runtimeMode: 'live',
      connection: 'disconnected',
    })
  })
  it('ignores bootstrap data that arrives after presenter disconnect', async () => {
    let resolveResponse
    const response = new Promise((resolve) => {
      resolveResponse = resolve
    })
    const { dom, sockets, live, readResponse } = await fixture(response)
    await vi.waitFor(() => expect(readResponse).toHaveBeenCalledOnce())
    live.receive('disconnect')
    resolveResponse(success(bindings()))
    await readResponse.mock.results[0].value
    expect(sockets.filter((socket) => socket.namespace === '/games')).toEqual([])
    expect(dom.window.document.querySelector('[data-ns-command="startPoll"]')).toBeNull()
    expect(dom.window.document.querySelector('[data-ns-transport-game-id]')).toBeNull()
    const root = dom.window.document.querySelector('[data-ns-game]')
    expect(dom.window.NavSlidesEducation.mount(root).getState()).toMatchObject({
      runtimeMode: 'live',
      connection: 'disconnected',
    })
  })
  it('ignores unsupported and mismatched queued shortcuts while starting the intended room', async () => {
    let resolveResponse
    const response = new Promise((resolve) => {
      resolveResponse = resolve
    })
    const { dom, sockets } = await fixture(response)
    shortcut(dom.window, { action: 'unsupported' })
    shortcut(dom.window, { action: 'startWordCloud', gameType: 'word-cloud' })
    shortcut(dom.window, { action: 'startPoll' })
    resolveResponse(success(bindings()))
    await vi.waitFor(() =>
      expect(sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    const games = sockets.filter((socket) => socket.namespace === '/games')
    expect(stateOf(games[0]).phase).toBe('active')
    expect(stateOf(games[0]).roundId).toBe(1)
    expect(stateOf(games[1]).phase).toBe('waiting')
  })
  it('recovers private host capability and player authority after a presenter document refresh', async () => {
    const first = await fixture(success(bindings()))
    await vi.waitFor(() =>
      expect(first.sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    const firstGame = first.sockets.find((socket) => socket.namespace === '/games')
    const playerId = firstGame.emitted.find((row) => row.event === 'game-join').payload.playerId
    const { sessionToken, hostCapability } = firstGame.authority
    const stored = Object.fromEntries(
      Object.keys(first.dom.window.sessionStorage).map((key) => [
        key,
        first.dom.window.sessionStorage.getItem(key),
      ])
    )
    first.dom.window.dispatchEvent(new first.dom.window.Event('beforeunload'))
    const refreshed = await fixture(success(bindings()), stored)
    await vi.waitFor(() =>
      expect(refreshed.sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    expect(refreshed.requests[0].hostCapabilities).toMatchObject({ 'opaque-0': hostCapability })
    const game = refreshed.sockets.find((socket) => socket.namespace === '/games')
    expect(game.authority).toMatchObject({ playerId, hostCapability })
    expect(stateOf(game).players).toHaveLength(1)
    refreshed.dom.window.document.querySelector('[data-ns-command="startPoll"]').click()
    expect(stateOf(game).phase).toBe('active')
    const { gameId, roomInstanceId, generation, roundId } = game.publicState
    firstGame.emit('game-reset', {
      gameId,
      roomInstanceId,
      generation,
      roundId,
      commandId: 'superseded-host',
    })
    expect(firstGame.lastReceipt).toMatchObject({ accepted: false, error: 'stale-player-session' })
    expect(stateOf(game).phase).toBe('active')
    for (const secret of [hostCapability, sessionToken, game.authority.sessionToken]) {
      expect(refreshed.dom.window.document.documentElement.outerHTML).not.toContain(secret)
      expect(JSON.stringify(refreshed.dom.window.opener.postMessage.mock.calls)).not.toContain(
        secret
      )
    }
  })
  it('does not replay queued commands across presenter disconnect and a new allocation lineage', async () => {
    const { dom, sockets, live, readResponse } = await fixture(success(bindings()))
    await vi.waitFor(() =>
      expect(sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    shortcut(dom.window, { action: 'startPoll' })
    live.receive('disconnect')
    live.connected = true
    readResponse.mockResolvedValue({
      ...success(
        bindings().map((binding, index) => ({
          ...binding,
          transportGameId: `reallocated-${index}`,
        }))
      ),
      allocationGeneration: 'next-lineage',
    })
    live.receive('presentation-data', { presentationId: 'host-deck', presentationGeneration: 4 })
    await vi.waitFor(() =>
      expect(sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(4)
    )
    const reallocated = sockets.filter((socket) => socket.namespace === '/games').slice(2)
    expect(reallocated.map((socket) => stateOf(socket).phase)).toEqual(['waiting', 'waiting'])
  })
})
