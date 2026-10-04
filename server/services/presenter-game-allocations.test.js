import { beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const GameEngine = require('./game-room-manager-singleton-service.js')
const { bootstrapPresenterGames } = require('./presenter-game-bootstrap.js')
const { createDefaultGameConfig } = require('../../shared/src/education/game-defaults.js')
const game = (id, patch = {}) => ({
  id,
  type: 'game',
  gameType: 'poll',
  poll: { ...createDefaultGameConfig('poll'), ...patch },
})
const scope = {}
const owner = {
  presentationId: 'deck',
  liveRoomCode: 'ROOM',
  presentationGeneration: 1,
  allocationScope: scope,
}
const deck = (elements) => ({ id: 'deck', slides: [{ id: 'one', elements }] })
const bootstrap = (source, capabilities = {}, authority = owner) =>
  bootstrapPresenterGames(source, capabilities, authority)
beforeEach(() => GameEngine._reset())

describe('effective live game allocation', () => {
  it('isolates inherited parent/vertical roots and hidden overrides without changing saved IDs', () => {
    const source = {
      id: 'deck',
      layoutMasters: [
        {
          id: 'lesson',
          name: 'Lesson',
          placeholders: [],
          fixedElements: [{ ...game('master'), x: 0, y: 0, width: 640, height: 480 }],
        },
      ],
      slides: [
        {
          id: 'one',
          layoutId: 'lesson',
          elements: [],
          children: [{ id: 'child', layoutId: 'lesson', elements: [] }],
        },
        { id: 'two', layoutId: 'lesson', elements: [] },
        {
          id: 'hidden',
          layoutId: 'lesson',
          elements: [],
          layoutOverrides: { elementPatches: { master: { hidden: true } } },
        },
      ],
    }
    const before = structuredClone(source),
      result = bootstrap(source)
    expect(result.ok).toBe(true)
    expect(result.games.map((item) => item.effectiveSlideId)).toEqual(['one', 'child', 'two'])
    expect(new Set(result.games.map((item) => item.transportGameId)).size).toBe(3)
    for (const item of result.games) {
      expect(item.elementId).toBe('layout-fixed:lesson:master')
      expect(item.transportGameId).not.toContain('master')
      expect(GameEngine.getRoom(item.transportGameId).config.prompt).toBe(
        createDefaultGameConfig('poll').prompt
      )
    }
    expect(source).toEqual(before)
  })
  it('reuses rooms and scores on a new admitted freshness epoch but not a new live-room instance', () => {
    const source = deck([game('poll')]),
      first = bootstrap(source),
      mapped = first.games[0]
    GameEngine.joinRoom(mapped.transportGameId, 'host', 'Teacher', {
      socketId: 'host-socket',
      role: 'host',
      hostCapability: mapped.hostCapability,
    })
    const room = GameEngine.getRoom(mapped.transportGameId)
    room.players.get('host').score = 37
    const reconnect = bootstrap(
      source,
      { [mapped.transportGameId]: mapped.hostCapability },
      { ...owner, presentationGeneration: 2 }
    )
    expect(reconnect.games[0].transportGameId).toBe(mapped.transportGameId)
    expect(reconnect.allocationGeneration).toBe(first.allocationGeneration)
    expect(room.players.get('host').score).toBe(37)
    expect(room.owner.presentationGeneration).toBe(2)
    const recreated = bootstrap(source, {}, { ...owner, allocationScope: {} })
    expect(recreated.games[0].transportGameId).not.toBe(mapped.transportGameId)
    expect(room.players.get('host').score).toBe(37)
  })
  it('forks changed game content, not element styling, retaining the old session until actual cleanup', () => {
    const source = deck([game('poll')]),
      first = bootstrap(source),
      mapped = first.games[0]
    source.slides[0].elements[0].x = 85
    expect(bootstrap(source).allocationGeneration).toBe(first.allocationGeneration)
    source.slides[0].elements[0].poll.prompt = 'New vote'
    const changed = bootstrap(source)
    expect(changed.sessionChanged).toBe(true)
    expect(changed.games[0].transportGameId).not.toBe(mapped.transportGameId)
    expect(GameEngine.getRoom(mapped.transportGameId).config.prompt).not.toBe('New vote')
    const currentId = changed.games[0].transportGameId
    GameEngine.cleanup(mapped.transportGameId)
    expect(bootstrap(source).games[0].transportGameId).toBe(currentId)
    GameEngine.cleanup(currentId)
    expect(bootstrap(source).games[0].transportGameId).not.toBe(currentId)
  })
  it('fails private capability admission before allocating another game', () => {
    const source = deck([game('poll'), game('second')]),
      first = bootstrap(source)
    for (const item of first.games)
      GameEngine.joinRoom(item.transportGameId, item.elementId, 'Teacher', {
        playerId: 'host',
        role: 'host',
        hostCapability: item.hostCapability,
      })
    const denied = bootstrap(source, {
      [first.games[1].transportGameId]: first.games[1].hostCapability,
    })
    expect(denied).toMatchObject({
      ok: false,
      error: 'host-capability-required',
      gameIds: [first.games[0].transportGameId],
    })
    expect(GameEngine.getRoom(first.games[1].transportGameId).owner.presentationGeneration).toBe(1)
  })
  it('rejects invalid private configuration atomically and excludes local-only games', () => {
    const source = deck([
      game('poll'),
      { id: 'bad', type: 'game', gameType: 'hot-potato', 'hot-potato': { questions: [null] } },
    ])
    expect(bootstrap(source)).toMatchObject({ ok: false, error: 'invalid-game-config' })
    expect(bootstrap(deck([{ id: 'local', type: 'game', gameType: 'countdown' }]))).toMatchObject({
      ok: true,
      games: [],
    })
  })
})
