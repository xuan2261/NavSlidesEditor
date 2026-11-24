import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const GameEngine = require('./game-room-manager-singleton-service.js')
const { bootstrapPresenterGames } = require('./presenter-game-bootstrap.js')
const {
  collectEffectiveGameDescriptors,
} = require('../../shared/src/education/effective-game-descriptors.js')
const game = (id = 'poll', patch = {}) => ({ id, type: 'game', gameType: 'poll', ...patch })
const deck = (elements) => ({ id: 'deck-1', slides: [{ id: 'one', elements }] })
let owner
const bootstrap = (source, capabilities = {}, authority = owner) =>
  bootstrapPresenterGames(source, capabilities, authority)
function join(binding, playerId = 'teacher') {
  return GameEngine.joinRoom(binding.transportGameId, playerId, 'Presenter', {
    socketId: 'host-socket',
    role: 'host',
    hostCapability: binding.hostCapability,
    requireSession: true,
  })
}
beforeEach(() => {
  GameEngine._reset()
  owner = {
    presentationId: 'deck-1',
    liveRoomCode: 'ROOM1',
    presentationGeneration: 1,
    allocationScope: {},
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  GameEngine._reset()
})

describe('presenter game bootstrap', () => {
  it('collects horizontal and vertical effective identities with positional fallback', () => {
    const descriptors = collectEffectiveGameDescriptors({
      slides: [
        {
          elements: [game('poll', { prompt: 'Question' })],
          children: [
            { elements: [game('cloud', { gameType: 'word-cloud', prompt: 'Share a word' })] },
          ],
        },
      ],
    })
    expect(
      descriptors.map(({ effectiveSlideId, elementId, gameType, config }) => [
        effectiveSlideId,
        elementId,
        gameType,
        config.prompt,
      ])
    ).toEqual([
      ['position:0:0', 'poll', 'poll', 'Question'],
      ['position:0:1', 'cloud', 'word-cloud', 'Share a word'],
    ])
  })
  it('preserves nested Hot Potato admission and authored settings in the authoritative room', () => {
    const result = bootstrap(
      deck([
        game('late', {
          gameType: 'hot-potato',
          'hot-potato': {
            allowLate: true,
            shuffleQuestions: true,
            showLeaderboard: false,
            customAuthoredSetting: 'retained',
            questions: [
              { id: 'q', question: 'Choose B', options: ['A', 'B'], correctIndex: 1, timeLimit: 5 },
            ],
          },
        }),
      ])
    )
    expect(result.ok).toBe(true)
    const room = GameEngine.getRoom(result.games[0].transportGameId)
    expect(room.allowLate).toBe(true)
    expect(room.config).toMatchObject({
      shuffleQuestions: true,
      showLeaderboard: false,
      customAuthoredSetting: 'retained',
    })
    expect(room.questions[0]).toMatchObject({ prompt: 'Choose B', timeLimit: 5 })
  })
  it('allocates every implemented live authority subtype and excludes classroom-local utilities', () => {
    const types = [
      'name-picker',
      'jeopardy',
      'four-corners',
      'relay-race',
      'trivia-champ',
      'scattergories',
      'quiz',
    ]
    const result = bootstrap(deck(types.map((type) => game(type, { gameType: type }))))
    expect(result.ok).toBe(true)
    expect(result.games.map((item) => item.gameType)).toEqual(types)
    expect(bootstrap(deck([game('local', { gameType: 'countdown' })]))).toEqual({
      ok: true,
      games: [],
    })
  })
  it.each(['null', 'duplicate', 'unsupported-kind'])(
    'preflights %s questions before allocating any earlier valid game',
    (invalid) => {
      const question = {
        id: 'duplicate',
        question: 'Choose A',
        options: ['A', 'B'],
        correctIndex: 0,
      }
      const questions =
        invalid === 'null'
          ? [null]
          : invalid === 'duplicate'
            ? [question, { ...question }]
            : [
                {
                  id: 'typed',
                  kind: 'multi-choice',
                  prompt: 'Select B',
                  options: [
                    { id: 'b', text: 'B' },
                    { id: 'a', text: 'A' },
                  ],
                  answerKey: { optionIds: ['b'] },
                  points: 10,
                  timeLimit: 30,
                  feedback: { correct: '', incorrect: '', explanation: '' },
                },
              ]
      const create = vi.spyOn(GameEngine, 'createRoom')
      const result = bootstrap(
        deck([game('valid'), game('bad', { gameType: 'hot-potato', 'hot-potato': { questions } })])
      )
      expect(result).toMatchObject({ ok: false, error: 'invalid-game-config' })
      if (invalid === 'duplicate') expect(result.message).toMatch(/duplicate|unique/i)
      if (invalid === 'unsupported-kind') expect(result.message).toMatch(/single-choice/)
      expect(create).not.toHaveBeenCalled()
    }
  )
  it('uses authoritative config and keeps host capability out of public room state', () => {
    const result = bootstrap(
      deck([
        game('poll', {
          poll: {
            prompt: 'Authoritative prompt',
            options: [
              { id: 'yes', text: 'Yes' },
              { id: 'no', text: 'No' },
            ],
          },
          options: { prompt: 'Untrusted browser value' },
        }),
      ])
    )
    expect(result.ok).toBe(true)
    const binding = result.games[0],
      room = GameEngine.getRoom(binding.transportGameId)
    expect(binding).toMatchObject({
      effectiveSlideId: 'one',
      elementId: 'poll',
      gameType: 'poll',
      hostCapability: expect.any(String),
    })
    expect(room.config.prompt).toBe('Authoritative prompt')
    expect(room.owner).toEqual({
      presentationId: 'deck-1',
      liveRoomCode: 'ROOM1',
      presentationGeneration: 1,
    })
    expect(room).not.toHaveProperty('hostCapability')
    expect(JSON.stringify(GameEngine.getLeaderboard(binding.transportGameId))).not.toContain(
      binding.hostCapability
    )
  })
  it('reuses a claimed room only with its matching private capability', () => {
    const source = deck([game()]),
      created = bootstrap(source),
      binding = created.games[0]
    expect(join(binding).ok).toBe(true)
    expect(bootstrap(source)).toEqual({
      ok: false,
      error: 'host-capability-required',
      gameIds: [binding.transportGameId],
    })
    expect(bootstrap(source, { [binding.transportGameId]: 'wrong' })).toMatchObject({
      ok: false,
      error: 'host-capability-required',
    })
    const reused = bootstrap(source, { [binding.transportGameId]: binding.hostCapability })
    expect(reused.ok).toBe(true)
    expect(reused.games[0]).toEqual(binding)
    expect(reused.allocationGeneration).toBe(created.allocationGeneration)
    expect(GameEngine.getRoom(binding.transportGameId).hostPlayerId).toBe('teacher')
  })
  it('rejects a legacy presenter identity preclaimed by an ordinary player', () => {
    const binding = bootstrap(deck([game()])).games[0],
      id = binding.transportGameId
    const playerId = `presenter-${id}`
    expect(
      GameEngine.joinRoom(id, playerId, 'Player', { socketId: 'player-socket', role: 'player' }).ok
    ).toBe(true)
    expect(join(binding, playerId)).toEqual({ ok: false, error: 'invalid-player-session' })
  })
  it.each(['occupied', 'disconnected'])(
    'isolates a second deck and live owner without altering the %s original room',
    (status) => {
      const source = deck([game('shared')]),
        first = bootstrap(source).games[0]
      expect(join(first).ok).toBe(true)
      const original = GameEngine.getRoom(first.transportGameId)
      original.players.get('teacher').score = 37
      if (status === 'disconnected')
        GameEngine.disconnectRoom(first.transportGameId, 'teacher', 'host-socket')
      const before = {
        owner: { ...original.owner },
        score: original.players.get('teacher').score,
        hostPlayerId: original.hostPlayerId,
      }
      const second = bootstrap(
        { ...source, id: 'deck-2' },
        {},
        {
          presentationId: 'deck-2',
          liveRoomCode: 'ROOM2',
          presentationGeneration: 1,
          allocationScope: {},
        }
      )
      expect(second.ok).toBe(true)
      expect(second.games[0].transportGameId).not.toBe(first.transportGameId)
      expect({
        owner: original.owner,
        score: original.players.get('teacher').score,
        hostPlayerId: original.hostPlayerId,
      }).toEqual(before)
      expect(GameEngine.getRoom(second.games[0].transportGameId).players.size).toBe(0)
    }
  )
  it('rolls back rooms created before a later creation failure and does not publish that allocation', () => {
    const original = GameEngine.createRoom,
      createdIds = []
    const create = vi.spyOn(GameEngine, 'createRoom').mockImplementation((id, type, ...args) => {
      if (type === 'word-cloud') throw new Error('Creation denied')
      const room = original(id, type, ...args)
      createdIds.push(id)
      return room
    })
    const source = deck([game('first'), game('second', { gameType: 'word-cloud' })])
    expect(bootstrap(source)).toMatchObject({
      ok: false,
      error: 'game-room-create-failed',
      message: 'Creation denied',
    })
    expect(createdIds).toHaveLength(1)
    expect(GameEngine.getRoom(createdIds[0])).toBeUndefined()
    create.mockRestore()
    const retry = bootstrap(source)
    expect(retry.ok).toBe(true)
    expect(
      retry.games.map((binding) => GameEngine.getRoom(binding.transportGameId).gameType)
    ).toEqual(['poll', 'word-cloud'])
    expect(retry.games[0].transportGameId).not.toBe(createdIds[0])
  })
  it('requires authenticated owner allocation scope for live games, not for an empty deck', () => {
    expect(bootstrap(deck([game()]), {}, { ...owner, allocationScope: undefined })).toEqual({
      ok: false,
      error: 'game-room-owner-required',
    })
    expect(bootstrap(deck([{ id: 'text', type: 'text', content: 'Lesson' }]), {}, null)).toEqual({
      ok: true,
      games: [],
    })
  })
})
