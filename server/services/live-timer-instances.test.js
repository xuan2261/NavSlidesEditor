import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import liveRooms from './live-rooms.js'
import { setupSocketHandlers } from './socket-handler.js'

class Socket {
  constructor(id, io) {
    this.id = id
    this.io = io
    this.data = {}
    this.handlers = {}
    this.emitted = []
  }
  on(event, handler) {
    this.handlers[event] = handler
  }
  emit(event, payload) {
    this.emitted.push({ event, payload })
  }
  join() {}
  to(room) {
    return this.io.to(room)
  }
  async trigger(event, payload) {
    return this.handlers[event]?.(payload)
  }
}
class IO {
  handlers = {}
  emitted = []
  on(event, handler) {
    this.handlers[event] = handler
  }
  to(target) {
    return { emit: (event, payload) => this.emitted.push({ target, event, payload }) }
  }
  in() {
    return { socketsLeave() {} }
  }
  connect(id) {
    const socket = new Socket(id, this)
    this.handlers.connection(socket)
    return socket
  }
}
const inherited = (effectiveSlideId) => ({
  effectiveSlideId,
  elementId: 'layout-fixed:lesson:timer',
})
const key = (identity) => JSON.stringify([identity.effectiveSlideId, identity.elementId])
async function fixture() {
  const io = new IO()
  setupSocketHandlers(io, { liveRoomsService: liveRooms })
  const token = liveRooms.createPresenterToken()
  liveRooms.registerRoom('TUPLE', token)
  const host = io.connect('host')
  await host.trigger('join-room', { roomId: 'TUPLE', role: 'presenter', presenterToken: token })
  return { io, host, token, room: liveRooms.getRoomState('TUPLE') }
}
beforeEach(() => {
  vi.useFakeTimers()
  liveRooms._resetRooms()
})
afterEach(() => {
  liveRooms._resetRooms()
  vi.useRealTimers()
})

describe('authoritative inherited timer instances', () => {
  it('isolates start, pause, adjust, resume and stop for identical inherited element IDs', async () => {
    const { io, host, room } = await fixture(),
      parent = inherited('parent'),
      child = inherited('child')
    await host.trigger('game-timer-start', { ...parent, duration: 10 })
    await host.trigger('game-timer-start', { ...child, duration: 20 })
    expect(room.timers[key(parent)]).toMatchObject({ duration: 10, running: true })
    expect(room.timers[key(child)]).toMatchObject({ duration: 20, running: true })
    vi.advanceTimersByTime(2000)
    await host.trigger('game-timer-pause', parent)
    expect(room.timers[key(parent)]).toMatchObject({ running: false, pausedRemaining: 8 })
    expect(room.timers[key(child)].running).toBe(true)
    await host.trigger('game-timer-adjust', { ...parent, delta: 3 })
    expect(room.timers[key(parent)]).toMatchObject({ duration: 13, pausedRemaining: 11 })
    expect(room.timers[key(child)].duration).toBe(20)
    await host.trigger('game-timer-resume', parent)
    expect(room.timers[key(parent)]).toMatchObject({ running: true, endedAt: Date.now() + 11000 })
    await host.trigger('game-timer-stop', child)
    expect(room.timers[key(child)]).toBeUndefined()
    expect(room.timers[key(parent)].running).toBe(true)
    vi.advanceTimersByTime(11000)
    expect(
      io.emitted.filter((row) => row.event === 'timer:ended').map((row) => row.payload)
    ).toEqual([parent])
  })
  it('retains separate deadlines on disconnect, re-arms on reconnect and expires only the overdue copy', async () => {
    const { io, host, token, room } = await fixture(),
      parent = inherited('parent'),
      child = inherited('child')
    await host.trigger('game-timer-start', { ...parent, duration: 1 })
    await host.trigger('game-timer-start', { ...child, duration: 10 })
    const viewer = io.connect('viewer')
    await viewer.trigger('join-room', { roomId: 'TUPLE', role: 'viewer' })
    await host.trigger('disconnect')
    vi.advanceTimersByTime(2000)
    const next = io.connect('next')
    await next.trigger('join-room', { roomId: 'TUPLE', role: 'presenter', presenterToken: token })
    expect(room.timers[key(parent)]).toMatchObject({ running: false, pausedRemaining: 0 })
    expect(room.timers[key(child)].running).toBe(true)
    expect(
      next.emitted
        .filter((row) => row.event === 'timer:sync')
        .map((row) => [row.payload.effectiveSlideId, row.payload.remaining])
    ).toEqual([
      ['parent', 0],
      ['child', 8],
    ])
    vi.advanceTimersByTime(8000)
    expect(
      io.emitted.filter((row) => row.event === 'timer:ended').map((row) => row.payload)
    ).toEqual([parent, child])
  })
  it('rejects an already-queued timeout after a same-deadline replacement without clearing the replacement timeout', async () => {
    const { io, host, room } = await fixture(),
      parent = inherited('parent')
    const schedule = globalThis.setTimeout,
      callbacks = []
    const spy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((callback, delay, ...args) => {
        if (delay === 1000) callbacks.push(callback)
        return schedule(callback, delay, ...args)
      })
    try {
      await host.trigger('game-timer-start', { ...parent, duration: 1 })
      await host.trigger('game-timer-start', { ...parent, duration: 1 })
      const replacement = room.timers[key(parent)],
        timeout = room.timerTimeouts[key(parent)]
      callbacks[0]()
      expect(replacement.running).toBe(true)
      expect(room.timerTimeouts[key(parent)]).toBe(timeout)
      vi.advanceTimersByTime(1000)
      expect(
        io.emitted.filter((row) => row.event === 'timer:ended').map((row) => row.payload)
      ).toEqual([parent])
    } finally {
      spy.mockRestore()
    }
  })
  it('rejects missing identity and unauthorized controls without disturbing an admitted timer', async () => {
    const { io, host, room } = await fixture(),
      parent = inherited('parent')
    await host.trigger('game-timer-start', { ...parent, duration: 10 })
    const viewer = io.connect('viewer')
    await viewer.trigger('join-room', { roomId: 'TUPLE', role: 'viewer' })
    await viewer.trigger('game-timer-stop', parent)
    await host.trigger('game-timer-pause', { elementId: parent.elementId })
    await host.trigger('game-timer-start', { ...inherited('child'), duration: 7201 })
    await host.trigger('game-timer-adjust', { ...parent, delta: 3601 })
    expect(Object.values(room.timers)).toEqual([
      expect.objectContaining({ effectiveSlideId: 'parent', duration: 10, running: true }),
    ])
  })
})
