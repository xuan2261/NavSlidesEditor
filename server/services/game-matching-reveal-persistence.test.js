// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const GameEngine = require('./game-room-manager-singleton-service')
const { setupGameSocketHandlers } = require('./game-socket-handler')

function createSocket(id) {
  const handlers = {}
  return {
    id,
    handlers,
    on: vi.fn((event, handler) => { handlers[event] = handler }),
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
  }
}

function createSocketHarness() {
  let connectionHandler
  const broadcasts = vi.fn()
  const namespace = {
    on: vi.fn((event, handler) => {
      if (event === 'connection') connectionHandler = handler
    }),
    to: vi.fn(() => ({ emit: broadcasts })),
  }

  setupGameSocketHandlers({ of: vi.fn(() => namespace) })

  return {
    broadcasts,
    connect(socket) {
      connectionHandler(socket)
    },
  }
}

describe('matching reveal persistence', () => {
  beforeEach(() => {
    GameEngine._reset()
  })

  afterEach(() => {
    GameEngine._reset()
  })

  it('hydrates a late player with revealed answers and resets a new round', () => {
    const gameId = 'matching-reveal-rejoin'
    GameEngine.createRoom(gameId, 'matching', {
      pairs: [
        { promptId: 'prompt-1', prompt: 'HTTP', targetId: 'target-1', target: 'Protocol' },
        { promptId: 'prompt-2', prompt: 'TLS', targetId: 'target-2', target: 'Security' },
      ],
    })
    const hostCapability = GameEngine.takeHostCapability(gameId)
    const harness = createSocketHarness()
    const host = createSocket('host-socket')
    harness.connect(host)

    host.handlers['game-join']({
      gameId,
      playerName: 'Host',
      playerId: 'host-player',
      role: 'host',
      hostCapability,
    })
    host.handlers['game-matching-start']({ gameId })
    host.handlers['game-matching-reveal']({ gameId })

    const latePlayer = createSocket('late-player-socket')
    harness.connect(latePlayer)
    latePlayer.handlers['game-join']({
      gameId,
      playerName: 'Late Player',
      playerId: 'late-player',
      role: 'player',
    })

    const startedEvent = latePlayer.emit.mock.calls.find(
      ([event]) => event === 'game-matching-started'
    )
    expect(startedEvent).toBeDefined()
    expect(startedEvent[1]).toMatchObject({
      answerKey: [
        { promptId: 'prompt-1', targetId: 'target-1' },
        { promptId: 'prompt-2', targetId: 'target-2' },
      ],
    })

    latePlayer.handlers['game-matching-submit']({
      gameId,
      pairs: [
        { promptId: 'prompt-1', targetId: 'target-1' },
        { promptId: 'prompt-2', targetId: 'target-2' },
      ],
    })
    expect(GameEngine.getMatchingState(gameId)).toMatchObject({ submissions: 1 })
    const postRevealSummary = harness.broadcasts.mock.calls
      .filter(([event]) => event === 'game-matching-results')
      .at(-1)
    expect(postRevealSummary).toBeDefined()
    expect(postRevealSummary[1]).toMatchObject({
      submissions: 1,
      answerKey: [
        { promptId: 'prompt-1', targetId: 'target-1' },
        { promptId: 'prompt-2', targetId: 'target-2' },
      ],
    })

    GameEngine.endGame(gameId)
    expect(GameEngine.getRoom(gameId)).toMatchObject({ cleanupKind: 'finished', status: 'finished' })
    host.handlers['game-matching-start']({ gameId })

    const restartedRoom = GameEngine.getRoom(gameId)
    expect(restartedRoom).toMatchObject({ cleanupKind: null, status: 'active' })
    expect(restartedRoom.cleanupTimer).toBeNull()
    expect(GameEngine.getMatchingState(gameId)).toMatchObject({ submissions: 0 })
    expect(GameEngine.getMatchingState(gameId)).not.toHaveProperty('answerKey')
  })
})
