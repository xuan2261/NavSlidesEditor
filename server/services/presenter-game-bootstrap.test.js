import { beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const GameEngine = require('./game-room-manager-singleton-service.js')
const {
  bootstrapPresenterGames: bootstrapPresenterGamesWithOwner,
  collectGameDescriptors,
} = require('./presenter-game-bootstrap.js')

const OWNER = {
  presentationId: 'deck-1',
  liveRoomCode: 'ROOM1',
  presentationGeneration: 1,
}
const bootstrapPresenterGames = (presentation, knownCapabilities = {}) =>
  bootstrapPresenterGamesWithOwner(presentation, knownCapabilities, OWNER)
const bootstrapFor = (presentation, owner, knownCapabilities = {}) =>
  bootstrapPresenterGamesWithOwner(presentation, knownCapabilities, owner)

beforeEach(() => GameEngine._reset())

describe('presenter game bootstrap', () => {
  it('collects supported games from horizontal and vertical slides', () => {
    const descriptors = collectGameDescriptors({
      slides: [
        {
          elements: [{ id: 'poll-1', type: 'game', gameType: 'poll', prompt: 'Question' }],
          children: [{ elements: [{ id: 'picker-1', type: 'game', gameType: 'name-picker', items: ['Ada'] }] }],
        },
      ],
    })

    expect(descriptors).toEqual([
      { gameId: 'poll-1', gameType: 'poll', options: { prompt: 'Question' } },
      { gameId: 'picker-1', gameType: 'name-picker', options: { items: ['Ada'] } },
    ])
  })

  it('passes nested hot-potato allowLate configuration to the room', () => {
    const result = bootstrapPresenterGames({
      slides: [{ elements: [{
        id: 'late-game',
        type: 'game',
        gameType: 'hot-potato',
        'hot-potato': {
          allowLate: true,
          questions: [{ id: 'q1', correctIndex: 0, points: 10, timeLimit: 5 }],
        },
      }] }],
    })

    expect(result.ok).toBe(true)
    expect(GameEngine.getRoom('late-game')).toMatchObject({ allowLate: true })
  })

  it('creates rooms from authoritative options and returns a private capability', () => {
    const result = bootstrapPresenterGames({
      slides: [{ elements: [{
        id: 'poll-1',
        type: 'game',
        gameType: 'poll',
        poll: { prompt: 'Authoritative prompt', options: [{ id: 'yes', text: 'Yes' }] },
        options: { prompt: 'untrusted browser value' },
      }] }],
    })

    expect(result.ok).toBe(true)
    expect(result.games).toHaveLength(1)
    expect(typeof result.games[0].hostCapability).toBe('string')
    const room = GameEngine.getRoom('poll-1')
    expect(room.gameType).toBe('poll')
    expect(room.poll.prompt).toBe('Authoritative prompt')
    expect(room).not.toHaveProperty('hostCapability')
    expect(JSON.stringify(GameEngine.getLeaderboard('poll-1'))).not.toContain(result.games[0].hostCapability)
  })

  it('reuses a claimed room only with the matching presenter capability', () => {
    const created = bootstrapPresenterGames({
      slides: [{ elements: [{ id: 'picker-1', type: 'game', gameType: 'name-picker', items: ['Ada'] }] }],
    })
    const capability = created.games[0].hostCapability
    const joined = GameEngine.joinRoom('picker-1', 'presenter', 'Presenter', {
      socketId: 'presenter-socket',
      role: 'host',
      hostCapability: capability,
      requireSession: true,
    })
    expect(joined.ok).toBe(true)

    const reused = bootstrapPresenterGames(
      { slides: [{ elements: [{ id: 'picker-1', type: 'game', gameType: 'name-picker' }] }] },
      { 'picker-1': capability }
    )
    expect(reused).toEqual({
      ok: true,
      games: [{ gameId: 'picker-1', gameType: 'name-picker', hostCapability: capability }],
    })
  })

  it('rejects a claimed room without a matching private capability', () => {
    const created = bootstrapPresenterGames({
      slides: [{ elements: [{ id: 'picker-1', type: 'game', gameType: 'name-picker' }] }],
    })
    GameEngine.joinRoom('picker-1', 'presenter', 'Presenter', {
      socketId: 'presenter-socket',
      role: 'host',
      hostCapability: created.games[0].hostCapability,
      requireSession: true,
    })

    expect(bootstrapPresenterGames({
      slides: [{ elements: [{ id: 'picker-1', type: 'game', gameType: 'name-picker' }] }],
    })).toEqual({ ok: false, error: 'host-capability-required', gameIds: ['picker-1'] })
  })

  it('rejects a legacy presenter identity preclaimed by an ordinary player', () => {
    const created = bootstrapPresenterGames({
      slides: [{ elements: [{ id: 'legacy-host-game', type: 'game', gameType: 'poll' }] }],
    })
    const legacyPlayerId = 'presenter-legacy-host-game'
    const preclaim = GameEngine.joinRoom('legacy-host-game', legacyPlayerId, 'Player', {
      socketId: 'ordinary-player-socket',
      role: 'player',
    })
    expect(preclaim.ok).toBe(true)

    const legacyHostJoin = GameEngine.joinRoom('legacy-host-game', legacyPlayerId, 'Presenter', {
      socketId: 'legacy-host-socket',
      role: 'host',
      hostCapability: created.games[0].hostCapability,
      requireSession: true,
    })

    expect(legacyHostJoin).toEqual({ ok: false, error: 'invalid-player-session' })
  })

  it('rejects a cloned deck or second live room from reusing a game id', () => {
    const first = bootstrapPresenterGames({
      id: 'deck-1',
      slides: [{ elements: [{ id: 'shared-game', type: 'game', gameType: 'poll' }] }],
    })
    const second = bootstrapFor({
      id: 'deck-2',
      slides: [{ elements: [{ id: 'shared-game', type: 'game', gameType: 'poll' }] }],
    }, {
      presentationId: 'deck-2',
      liveRoomCode: 'ROOM2',
      presentationGeneration: 1,
    })

    expect(first.ok).toBe(true)
    expect(second).toEqual({ ok: false, error: 'game-room-conflict', gameId: 'shared-game' })
    expect(GameEngine.getRoom('shared-game').owner).toEqual(OWNER)
  })

  it('keeps an occupied room isolated from a second live owner', () => {
    const first = bootstrapPresenterGames({
      id: 'deck-1',
      slides: [{ elements: [{ id: 'occupied-game', type: 'game', gameType: 'poll' }] }],
    })
    const joined = GameEngine.joinRoom('occupied-game', 'presenter-old', 'Presenter', {
      socketId: 'old-presenter-socket',
      role: 'host',
      hostCapability: first.games[0].hostCapability,
      requireSession: true,
    })
    expect(joined.ok).toBe(true)

    const second = bootstrapFor({
      id: 'deck-2',
      slides: [{ elements: [{ id: 'occupied-game', type: 'game', gameType: 'poll' }] }],
    }, {
      presentationId: 'deck-2',
      liveRoomCode: 'ROOM2',
      presentationGeneration: 1,
    })

    expect(second).toEqual({ ok: false, error: 'game-room-conflict', gameId: 'occupied-game' })
  })

  it('reclaims a disconnected claimed room for a new live owner', () => {
    const first = bootstrapPresenterGames({
      id: 'deck-1',
      slides: [{ elements: [{ id: 'restart-game', type: 'game', gameType: 'poll' }] }],
    })
    const joined = GameEngine.joinRoom('restart-game', 'presenter-old', 'Presenter', {
      socketId: 'old-presenter-socket',
      role: 'host',
      hostCapability: first.games[0].hostCapability,
      requireSession: true,
    })
    expect(joined.ok).toBe(true)
    GameEngine.disconnectRoom('restart-game', 'presenter-old', 'old-presenter-socket')

    const replacementOwner = {
      presentationId: 'deck-1',
      liveRoomCode: 'ROOM2',
      presentationGeneration: 1,
    }
    const replacement = bootstrapFor({
      id: 'deck-1',
      slides: [{ elements: [{ id: 'restart-game', type: 'game', gameType: 'poll' }] }],
    }, replacementOwner)

    expect(replacement.ok).toBe(true)
    expect(GameEngine.getRoom('restart-game').owner).toEqual(replacementOwner)
    expect(GameEngine.getRoom('restart-game').players.size).toBe(0)
  })

  it('does not reclaim a disconnected room across presentations', () => {
    const first = bootstrapPresenterGames({
      id: 'deck-1',
      slides: [{ elements: [{ id: 'cross-deck-game', type: 'game', gameType: 'poll' }] }],
    })
    const joined = GameEngine.joinRoom('cross-deck-game', 'presenter-old', 'Presenter', {
      socketId: 'old-presenter-socket',
      role: 'host',
      hostCapability: first.games[0].hostCapability,
      requireSession: true,
    })
    expect(joined.ok).toBe(true)
    GameEngine.disconnectRoom('cross-deck-game', 'presenter-old', 'old-presenter-socket')

    const replacement = bootstrapFor({
      id: 'deck-2',
      slides: [{ elements: [{ id: 'cross-deck-game', type: 'game', gameType: 'poll' }] }],
    }, {
      presentationId: 'deck-2',
      liveRoomCode: 'ROOM2',
      presentationGeneration: 1,
    })

    expect(replacement).toEqual({
      ok: false,
      error: 'game-room-conflict',
      gameId: 'cross-deck-game',
    })
    expect(GameEngine.getRoom('cross-deck-game').owner).toEqual(OWNER)
  })

  it('preflights all descriptors before creating rooms', () => {
    bootstrapFor({
      id: 'deck-2',
      slides: [{ elements: [{ id: 'claimed-game', type: 'game', gameType: 'poll' }] }],
    }, {
      presentationId: 'deck-2',
      liveRoomCode: 'ROOM2',
      presentationGeneration: 1,
    })
    const result = bootstrapPresenterGames({
      slides: [{ elements: [
        { id: 'new-game', type: 'game', gameType: 'poll' },
        { id: 'claimed-game', type: 'game', gameType: 'poll' },
      ] }],
    })

    expect(result).toEqual({ ok: false, error: 'game-room-conflict', gameId: 'claimed-game' })
    expect(GameEngine.getRoom('new-game')).toBeUndefined()
  })

  it('updates the generation when the same live presenter session reconnects', () => {
    const owner = { ...OWNER, presentationGeneration: 2 }
    bootstrapPresenterGames({
      slides: [{ elements: [{ id: 'reconnect-game', type: 'game', gameType: 'poll' }] }],
    })
    const reused = bootstrapFor({
      slides: [{ elements: [{ id: 'reconnect-game', type: 'game', gameType: 'poll' }] }],
    }, owner)

    expect(reused.ok).toBe(true)
    expect(GameEngine.getRoom('reconnect-game').owner).toEqual(owner)
  })

  it('returns no rooms for presentations without supported games', () => {
    expect(bootstrapPresenterGames({
      slides: [{ elements: [{ id: 'text-1', type: 'text', content: 'Hello' }] }],
    })).toEqual({ ok: true, games: [] })
  })
})
