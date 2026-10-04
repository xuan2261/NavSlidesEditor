import { describe, expect, it, vi } from 'vitest'
import { bindings, fixture, shortcut, stateOf, success } from './helpers/education-live-document.js'

describe('effective inherited shortcut routing', () => {
  it('targets ID-less parent and vertical child copies independently without raw-element-ID fallback', async () => {
    const games = bindings()
    games[0].effectiveSlideId = 'position:0:0'
    games[1].effectiveSlideId = 'position:0:1'
    const source = {
      id: 'host-deck',
      updatedAt: 'revision-1',
      layoutMasters: [
        {
          id: 'lesson',
          name: 'Lesson',
          placeholders: [],
          fixedElements: [
            {
              id: 'shared',
              type: 'game',
              gameType: 'poll',
              poll: games[0].config,
              x: 0,
              y: 0,
              width: 640,
              height: 480,
            },
          ],
        },
      ],
      slides: [
        { layoutId: 'lesson', elements: [], children: [{ layoutId: 'lesson', elements: [] }] },
      ],
    }
    const { dom, sockets } = await fixture(success(games), {}, source)
    await vi.waitFor(() =>
      expect(sockets.filter((socket) => socket.namespace === '/games')).toHaveLength(2)
    )
    const hosts = sockets.filter((socket) => socket.namespace === '/games')
    for (const socket of hosts) socket.receive('game-player-joined', {})
    shortcut(dom.window, { action: 'startPoll', effectiveSlideId: undefined })
    shortcut(dom.window, { action: 'startPoll', effectiveSlideId: 'unknown' })
    expect(hosts.map((socket) => stateOf(socket).phase)).toEqual(['waiting', 'waiting'])
    shortcut(dom.window, { action: 'startPoll', effectiveSlideId: 'position:0:1' })
    expect(hosts.map((socket) => stateOf(socket).phase)).toEqual(['waiting', 'active'])
    shortcut(dom.window, { action: 'startPoll', effectiveSlideId: 'position:0:0' })
    expect(hosts.map((socket) => stateOf(socket).phase)).toEqual(['active', 'active'])
  })
})
