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
    expect(io.emitted).toContainEqual({ target: 'ROOM34', event: 'presenter-left', payload: undefined })
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
})
