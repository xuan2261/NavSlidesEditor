import { describe, it, expect, beforeEach } from 'vitest'
import liveRooms from './live-rooms.js'

describe('live-rooms service', () => {
  let presenterToken

  beforeEach(() => {
    liveRooms._resetRooms() // Internal method to clear state between tests
    presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom('ROOM12', presenterToken)
  })

  it('should generate a 6-character room code', () => {
    const code = liveRooms.generateRoomCode()
    expect(typeof code).toBe('string')
    expect(code.length).toBe(6)
  })

  it('should allow presenter to join and initialize room state', () => {
    const joined = liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter', { presenterToken })
    expect(joined.ok).toBe(true)
    const state = liveRooms.getRoomState('ROOM12')
    expect(state.presenterId).toBe('socket-1')
    expect(state.state.slideIndex).toBe(0)
    expect(state.state.verticalIndex).toBe(0)
    expect(state.state.fragmentIndex).toBe(0)
  })

  it('should allow viewer to join and get current state', () => {
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter', { presenterToken })
    liveRooms.updateRoomState('ROOM12', 'socket-1', {
      slideIndex: 2,
      verticalIndex: 1,
      fragmentIndex: 1,
    })

    // Viewer joins, we can get state
    liveRooms.joinRoom('ROOM12', 'socket-2', 'viewer')
    const state = liveRooms.getRoomState('ROOM12')
    expect(state.state.slideIndex).toBe(2)
    expect(state.state.verticalIndex).toBe(1)
    expect(state.state.fragmentIndex).toBe(1)
    expect(state.viewers.includes('socket-2')).toBe(true)
  })

  it('should allow controller to join without taking presenter ownership', () => {
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter', { presenterToken })
    liveRooms.joinRoom('ROOM12', 'socket-2', 'controller')

    const state = liveRooms.getRoomState('ROOM12')
    expect(state.presenterId).toBe('socket-1')
    expect(state.controllers).toContain('socket-2')
    expect(state.viewers).not.toContain('socket-2')
    expect(liveRooms.getViewerCount('ROOM12')).toBe(0)
    expect(liveRooms.canControlRoom('ROOM12', 'socket-2')).toBe(true)
  })

  it('should handle presenter updates only if requested by presenter', () => {
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter', { presenterToken })

    const success = liveRooms.updateRoomState('ROOM12', 'socket-1', { slideIndex: 1 })
    expect(success).toBe(true)
    expect(liveRooms.getRoomState('ROOM12').state.slideIndex).toBe(1)

    // Viewer trying to update the room state
    const failure = liveRooms.updateRoomState('ROOM12', 'socket-fake', { slideIndex: 2 })
    expect(failure).toBe(false)
    expect(liveRooms.getRoomState('ROOM12').state.slideIndex).toBe(1)
  })

  it('should remove socket properly on leave and keep room alive if presenter leaves', () => {
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter', { presenterToken })
    liveRooms.joinRoom('ROOM12', 'socket-2', 'viewer')
    liveRooms.joinRoom('ROOM12', 'socket-3', 'controller')

    liveRooms.leaveRoom('socket-2')
    let state = liveRooms.getRoomState('ROOM12')
    expect(state.viewers.includes('socket-2')).toBe(false)

    liveRooms.leaveRoom('socket-3')
    state = liveRooms.getRoomState('ROOM12')
    expect(state.controllers.includes('socket-3')).toBe(false)

    // Presenter leaves — room stays alive with presenterId = null
    liveRooms.leaveRoom('socket-1')
    state = liveRooms.getRoomState('ROOM12')
    expect(state).not.toBeNull()
    expect(state.presenterId).toBeNull()
  })

  it('rejects presenter join without valid presenter token', () => {
    const withoutToken = liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter')
    expect(withoutToken).toEqual({ ok: false, error: 'invalid-presenter-token' })

    const wrongToken = liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter', {
      presenterToken: 'bad-token',
    })
    expect(wrongToken).toEqual({ ok: false, error: 'invalid-presenter-token' })
  })

  it('should initialize annotations, timers, and timerTimeouts fields on room creation', () => {
    const state = liveRooms.getRoomState('ROOM12')
    expect(state.annotations).toEqual({})
    expect(state.timers).toEqual({})
    expect(state.timerTimeouts).toEqual({})
  })

  it('removes room state and socket mappings when room is ended', () => {
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter', { presenterToken })
    liveRooms.joinRoom('ROOM12', 'socket-2', 'viewer')

    expect(liveRooms.removeRoom('ROOM12')).toBe(true)
    expect(liveRooms.getRoomState('ROOM12')).toBeUndefined()
    expect(liveRooms.getRoomForSocket('socket-1')).toBeUndefined()
    expect(liveRooms.getRoomForSocket('socket-2')).toBeUndefined()
    expect(liveRooms.removeRoom('ROOM12')).toBe(false)
  })

  it('should compute timer remaining correctly', () => {
    // Timer not started — returns duration
    expect(liveRooms.computeTimerRemaining({ running: false, duration: 60, pausedRemaining: null, endedAt: null })).toBe(60)
    // Timer paused — returns pausedRemaining
    expect(liveRooms.computeTimerRemaining({ running: false, duration: 60, pausedRemaining: 45, endedAt: null })).toBe(45)
    // Timer running — returns elapsed remaining
    const timer = { running: true, duration: 60, pausedRemaining: null, endedAt: Date.now() + 30000 }
    const remaining = liveRooms.computeTimerRemaining(timer)
    expect(remaining).toBeGreaterThanOrEqual(29)
    expect(remaining).toBeLessThanOrEqual(31)
    // endedAt in the past — returns 0
    expect(liveRooms.computeTimerRemaining({ running: true, duration: 60, pausedRemaining: null, endedAt: Date.now() - 5000 })).toBe(0)
  })
})
