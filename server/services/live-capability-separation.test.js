import { beforeEach, describe, expect, it } from 'vitest'
import liveRooms from './live-rooms.js'

const roomId = 'CAP123'

describe('live capability separation', () => {
  beforeEach(() => liveRooms._resetRooms())

  it('issues distinct high-entropy capabilities and stores only hashes', () => {
    const capabilities = liveRooms.createLiveCapabilities()
    liveRooms.registerRoom(roomId, capabilities)
    const room = liveRooms.getRoomState(roomId)

    expect(capabilities.presenterToken).toHaveLength(32)
    expect(capabilities.remoteToken).toHaveLength(32)
    expect(capabilities.speakerToken).toHaveLength(32)
    expect(new Set(Object.values(capabilities)).size).toBe(3)
    expect(room.presenterTokenHash).not.toBe(capabilities.presenterToken)
    expect(room.remoteTokenHash).not.toBe(capabilities.remoteToken)
    expect(room.speakerTokenHash).not.toBe(capabilities.speakerToken)
    expect(room.remoteTokenHash).not.toContain(capabilities.remoteToken)
    expect(room.speakerTokenHash).not.toContain(capabilities.speakerToken)
  })

  it('requires the matching capability for privileged roles', () => {
    const capabilities = liveRooms.createLiveCapabilities()
    liveRooms.registerRoom(roomId, capabilities)

    expect(liveRooms.joinRoom(roomId, 'viewer', 'viewer')).toMatchObject({ ok: true })
    expect(liveRooms.joinRoom(roomId, 'remote-no-token', 'remote')).toMatchObject({
      ok: false,
      error: 'invalid-remote-token',
    })
    expect(liveRooms.joinRoom(roomId, 'speaker-wrong-role', 'speaker', {
      capability: capabilities.remoteToken,
    })).toMatchObject({ ok: false, error: 'invalid-speaker-token' })
    expect(liveRooms.joinRoom(roomId, 'remote', 'remote', {
      capability: capabilities.remoteToken,
    })).toMatchObject({ ok: true })
  })

  it('rejects unknown roles before membership is written', () => {
    const capabilities = liveRooms.createLiveCapabilities()
    liveRooms.registerRoom(roomId, capabilities)

    expect(liveRooms.joinRoom(roomId, 'bad-role', 'controller')).toMatchObject({
      ok: false,
      error: 'invalid-role',
    })
    expect(liveRooms.getRoomState(roomId).controllers).toEqual([])
    expect(liveRooms.getRoomForSocket('bad-role')).toBeUndefined()
  })
})
