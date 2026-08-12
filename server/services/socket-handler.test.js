import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('ignores malformed payloads without throwing from socket dispatch', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const socket = io.connect('malformed-client')

    await expect(socket.trigger('navigate')).resolves.toBeUndefined()
    await expect(socket.trigger('control-navigate')).resolves.toBeUndefined()
    await expect(socket.trigger('game-timer-start')).resolves.toBeUndefined()
    await expect(socket.trigger('navigate', null)).resolves.toBeUndefined()
    await expect(socket.trigger('control-navigate', null)).resolves.toBeUndefined()
    await expect(socket.trigger('game-timer-start', null)).resolves.toBeUndefined()
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
    expect(viewer.emitted).toContainEqual({
      event: 'presenter-status',
      payload: { hasPresenter: true, presenterConnected: true },
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

  it('rejects a cross-room join without losing the original live membership', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const firstToken = liveRooms.createPresenterToken()
    const secondToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM-A', firstToken)
    liveRooms.registerRoom('ROOM-B', secondToken)

    const viewer = io.connect('viewer-switch')
    await viewer.trigger('join-room', { roomId: 'ROOM-A', role: 'viewer' })
    await viewer.trigger('join-room', { roomId: 'ROOM-B', role: 'viewer' })

    expect(viewer.emitted).toContainEqual({
      event: 'join-error',
      payload: {
        roomId: 'ROOM-B',
        reason: 'already-joined-room',
        message: 'Socket is already joined to another live room',
      },
    })
    expect(viewer.rooms).toEqual(['ROOM-A'])
    expect(liveRooms.getRoomForSocket('viewer-switch')).toBe('ROOM-A')

    await viewer.trigger('disconnect')
    expect(liveRooms.getRoomForSocket('viewer-switch')).toBeUndefined()
    expect(liveRooms.getRoomState('ROOM-A').viewers).not.toContain('viewer-switch')
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

  it('announces presenter reconnection after a temporary disconnect', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM35', presenterToken)

    const presenter = io.connect('presenter-3')
    await presenter.trigger('join-room', {
      roomId: 'ROOM35',
      role: 'presenter',
      presentationId: 'live-deck',
      presenterToken,
    })
    await presenter.trigger('disconnect')
    io.emitted.length = 0

    const reconnectingPresenter = io.connect('presenter-4')
    await reconnectingPresenter.trigger('join-room', {
      roomId: 'ROOM35',
      role: 'presenter',
      presentationId: 'live-deck',
      presenterToken,
    })

    expect(io.emitted).toContainEqual({
      target: 'ROOM35',
      event: 'presenter-reconnected',
      payload: undefined,
    })
  })

  it('reports presenter absence to late controller joins', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM36', presenterToken)

    const presenter = io.connect('presenter-6')
    await presenter.trigger('join-room', { roomId: 'ROOM36', role: 'presenter', presenterToken })
    await presenter.trigger('disconnect')

    const controller = io.connect('controller-6')
    await controller.trigger('join-room', { roomId: 'ROOM36', role: 'controller' })

    expect(controller.emitted).toContainEqual({
      event: 'presenter-status',
      payload: { hasPresenter: false, presenterConnected: true },
    })
    await controller.trigger('control-navigate', { slideIndex: 1 })
    expect(controller.emitted.filter((item) => item.event === 'presenter-status')).toHaveLength(2)
  })

  it('announces presenter availability to controllers that joined first', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM39', presenterToken)

    const controller = io.connect('controller-39')
    await controller.trigger('join-room', { roomId: 'ROOM39', role: 'controller' })
    expect(controller.emitted).toContainEqual({
      event: 'presenter-status',
      payload: { hasPresenter: false, presenterConnected: false },
    })

    const presenter = io.connect('presenter-39')
    await presenter.trigger('join-room', {
      roomId: 'ROOM39',
      role: 'presenter',
      presenterToken,
    })

    expect(io.broadcasts).toContainEqual({
      from: 'presenter-39',
      room: 'ROOM39',
      event: 'presenter-status',
      payload: { hasPresenter: true, presenterConnected: true },
    })
  })

  it('ignores a stale presenter disconnect after a replacement joins', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, { liveRoomsService: liveRooms })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM37', presenterToken)

    const firstPresenter = io.connect('presenter-7')
    await firstPresenter.trigger('join-room', { roomId: 'ROOM37', role: 'presenter', presenterToken })
    const replacementPresenter = io.connect('presenter-8')
    await replacementPresenter.trigger('join-room', { roomId: 'ROOM37', role: 'presenter', presenterToken })
    io.emitted.length = 0

    await firstPresenter.trigger('disconnect')

    expect(io.emitted).not.toContainEqual({
      target: 'ROOM37',
      event: 'presenter-disconnected',
      payload: undefined,
    })
    expect(liveRooms.getRoomState('ROOM37').presenterId).toBe('presenter-8')
  })

  it('does not let a stale presenter load replace the active deck', async () => {
    const io = new FakeIO()
    let resolveFirstLoad
    const firstLoad = new Promise((resolve) => {
      resolveFirstLoad = resolve
    })
    const deckA = { id: 'deck-a', title: 'Deck A', slides: [{ id: 'a', elements: [] }] }
    const deckB = { id: 'deck-b', title: 'Deck B', slides: [{ id: 'b', elements: [] }] }
    setupSocketHandlers(io, {
      liveRoomsService: liveRooms,
      findPresentationById: async (id) => {
        if (id === 'deck-a') return firstLoad
        if (id === 'deck-b') return deckB
        return null
      },
    })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM40', presenterToken)

    const firstPresenter = io.connect('presenter-a')
    const firstJoin = firstPresenter.trigger('join-room', {
      roomId: 'ROOM40',
      role: 'presenter',
      presentationId: 'deck-a',
      presenterToken,
    })
    const replacementPresenter = io.connect('presenter-b')
    await replacementPresenter.trigger('join-room', {
      roomId: 'ROOM40',
      role: 'presenter',
      presentationId: 'deck-b',
      presenterToken,
    })

    resolveFirstLoad(deckA)
    await firstJoin

    expect(liveRooms.getRoomState('ROOM40').presenterId).toBe('presenter-b')
    expect(liveRooms.getRoomState('ROOM40').presentationId).toBe('deck-b')
    expect(io.emitted.filter((event) => event.event === 'presentation-meta')).toHaveLength(1)
  })

  it('drops a stale viewer payload after the presenter switches decks', async () => {
    const io = new FakeIO()
    let resolveDeckA
    const deckALoad = new Promise((resolve) => { resolveDeckA = resolve })
    const deckA = { id: 'deck-a', title: 'Deck A', slides: [{ id: 'a', elements: [] }] }
    const deckB = { id: 'deck-b', title: 'Deck B', slides: [{ id: 'b', elements: [] }] }
    setupSocketHandlers(io, {
      liveRoomsService: liveRooms,
      findPresentationById: async (id) => id === 'deck-a' ? deckALoad : deckB,
    })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM41', presenterToken)
    const presenter = io.connect('presenter-41')
    await presenter.trigger('join-room', { roomId: 'ROOM41', role: 'presenter', presenterToken })
    liveRooms.getRoomState('ROOM41').presentationId = 'deck-a'

    const viewer = io.connect('viewer-41')
    const viewerJoin = viewer.trigger('join-room', { roomId: 'ROOM41', role: 'viewer' })
    const replacement = io.connect('presenter-42')
    await replacement.trigger('join-room', {
      roomId: 'ROOM41',
      role: 'presenter',
      presentationId: 'deck-b',
      presenterToken,
    })

    resolveDeckA(deckA)
    await viewerJoin

    const viewerPayloads = viewer.emitted.filter((event) => event.event === 'presentation-data')
    expect(viewerPayloads).toHaveLength(1)
    expect(viewerPayloads[0].payload).toBeTruthy()
    expect(liveRooms.getRoomState('ROOM41')).toMatchObject({ presentationId: 'deck-b' })
  })

  it('does not expose the previous deck while a replacement presenter load is pending or fails', async () => {
    const io = new FakeIO()
    let resolveDeckB
    const deckBLoad = new Promise((resolve) => { resolveDeckB = resolve })
    const deckA = { id: 'deck-a', title: 'Deck A', slides: [{ id: 'a', elements: [] }] }
    setupSocketHandlers(io, {
      liveRoomsService: liveRooms,
      findPresentationById: async (id) => id === 'deck-b' ? deckBLoad : deckA,
    })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM41B', presenterToken)
    const presenter = io.connect('presenter-41b')
    await presenter.trigger('join-room', {
      roomId: 'ROOM41B', role: 'presenter', presentationId: 'deck-a', presenterToken,
    })

    const replacement = presenter.trigger('join-room', {
      roomId: 'ROOM41B', role: 'presenter', presentationId: 'deck-b', presenterToken,
    })
    expect(liveRooms.getRoomState('ROOM41B').presentationId).toBeNull()

    const viewer = io.connect('viewer-41b')
    await viewer.trigger('join-room', { roomId: 'ROOM41B', role: 'viewer' })
    expect(viewer.emitted.filter((event) => event.event === 'presentation-data')).toHaveLength(0)
    expect(viewer.emitted.filter((event) => event.event === 'presentation-meta')).toHaveLength(0)

    resolveDeckB(null)
    await replacement
    expect(liveRooms.getRoomState('ROOM41B').presentationId).toBeNull()
    expect(liveRooms.getRoomState('ROOM41B').presenterId).toBe('presenter-41b')
  })

  it('fences duplicate presenter loads with a generation, including A-to-B-to-A', async () => {
    const io = new FakeIO()
    let resolveFirstA
    let resolveSecondA
    const firstA = new Promise((resolve) => { resolveFirstA = resolve })
    const secondA = new Promise((resolve) => { resolveSecondA = resolve })
    const deckA = { id: 'deck-a', title: 'Deck A', slides: [{ id: 'a', elements: [] }] }
    const deckB = { id: 'deck-b', title: 'Deck B', slides: [{ id: 'b', elements: [] }] }
    let deckACalls = 0
    setupSocketHandlers(io, {
      liveRoomsService: liveRooms,
      findPresentationById: async (id) => {
        if (id === 'deck-b') return deckB
        deckACalls += 1
        return deckACalls === 1 ? firstA : secondA
      },
    })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM42', presenterToken)
    const presenter = io.connect('presenter-42')

    const firstJoin = presenter.trigger('join-room', {
      roomId: 'ROOM42',
      role: 'presenter',
      presentationId: 'deck-a',
      presenterToken,
    })
    await presenter.trigger('join-room', {
      roomId: 'ROOM42',
      role: 'presenter',
      presentationId: 'deck-b',
      presenterToken,
    })
    const lastJoin = presenter.trigger('join-room', {
      roomId: 'ROOM42',
      role: 'presenter',
      presentationId: 'deck-a',
      presenterToken,
    })

    resolveFirstA(deckA)
    await firstJoin
    expect(io.emitted.filter((event) => event.event === 'presentation-meta')).toHaveLength(1)

    resolveSecondA(deckA)
    await lastJoin

    const metas = io.emitted.filter((event) => event.event === 'presentation-meta')
    expect(metas).toHaveLength(2)
    expect(metas.at(-1).payload.presentationId).toBe('deck-a')
    expect(liveRooms.getRoomState('ROOM42')).toMatchObject({ presentationId: 'deck-a' })
  })

  it('drops a pending payload when the room is removed and recreated', async () => {
    const io = new FakeIO()
    let resolveDeckA
    const deckALoad = new Promise((resolve) => { resolveDeckA = resolve })
    const deckA = { id: 'deck-a', title: 'Deck A', slides: [{ id: 'a', elements: [] }] }
    setupSocketHandlers(io, {
      liveRoomsService: liveRooms,
      findPresentationById: async () => deckALoad,
    })
    const oldToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM43', oldToken)
    const presenter = io.connect('presenter-43')
    await presenter.trigger('join-room', { roomId: 'ROOM43', role: 'presenter', presenterToken: oldToken })
    const oldRoom = liveRooms.getRoomState('ROOM43')
    oldRoom.presentationId = 'deck-a'
    oldRoom.annotations = { '0': [{ id: 'old-annotation' }] }
    oldRoom.timers = {
      timer: { duration: 30, endedAt: null, pausedRemaining: 30, running: false },
    }

    const viewer = io.connect('viewer-43')
    const viewerJoin = viewer.trigger('join-room', { roomId: 'ROOM43', role: 'viewer' })
    liveRooms.removeRoom('ROOM43')
    liveRooms.registerRoom('ROOM43', liveRooms.createPresenterToken())
    const recreatedRoom = liveRooms.getRoomState('ROOM43')
    recreatedRoom.annotations = { '0': [{ id: 'new-annotation' }] }
    recreatedRoom.timers = {
      timer: { duration: 60, endedAt: null, pausedRemaining: 60, running: false },
    }

    resolveDeckA(deckA)
    await viewerJoin

    expect(viewer.emitted.filter((event) => event.event === 'presentation-data')).toHaveLength(0)
    expect(viewer.emitted.filter((event) => event.event === 'presentation-meta')).toHaveLength(0)
    expect(viewer.emitted.filter((event) => event.event === 'annotations:sync')).toHaveLength(0)
    expect(viewer.emitted.filter((event) => event.event === 'timer:sync')).toHaveLength(0)
  })

  it('does not re-arm timers for a stale presenter join after room recreation', async () => {
    vi.useFakeTimers()
    try {
      const io = new FakeIO()
      let resolveOld
      let resolveNew
      const oldLoad = new Promise((resolve) => { resolveOld = resolve })
      const newLoad = new Promise((resolve) => { resolveNew = resolve })
      const oldDeck = { id: 'old-deck', title: 'Old', slides: [{ id: 'old', elements: [] }] }
      const newDeck = { id: 'new-deck', title: 'New', slides: [{ id: 'new', elements: [] }] }
      setupSocketHandlers(io, {
        liveRoomsService: liveRooms,
        findPresentationById: async (id) => id === 'old-deck' ? oldLoad : newLoad,
      })

      const oldToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('ROOM43B', oldToken)
      const presenter = io.connect('presenter-43b')
      const oldJoin = presenter.trigger('join-room', {
        roomId: 'ROOM43B', role: 'presenter', presentationId: 'old-deck', presenterToken: oldToken,
      })

      liveRooms.removeRoom('ROOM43B')
      const newToken = liveRooms.createPresenterToken()
      liveRooms.registerRoom('ROOM43B', newToken)
      const recreatedRoom = liveRooms.getRoomState('ROOM43B')
      recreatedRoom.timers = {
        timer: {
          duration: 30,
          endedAt: Date.now() + 10_000,
          pausedRemaining: 30,
          running: true,
        },
      }
      const newJoin = presenter.trigger('join-room', {
        roomId: 'ROOM43B', role: 'presenter', presentationId: 'new-deck', presenterToken: newToken,
      })

      resolveOld(oldDeck)
      await oldJoin
      expect(Object.keys(recreatedRoom.timerTimeouts)).toHaveLength(0)

      resolveNew(newDeck)
      await newJoin
      expect(Object.keys(recreatedRoom.timerTimeouts)).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('announces reconnect after an initial presentation load failure', async () => {
    const io = new FakeIO()
    setupSocketHandlers(io, {
      liveRoomsService: liveRooms,
      findPresentationById: async () => null,
    })
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM38', presenterToken)

    const presenter = io.connect('presenter-9')
    await presenter.trigger('join-room', {
      roomId: 'ROOM38',
      role: 'presenter',
      presentationId: 'missing-deck',
      presenterToken,
    })
    await presenter.trigger('disconnect')
    io.emitted.length = 0

    const reconnectingPresenter = io.connect('presenter-10')
    await reconnectingPresenter.trigger('join-room', {
      roomId: 'ROOM38',
      presenterToken,
      role: 'presenter',
    })

    expect(io.emitted).toContainEqual({
      target: 'ROOM38',
      event: 'presenter-reconnected',
      payload: undefined,
    })
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

  it('ignores malformed annotation payloads without mutating room state', async () => {
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

    await presenter.trigger('annotation:add', {
      slideIndex: '__proto__',
      annotation: { id: 'invalid-index' },
    })
    await presenter.trigger('annotation:add', {
      slideIndex: 0,
      annotation: null,
    })

    expect(liveRooms.getRoomState('ROOM12').annotations).toEqual({})
    expect(io.emitted.some((event) => event.event === 'annotation:add')).toBe(false)
  })

  it('normalizes non-string annotation IDs so annotations remain removable', async () => {
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

    await presenter.trigger('annotation:add', {
      slideIndex: 0,
      annotation: { id: 42, d: 'M0 0' },
    })

    const room = liveRooms.getRoomState('ROOM12')
    const storedId = room.annotations['0'][0].id
    expect(typeof storedId).toBe('string')
    expect(storedId).not.toBe('42')

    await presenter.trigger('annotation:remove', { slideIndex: 0, annotationId: storedId })

    expect(room.annotations['0']).toHaveLength(0)
  })

  it('keeps annotations for vertical child slides separate from their parent', async () => {
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

    await presenter.trigger('annotation:add', {
      slideIndex: 0,
      verticalIndex: 0,
      annotation: { id: 'root-stroke', d: 'M0 0' },
    })
    await presenter.trigger('annotation:add', {
      slideIndex: 0,
      verticalIndex: 1,
      annotation: { id: 'child-stroke', d: 'M1 1' },
    })

    const room = liveRooms.getRoomState('ROOM12')
    expect(room.annotations['0'].map(({ id }) => id)).toEqual(['root-stroke'])
    expect(room.annotations['0:1'].map(({ id }) => id)).toEqual(['child-stroke'])
    expect(io.emitted).toContainEqual({
      target: 'ROOM12',
      event: 'annotation:add',
      payload: { slideIndex: 0, verticalIndex: 1, annotation: expect.objectContaining({ id: 'child-stroke' }) },
    })
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

  it('broadcasts an explicit global annotation clear', async () => {
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
    room.annotations['0'] = [{ id: 'a1' }]
    room.annotations['1'] = [{ id: 'a2' }]

    await presenter.trigger('annotation:clear', {})

    expect(room.annotations).toEqual({})
    expect(io.emitted).toContainEqual({
      target: 'ROOM12',
      event: 'annotation:cleared',
      payload: { global: true },
    })
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

  it('blocks controller mutations while the presenter is disconnected', async () => {
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

    await presenter.trigger('annotation:add', {
      slideIndex: 0,
      annotation: { id: 'existing', d: 'M0 0' },
    })
    await presenter.trigger('game-timer-start', { elementId: 'timer-1', duration: 30 })
    const room = liveRooms.getRoomState('ROOM12')
    room.timers['paused-timer'] = {
      duration: 20,
      endedAt: null,
      pausedAt: Date.now(),
      pausedRemaining: 10,
      running: false,
    }

    await presenter.trigger('disconnect')
    expect(room.presenterId).toBeNull()
    const emittedBefore = io.emitted.length
    const broadcastsBefore = io.broadcasts.length

    await controller.trigger('laser', { x: 10, y: 20, active: true })
    await controller.trigger('annotation:add', {
      slideIndex: 0,
      annotation: { id: 'blocked-add', d: 'M1 1' },
    })
    await controller.trigger('annotation:remove', { slideIndex: 0, annotationId: 'existing' })
    await controller.trigger('annotation:clear', { slideIndex: 0 })
    await controller.trigger('game-timer-start', { elementId: 'blocked-timer', duration: 30 })
    await controller.trigger('game-timer-pause', { elementId: 'timer-1' })
    await controller.trigger('game-timer-resume', { elementId: 'paused-timer' })
    await controller.trigger('game-timer-adjust', { elementId: 'timer-1', delta: 10 })
    await controller.trigger('game-timer-stop', { elementId: 'timer-1' })

    expect(room.annotations['0']).toEqual([expect.objectContaining({ id: 'existing' })])
    expect(room.timers['timer-1'].running).toBe(true)
    expect(room.timers['paused-timer'].running).toBe(false)
    expect(room.timers['blocked-timer']).toBeUndefined()
    expect(io.emitted).toHaveLength(emittedBefore)
    expect(io.broadcasts).toHaveLength(broadcastsBefore)
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
