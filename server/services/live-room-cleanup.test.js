// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as storage from './storage.js'
import liveRooms from './live-rooms.js'
import { setupSocketHandlers } from './socket-handler.js'

// Minimal Socket.IO test doubles (mirrors socket-handler.test.js harness).
class FakeSocket {
  constructor(id, io) {
    this.id = id
    this.io = io
    this.data = {}
    this.handlers = {}
    this.emitted = []
    this.rooms = []
  }
  on(event, handler) { this.handlers[event] = handler }
  emit(event, payload) { this.emitted.push({ event, payload }) }
  join(room) { this.rooms.push(room) }
  to(room) {
    return {
      emit: (event, payload) => {
        this.io.broadcasts.push({ from: this.id, room, event, payload })
      },
    }
  }
  async trigger(event, payload) { return this.handlers[event]?.(payload) }
}

class FakeIO {
  constructor() {
    this.handlers = {}
    this.emitted = []
    this.broadcasts = []
    this.socketRoomLeaves = []
  }
  on(event, handler) { this.handlers[event] = handler }
  to(target) {
    return {
      emit: (event, payload) => { this.emitted.push({ target, event, payload }) },
    }
  }
  in(target) {
    return {
      socketsLeave: (room) => this.socketRoomLeaves.push({ target, room }),
    }
  }
  connect(id) {
    const socket = new FakeSocket(id, this)
    this.handlers.connection(socket)
    return socket
  }
}

const GRACE_MS = 1000

