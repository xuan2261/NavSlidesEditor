import { beforeEach, describe, expect, it } from 'vitest'
import * as storage from './storage.js'
import liveRooms from './live-rooms.js'
import { setupSocketHandlers } from './socket-handler.js'

class FakeSocket {
  constructor(id, io) {
    this.id = id
    this.io = io
    this.data = {}
    this.handlers = {}
    this.emitted = []
    this.rooms = []
  }

  on(event, handler) {
    this.handlers[event] = handler
  }

  emit(event, payload) {
    this.emitted.push({ event, payload })
  }

  join(room) {
    this.rooms.push(room)
  }

  to(room) {
    return {
      emit: (event, payload) => {
        this.io.broadcasts.push({ from: this.id, room, event, payload })
      },
    }
  }

  async trigger(event, payload) {
    return this.handlers[event]?.(payload)
  }
}

class FakeIO {
  constructor() {
    this.handlers = {}
    this.emitted = []
    this.broadcasts = []
  }

  on(event, handler) {
    this.handlers[event] = handler
  }

  to(target) {
    return {
      emit: (event, payload) => {
        this.emitted.push({ target, event, payload })
      },
    }
  }

  connect(id) {
    const socket = new FakeSocket(id, this)
    this.handlers.connection(socket)
    return socket
  }
}

