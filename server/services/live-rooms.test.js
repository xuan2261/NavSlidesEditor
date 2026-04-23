import { describe, it, expect, beforeEach } from 'vitest'
import liveRooms from './live-rooms.js'

describe('live-rooms service', () => {
  beforeEach(() => {
    liveRooms._resetRooms() // Internal method to clear state between tests
  })

  it('should generate a 6-character room code', () => {
    const code = liveRooms.generateRoomCode()
    expect(typeof code).toBe('string')
    expect(code.length).toBe(6)
  })

  it('should allow presenter to join and initialize room state', () => {
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter')
    const state = liveRooms.getRoomState('ROOM12')
    expect(state.presenterId).toBe('socket-1')
    expect(state.state.slideIndex).toBe(0)
    expect(state.state.verticalIndex).toBe(0)
    expect(state.state.fragmentIndex).toBe(0)
  })

  it('should allow viewer to join and get current state', () => {
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter')
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
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter')
    liveRooms.joinRoom('ROOM12', 'socket-2', 'controller')

    const state = liveRooms.getRoomState('ROOM12')
    expect(state.presenterId).toBe('socket-1')
    expect(state.controllers).toContain('socket-2')
    expect(state.viewers).not.toContain('socket-2')
    expect(liveRooms.getViewerCount('ROOM12')).toBe(0)
    expect(liveRooms.canControlRoom('ROOM12', 'socket-2')).toBe(true)
  })

  it('should handle presenter updates only if requested by presenter', () => {
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter')

    const success = liveRooms.updateRoomState('ROOM12', 'socket-1', { slideIndex: 1 })
    expect(success).toBe(true)
    expect(liveRooms.getRoomState('ROOM12').state.slideIndex).toBe(1)

    // Viewer trying to update the room state
    const failure = liveRooms.updateRoomState('ROOM12', 'socket-fake', { slideIndex: 2 })
    expect(failure).toBe(false)
    expect(liveRooms.getRoomState('ROOM12').state.slideIndex).toBe(1)
  })

  it('should remove socket properly on leave and clean up if presenter leaves', () => {
    liveRooms.joinRoom('ROOM12', 'socket-1', 'presenter')
    liveRooms.joinRoom('ROOM12', 'socket-2', 'viewer')
    liveRooms.joinRoom('ROOM12', 'socket-3', 'controller')

    // Viewer leaves
    liveRooms.leaveRoom('socket-2')
    let state = liveRooms.getRoomState('ROOM12')
    expect(state.viewers.includes('socket-2')).toBe(false)

    liveRooms.leaveRoom('socket-3')
    state = liveRooms.getRoomState('ROOM12')
    expect(state.controllers.includes('socket-3')).toBe(false)

    // Presenter leaves
    liveRooms.leaveRoom('socket-1')
    state = liveRooms.getRoomState('ROOM12')
    expect(state).toBeUndefined() // Room should be deleted
  })
})