describe('live room cleanup + timer re-arm', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    storage.initDataFiles()
    liveRooms._resetRooms()
    liveRooms._setLiveRoomTtl(GRACE_MS)
    liveRooms._setPresenterGraceMs(GRACE_MS)
    await storage.writePresentations([
      { id: 'live-deck', title: 'Live Deck', slides: [{ id: 's1', elements: [] }, { id: 's2', elements: [] }] },
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reaps an orphaned room after the grace window when the presenter disconnects with no viewers', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const token = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOMAA', token)

    const presenter = io.connect('p-1')
    await presenter.trigger('join-room', { roomId: 'ROOMAA', role: 'presenter', presenterToken: token })

    expect(liveRooms.getRoomState('ROOMAA')).toBeDefined()

    await presenter.trigger('disconnect')
    // Still present during grace window
    expect(liveRooms.getRoomState('ROOMAA')).toBeDefined()

    vi.advanceTimersByTime(GRACE_MS + 10)
    // Reaped after grace window
    expect(liveRooms.getRoomState('ROOMAA')).toBeUndefined()
  })

  it('does not let a viewer cancel presenter termination during grace', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const token = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOMBB', token)

    const presenter = io.connect('p-1')
    await presenter.trigger('join-room', { roomId: 'ROOMBB', role: 'presenter', presenterToken: token })
    await presenter.trigger('disconnect')

    const viewer = io.connect('v-1')
    await viewer.trigger('join-room', { roomId: 'ROOMBB', role: 'viewer' })
    expect(liveRooms.getRoomState('ROOMBB')).toBeDefined()

    vi.advanceTimersByTime(GRACE_MS + 10)
    expect(io.emitted).toContainEqual({ target: 'ROOMBB', event: 'presenter-left', payload: undefined })
    expect(io.socketRoomLeaves).toContainEqual({ target: 'ROOMBB', room: 'ROOMBB' })
    expect(liveRooms.getRoomState('ROOMBB')).toBeUndefined()
  })

  it('cancels pending cleanup when the presenter reconnects inside the grace window', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const token = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOMCC', token)

    const presenter = io.connect('p-1')
    await presenter.trigger('join-room', { roomId: 'ROOMCC', role: 'presenter', presenterToken: token })
    await presenter.trigger('disconnect')

    const presenter2 = io.connect('p-2')
    await presenter2.trigger('join-room', { roomId: 'ROOMCC', role: 'presenter', presenterToken: token })

    vi.advanceTimersByTime(GRACE_MS + 10)
    expect(liveRooms.getRoomState('ROOMCC')).toBeDefined()
  })

  it('re-arms a running timer so timer:ended fires at the correct remaining time after presenter reconnect', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const token = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOMDD', token)

    const presenter = io.connect('p-1')
    await presenter.trigger('join-room', { roomId: 'ROOMDD', role: 'presenter', presenterToken: token })
    await presenter.trigger('game-timer-start', { elementId: 'g1', duration: 5 })

    // Presenter drops mid-countdown → timeouts cleared by leaveRoom
    await presenter.trigger('disconnect')

    // Reconnect cancels cleanup and must re-arm the running timer
    const presenter2 = io.connect('p-2')
    await presenter2.trigger('join-room', { roomId: 'ROOMDD', role: 'presenter', presenterToken: token })

    io.emitted = [] // clear sync noise from rejoin
    vi.advanceTimersByTime(5000 + 10)

    expect(io.emitted.some((e) => e.event === 'timer:ended' && e.payload.elementId === 'g1')).toBe(true)
  })

  it('finalizes a timer that expires while the presenter is disconnected', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const token = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOMDE', token)

    const presenter = io.connect('p-1')
    await presenter.trigger('join-room', { roomId: 'ROOMDE', role: 'presenter', presenterToken: token })
    await presenter.trigger('game-timer-start', { elementId: 'g1', duration: 1 })
    const viewer = io.connect('v-1')
    await viewer.trigger('join-room', { roomId: 'ROOMDE', role: 'viewer' })
    liveRooms._setPresenterGraceMs(GRACE_MS * 2)
    await presenter.trigger('disconnect')

    vi.advanceTimersByTime(1000 + 10)
    expect(liveRooms.getRoomState('ROOMDE').timers.g1.running).toBe(true)

    const reconnectingPresenter = io.connect('p-2')
    await reconnectingPresenter.trigger('join-room', { roomId: 'ROOMDE', role: 'presenter', presenterToken: token })

    const timer = liveRooms.getRoomState('ROOMDE').timers.g1
    expect(timer).toMatchObject({ running: false, pausedRemaining: 0, endedAt: null })
    expect(io.emitted).toContainEqual({ target: 'ROOMDE', event: 'timer:ended', payload: { elementId: 'g1' } })
    expect(reconnectingPresenter.emitted).toContainEqual({
      event: 'timer:sync',
      payload: { elementId: 'g1', remaining: 0, duration: 1, running: false, endedAt: null },
    })
  })

  it('does not lose timer re-arm when expiry crosses between prior checks', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const token = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOMDF', token)

    const presenter = io.connect('p-1')
    await presenter.trigger('join-room', { roomId: 'ROOMDF', role: 'presenter', presenterToken: token })
    await presenter.trigger('game-timer-start', { elementId: 'g1', duration: 1 })
    const viewer = io.connect('v-1')
    await viewer.trigger('join-room', { roomId: 'ROOMDF', role: 'viewer' })
    await presenter.trigger('disconnect')

    const timer = liveRooms.getRoomState('ROOMDF').timers.g1
    let nowCalls = 0
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
      nowCalls += 1
      return nowCalls === 2 ? timer.endedAt + 1 : timer.endedAt - 1
    })
    try {
      const reconnectingPresenter = io.connect('p-2')
      await reconnectingPresenter.trigger('join-room', {
        roomId: 'ROOMDF', role: 'presenter', presenterToken: token,
      })

      expect(liveRooms.getRoomState('ROOMDF').timerTimeouts.g1).toBeDefined()
      vi.advanceTimersByTime(1)
      expect(io.emitted).toContainEqual({
        target: 'ROOMDF', event: 'timer:ended', payload: { elementId: 'g1' },
      })
    } finally {
      nowSpy.mockRestore()
    }
  })
})