describe('socket-handler', () => {
  beforeEach(async () => {
    storage.initDataFiles()
    liveRooms._resetRooms()
    await storage.writePresentations([
      {
        id: 'live-deck',
        title: 'Live Deck',
        slides: [
          {
            id: 's1',
            notes: 'Root notes',
            elements: [{ id: 't1', type: 'text', content: '<h2>Root title</h2>' }],
            children: [
              {
                id: 's1-child',
                notes: 'Child notes',
                elements: [{ id: 't2', type: 'text', content: '<h2>Child title</h2>' }],
              },
            ],
          },
        ],
      },
      {
        id: 'trashed-deck',
        title: 'Trashed Deck',
        deletedAt: '2026-01-01T00:00:00.000Z',
        slides: [
          {
            id: 's1',
            elements: [{ id: 't1', type: 'text', content: '<h2>Deleted title</h2>' }],
          },
        ],
      },
    ])
  })

  it('emits presentation data/meta on presenter join and syncs viewers/controllers', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)

    const presenter = io.connect('presenter-1')
    await presenter.trigger('join-room', {
      roomId: 'ROOM12',
      role: 'presenter',
      presentationId: 'live-deck',
      presenterToken,
    })

    expect(presenter.rooms).toContain('ROOM12')
    expect(io.emitted.some((item) => item.event === 'presentation-data')).toBe(true)
    const meta = io.emitted.find((item) => item.event === 'presentation-meta')?.payload
    expect(meta).toMatchObject({
      presentationId: 'live-deck',
      title: 'Live Deck',
      slideCount: 1,
    })
    expect(meta.slides.map((slide) => slide.label)).toEqual(['1', '1.1'])
    expect(meta.slides.map((slide) => slide.notes)).toEqual(['Root notes', 'Child notes'])

    await presenter.trigger('navigate', { slideIndex: 0, verticalIndex: 1, fragmentIndex: 2 })
    expect(io.broadcasts).toContainEqual({
      from: 'presenter-1',
      room: 'ROOM12',
      event: 'navigate',
      payload: { slideIndex: 0, verticalIndex: 1, fragmentIndex: 2 },
    })

    const viewer = io.connect('viewer-1')
    await viewer.trigger('join-room', { roomId: 'ROOM12', role: 'viewer' })
    expect(viewer.emitted).toContainEqual({
      event: 'sync-state',
      payload: { slideIndex: 0, verticalIndex: 1, fragmentIndex: 2 },
    })
    expect(viewer.emitted.some((item) => item.event === 'presentation-data')).toBe(true)

    const controller = io.connect('controller-1')
    await controller.trigger('join-room', { roomId: 'ROOM12', role: 'controller' })
    await controller.trigger('control-navigate', { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 })
    expect(io.emitted).toContainEqual({
      target: 'presenter-1',
      event: 'control-navigate',
      payload: { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 },
    })
  })

  it('does not emit live presentation payloads for trashed decks', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('TRASH1', presenterToken)

    const presenter = io.connect('presenter-trash')
    await presenter.trigger('join-room', {
      roomId: 'TRASH1',
      role: 'presenter',
      presentationId: 'trashed-deck',
      presenterToken,
    })

    expect(io.emitted.some((item) => item.event === 'presentation-data')).toBe(false)
    expect(liveRooms.getRoomState('TRASH1').presentationId).toBeNull()
  })

  it('rejects unknown rooms and notifies viewers when the presenter disconnects', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const viewer = io.connect('viewer-404')

    await viewer.trigger('join-room', { roomId: 'NOPE12', role: 'viewer' })
    expect(viewer.emitted).toContainEqual({
      event: 'room-not-found',
      payload: { roomId: 'NOPE12' },
    })

    const presenter = io.connect('presenter-2')
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM34', presenterToken)
    await presenter.trigger('join-room', {
      roomId: 'ROOM34',
      role: 'presenter',
      presentationId: 'live-deck',
      presenterToken,
    })
    presenter.trigger('disconnect')
    expect(io.emitted).toContainEqual({ target: 'ROOM34', event: 'presenter-disconnected', payload: undefined })
  })

  it('sends annotations:sync to presenter on join-room', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)

    const presenter = io.connect('presenter-1')
    await presenter.trigger('join-room', {
      roomId: 'ROOM12',
      role: 'presenter',
      presentationId: 'live-deck',
      presenterToken,
    })

    const syncEvent = presenter.emitted.find(e => e.event === 'annotations:sync')
    expect(syncEvent).toBeDefined()
    expect(syncEvent.payload.slideAnnotations).toEqual({})
  })

  it('sends annotations:sync to viewer on join-room with existing annotations', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)

    // Pre-populate annotations
    const room = liveRooms.getRoomState('ROOM12')
    room.annotations['0'] = [
      { id: 'a1', d: 'M0 0', color: '#FF0000', strokeWidth: 3 },
    ]

    const presenter = io.connect('presenter-1')
    await presenter.trigger('join-room', {
      roomId: 'ROOM12',
      role: 'presenter',
      presentationId: 'live-deck',
      presenterToken,
    })

    // Viewer joins mid-session
    const viewer = io.connect('viewer-1')
    await viewer.trigger('join-room', { roomId: 'ROOM12', role: 'viewer' })

    const syncEvent = viewer.emitted.find(e => e.event === 'annotations:sync')
    expect(syncEvent).toBeDefined()
    expect(syncEvent.payload.slideAnnotations['0']).toHaveLength(1)
    expect(syncEvent.payload.slideAnnotations['0'][0].id).toBe('a1')
  })

  it('annotation:add persists annotation and broadcasts to all room members', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)

    const presenter = io.connect('presenter-1')
    await presenter.trigger('join-room', {
      roomId: 'ROOM12',
      role: 'presenter',
      presenterToken,
    })

    // Inject presentationId so room has one
    liveRooms.getRoomState('ROOM12').presentationId = 'live-deck'

    await presenter.trigger('annotation:add', {
      slideIndex: 0,
      annotation: { d: 'M0 0 L10 10', color: '#FF0000', strokeWidth: 3 },
    })

    // Verify annotation persisted in room
    const room = liveRooms.getRoomState('ROOM12')
    expect(room.annotations['0']).toHaveLength(1)
    expect(room.annotations['0'][0].d).toBe('M0 0 L10 10')
    expect(room.annotations['0'][0].id).toBeDefined()

    // Verify broadcast via default namespace (not a separate room emit)
    expect(io.emitted.some(e => e.event === 'annotation:add')).toBe(true)
  })

  it('annotation:remove deletes annotation from room and broadcasts', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)

    const presenter = io.connect('presenter-1')
    await presenter.trigger('join-room', {
      roomId: 'ROOM12',
      role: 'presenter',
      presenterToken,
    })

    // Pre-add annotation
    const room = liveRooms.getRoomState('ROOM12')
    room.annotations['0'] = [{ id: 'a1', d: 'M0 0', color: '#FF0000', strokeWidth: 3 }]

    await presenter.trigger('annotation:remove', { slideIndex: 0, annotationId: 'a1' })

    expect(room.annotations['0']).toHaveLength(0)
    expect(io.emitted.some(e => e.event === 'annotation:removed')).toBe(true)
  })

  it('annotation:clear removes all annotations for slide', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)

    const presenter = io.connect('presenter-1')
    await presenter.trigger('join-room', {
      roomId: 'ROOM12',
      role: 'presenter',
      presenterToken,
    })

    const room = liveRooms.getRoomState('ROOM12')
    room.annotations['0'] = [{ id: 'a1', d: 'M0 0', color: '#FF0000' }]
    room.annotations['1'] = [{ id: 'a2', d: 'M1 1', color: '#00FF00' }]

    await presenter.trigger('annotation:clear', { slideIndex: 0 })

    expect(room.annotations['0']).toHaveLength(0)
    expect(room.annotations['1']).toHaveLength(1) // Other slides untouched
    expect(io.emitted.some(e => e.event === 'annotation:cleared')).toBe(true)
  })

  it('viewer cannot emit annotation:add', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)

    const presenter = io.connect('presenter-1')
    await presenter.trigger('join-room', {
      roomId: 'ROOM12',
      role: 'presenter',
      presenterToken,
    })

    const viewer = io.connect('viewer-1')
    await viewer.trigger('join-room', { roomId: 'ROOM12', role: 'viewer' })

    // Viewer tries to add annotation — should NOT persist
    await viewer.trigger('annotation:add', {
      slideIndex: 0,
      annotation: { d: 'M0 0', color: '#FF0000', strokeWidth: 3 },
    })

    const room = liveRooms.getRoomState('ROOM12')
    expect(room.annotations['0'] || []).toHaveLength(0)
  })

  it('controller can emit annotation:add', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)

    const presenter = io.connect('presenter-1')
    await presenter.trigger('join-room', {
      roomId: 'ROOM12',
      role: 'presenter',
      presenterToken,
    })

    const controller = io.connect('controller-1')
    await controller.trigger('join-room', { roomId: 'ROOM12', role: 'controller' })

    await controller.trigger('annotation:add', {
      slideIndex: 0,
      annotation: { d: 'M5 5 L15 15', color: '#0000FF', strokeWidth: 2 },
    })

    const room = liveRooms.getRoomState('ROOM12')
    expect(room.annotations['0']).toHaveLength(1)
    expect(room.annotations['0'][0].d).toBe('M5 5 L15 15')
  })

  it('old annotation event handler is removed', () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenter = io.connect('presenter-1')
    // If the old handler existed, triggering 'annotation' would call it.
    // After removal, 'annotation' should not be a registered handler.
    expect(presenter.handlers['annotation']).toBeUndefined()
  })

  it('scopes annotations:sync to the target slide on navigate (I-R4.1)', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)

    const presenter = io.connect('presenter-1')
    await presenter.trigger('join-room', {
      roomId: 'ROOM12',
      role: 'presenter',
      presenterToken,
    })

    // Draw on slide 0 and slide 1
    await presenter.trigger('annotation:add', {
      slideIndex: 0,
      annotation: { d: 'M0 0', color: '#FF0000', strokeWidth: 3 },
    })
    await presenter.trigger('annotation:add', {
      slideIndex: 1,
      annotation: { d: 'M1 1', color: '#00FF00', strokeWidth: 3 },
    })

    // Navigate to slide 1 → server broadcasts a slide-scoped annotations:sync
    await presenter.trigger('navigate', { slideIndex: 1, verticalIndex: 0, fragmentIndex: 0 })
    const toSlide1 = io.broadcasts.filter((b) => b.event === 'annotations:sync')
    expect(toSlide1.length).toBeGreaterThan(0)
    const slide1Payload = toSlide1[toSlide1.length - 1].payload
    expect(slide1Payload.slideIndex).toBe(1)
    // Only slide-1 strokes — no slide-0 bleed
    expect(slide1Payload.annotations).toHaveLength(1)
    expect(slide1Payload.annotations[0].d).toBe('M1 1')

    // Navigate back to slide 0 → slide-0 strokes restored
    await presenter.trigger('navigate', { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 })
    const toSlide0 = io.broadcasts.filter((b) => b.event === 'annotations:sync')
    const slide0Payload = toSlide0[toSlide0.length - 1].payload
    expect(slide0Payload.slideIndex).toBe(0)
    expect(slide0Payload.annotations).toHaveLength(1)
    expect(slide0Payload.annotations[0].d).toBe('M0 0')
  })

  it('rejects presenter takeover when token is missing or invalid', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM56', presenterToken)

    const attacker = io.connect('attacker-1')
    await attacker.trigger('join-room', {
      roomId: 'ROOM56',
      role: 'presenter',
      presentationId: 'live-deck',
    })
    expect(attacker.emitted).toContainEqual(
      expect.objectContaining({
        event: 'join-error',
        payload: expect.objectContaining({ reason: 'invalid-presenter-token' }),
      })
    )
  })

  describe('timer events (Phase 2)', () => {
    it('game-timer-start sets timer and broadcasts timer:sync', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      await presenter.trigger('game-timer-start', { elementId: 'game-1', duration: 30 })

      const room = liveRooms.getRoomState('timer-room')
      expect(room.timers['game-1']).toBeDefined()
      expect(room.timers['game-1'].running).toBe(true)
      expect(room.timers['game-1'].duration).toBe(30)
      expect(io.emitted.some(e => e.event === 'timer:sync')).toBe(true)
    })

    it('game-timer-start rejects invalid duration (< 1 or > 7200)', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      await presenter.trigger('game-timer-start', { elementId: 'game-1', duration: -5 })
      expect(liveRooms.getRoomState('timer-room').timers['game-1']).toBeUndefined()

      await presenter.trigger('game-timer-start', { elementId: 'game-2', duration: 99999 })
      expect(liveRooms.getRoomState('timer-room').timers['game-2']).toBeUndefined()
    })

    it('game-timer-start rejects invalid elementId format', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      await presenter.trigger('game-timer-start', { elementId: 'game/with/slashes', duration: 30 })
      expect(liveRooms.getRoomState('timer-room').timers['game/with/slashes']).toBeUndefined()
    })

    it('game-timer-adjust rejects delta > 3600', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      await presenter.trigger('game-timer-start', { elementId: 'game-1', duration: 30 })
      const room = liveRooms.getRoomState('timer-room')
      expect(room.timers['game-1'].duration).toBe(30)

      await presenter.trigger('game-timer-adjust', { elementId: 'game-1', delta: 9999 })
      // Should be unchanged since delta > 3600
      expect(room.timers['game-1'].duration).toBe(30)
    })

    it('game-timer-pause pauses timer and broadcasts', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      await presenter.trigger('game-timer-start', { elementId: 'game-1', duration: 30 })
      await presenter.trigger('game-timer-pause', { elementId: 'game-1' })

      const room = liveRooms.getRoomState('timer-room')
      expect(room.timers['game-1'].running).toBe(false)
      expect(room.timers['game-1'].pausedRemaining).not.toBeNull()
      expect(io.emitted.some(e => e.event === 'timer:sync')).toBe(true)
    })

    it('game-timer-resume resumes paused timer and broadcasts', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      await presenter.trigger('game-timer-start', { elementId: 'game-1', duration: 30 })
      await presenter.trigger('game-timer-pause', { elementId: 'game-1' })
      io.emitted = [] // clear broadcasts from pause
      await presenter.trigger('game-timer-resume', { elementId: 'game-1' })

      const room = liveRooms.getRoomState('timer-room')
      expect(room.timers['game-1'].running).toBe(true)
      expect(io.emitted.some(e => e.event === 'timer:sync')).toBe(true)
    })

    it('game-timer-stop removes timer and broadcasts', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      await presenter.trigger('game-timer-start', { elementId: 'game-1', duration: 30 })
      await presenter.trigger('game-timer-stop', { elementId: 'game-1' })

      const room = liveRooms.getRoomState('timer-room')
      expect(room.timers['game-1']).toBeUndefined()
      expect(io.emitted.some(e => e.event === 'timer:sync')).toBe(true)
    })

    it('viewer cannot control timer — game-timer-start rejected', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      const viewer = io.connect('viewer-timer')
      await viewer.trigger('join-room', { roomId: 'timer-room', role: 'viewer' })

      await viewer.trigger('game-timer-start', { elementId: 'game-1', duration: 30 })

      const room = liveRooms.getRoomState('timer-room')
      expect(room.timers['game-1']).toBeUndefined()
    })

    it('viewer receives timer:sync on join-room when timer is already running', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      await presenter.trigger('game-timer-start', { elementId: 'game-1', duration: 30 })

      const viewer = io.connect('viewer-timer')
      await viewer.trigger('join-room', { roomId: 'timer-room', role: 'viewer' })

      const timerSyncEvents = viewer.emitted.filter(e => e.event === 'timer:sync')
      expect(timerSyncEvents.length).toBeGreaterThan(0)
      expect(timerSyncEvents[0].payload.elementId).toBe('game-1')
      expect(timerSyncEvents[0].payload.duration).toBe(30)
    })

    it('controller can control timer — game-timer-start accepted', async () => {
      const io = new FakeIO()
      setupSocketHandlers(io, { liveRoomsService: liveRooms })
      const presenterToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('timer-room', presenterToken)

      const presenter = io.connect('presenter-timer')
      await presenter.trigger('join-room', {
        roomId: 'timer-room',
        role: 'presenter',
        presenterToken,
      })

      const controller = io.connect('controller-timer')
      await controller.trigger('join-room', { roomId: 'timer-room', role: 'controller' })

      await controller.trigger('game-timer-start', { elementId: 'game-1', duration: 30 })

      const room = liveRooms.getRoomState('timer-room')
      expect(room.timers['game-1']).toBeDefined()
      expect(room.timers['game-1'].running).toBe(true)
    })
  })
})
