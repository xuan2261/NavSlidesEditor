import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const {
  readLiveEnvelope,
  createLiveCommand,
  acceptLiveSnapshot,
} = require('../../src/education/live-round-state')
const { createLiveHostBridge } = require('../../src/education/browser/live-host-bridge')
const E = { gameId: 'g', roomInstanceId: 'instance', generation: 0, roundId: 1 }
describe('shared live authority boundaries', () => {
  it('rejects missing identity and stale absolute state', () => {
    expect(readLiveEnvelope({ gameId: 'g' })).toBeNull()
    expect(createLiveCommand(E, 'cmd', { generation: 999 })).toEqual({ ...E, commandId: 'cmd' })
    const state = { ...E, stateVersion: 3 }
    expect(acceptLiveSnapshot(state, { ...E, stateVersion: 2 })).toBe(state)
    expect(acceptLiveSnapshot(state, { ...E, roundId: 0, stateVersion: 4 })).toBe(state)
    expect(acceptLiveSnapshot(state, { ...E, generation: 1, stateVersion: 0 }).generation).toBe(1)
  })
  it('borrows a joined socket, hydrates E, and removes listeners without disconnecting its owner', () => {
    const listeners = new Map(),
      sent = []
    const socket = {
      connected: true,
      on: (event, fn) => listeners.set(event, fn),
      off: (event) => listeners.delete(event),
      emit: (event, payload) => sent.push([event, payload]),
    }
    const bridge = createLiveHostBridge({ socket, gameId: 'g', createCommandId: () => 'c' })
    expect(bridge.dispatch('game-next', {})).toBe(false)
    listeners.get('game-session')({ ...E, isHost: true })
    listeners.get('game-round-state')({ ...E, stateVersion: 2, phase: 'active' })
    expect(bridge.dispatch('game-next', {})).toBe(true)
    bridge.destroy()
    expect(listeners.size).toBe(0)
  })
  it('does not roll host authority backward from a delayed receipt or revive an expired room', () => {
    const listeners = new Map(),
      sent = []
    let sequence = 0
    const socket = {
      connected: true,
      on: (event, fn) => listeners.set(event, fn),
      off: (event) => listeners.delete(event),
      emit: (event, data) => sent.push(data),
    }
    const bridge = createLiveHostBridge({
      socket,
      gameId: 'g',
      createCommandId: () => `c-${++sequence}`,
    })
    listeners.get('game-session')({ ...E, isHost: true })
    bridge.dispatch('game-next')
    listeners.get('game-round-state')({ ...E, roundId: 2, stateVersion: 4 })
    listeners.get('game-command-result')({
      ...E,
      stateVersion: 2,
      commandId: 'c-1',
      accepted: true,
    })
    bridge.dispatch('game-next')
    expect(sent[1].roundId).toBe(2)
    listeners.get('game-room-expired')(E)
    listeners.get('game-session')({ ...E, isHost: true })
    expect(bridge.dispatch('game-next')).toBe(false)
    const replacement = { ...E, roomInstanceId: 'replacement' }
    listeners.get('game-session')({ ...replacement, isHost: true })
    listeners.get('game-room-expired')(E)
    expect(bridge.dispatch('game-next')).toBe(true)
    expect(sent[2].roomInstanceId).toBe('replacement')
    bridge.destroy()
  })
})
