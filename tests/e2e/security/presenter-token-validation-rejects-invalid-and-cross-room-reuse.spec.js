import { test, expect } from '@playwright/test'
import { io } from 'socket.io-client'
import {
  apiCreatePresentation,
  apiDeletePresentation,
} from '../fixtures/test-fixtures.js'

function serverBaseUrl() {
  return `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT || '3202'}`
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(serverBaseUrl(), {
      path: '/ws', transports: ['websocket'], forceNew: true, reconnection: false,
    })
    const t = setTimeout(() => { socket.close(); reject(new Error('socket connect timeout')) }, 8000)
    socket.once('connect', () => { clearTimeout(t); resolve(socket) })
    socket.once('connect_error', (err) => { clearTimeout(t); socket.close(); reject(err) })
  })
}

function emitJoinRoom(socket, payload) {
  return new Promise((resolve) => {
    let resolved = false
    const onData = () => { if (!resolved) { resolved = true; resolve({ kind: 'data' }) } }
    const onJoinErr = (err) => { if (!resolved) { resolved = true; resolve({ kind: 'join-error', err }) } }
    const onRoomMissing = () => { if (!resolved) { resolved = true; resolve({ kind: 'room-not-found' }) } }
    socket.once('presentation-data', onData)
    socket.once('join-error', onJoinErr)
    socket.once('room-not-found', onRoomMissing)
    socket.emit('join-room', payload)
    setTimeout(() => { if (!resolved) { resolved = true; resolve({ kind: 'timeout' }) } }, 4000)
  })
}

test.describe('Security: presenter token validation rejects invalid and cross-room reuse', () => {
  let presId, roomCode, validToken

  test.beforeEach(async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Token Security E2E')
    presId = pres.id
    const r = await request.post('/api/live/room')
    const room = await r.json()
    roomCode = room.roomCode
    validToken = room.presenterToken
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('[cap:live.presenter-authz tier:deep] joining as presenter with wrong token emits join-error invalid-presenter-token', async () => {
    const socket = await connectSocket()
    try {
      const result = await emitJoinRoom(socket, {
        roomId: roomCode,
        role: 'presenter',
        presentationId: presId,
        presenterToken: 'tampered-token-xyz',
      })
      expect(result.kind).toBe('join-error')
      expect(result.err?.reason).toBe('invalid-presenter-token')
    } finally {
      socket.disconnect()
    }
  })

  test('joining as presenter without token emits join-error', async () => {
    const socket = await connectSocket()
    try {
      const result = await emitJoinRoom(socket, {
        roomId: roomCode, role: 'presenter', presentationId: presId,
      })
      expect(result.kind).toBe('join-error')
    } finally {
      socket.disconnect()
    }
  })

  test('joining unknown room as presenter with any token emits room-not-found', async () => {
    const socket = await connectSocket()
    try {
      const result = await emitJoinRoom(socket, {
        roomId: 'NOSUCHROOM', role: 'presenter', presentationId: presId, presenterToken: validToken,
      })
      expect(['room-not-found', 'join-error']).toContain(result.kind)
    } finally {
      socket.disconnect()
    }
  })

  test('[cap:live.presenter-authz tier:deep] valid token from one room cannot join a different room as presenter', async ({ request }) => {
    const r2 = await request.post('/api/live/room')
    const otherRoom = await r2.json()

    const socket = await connectSocket()
    try {
      const result = await emitJoinRoom(socket, {
        roomId: otherRoom.roomCode,
        role: 'presenter',
        presentationId: presId,
        presenterToken: validToken,
      })
      expect(result.kind).toBe('join-error')
      expect(result.err?.reason).toBe('invalid-presenter-token')
    } finally {
      socket.disconnect()
    }
  })

  test('valid presenter token allows join and emits presentation-data', async () => {
    const socket = await connectSocket()
    try {
      const result = await emitJoinRoom(socket, {
        roomId: roomCode,
        role: 'presenter',
        presentationId: presId,
        presenterToken: validToken,
      })
      expect(result.kind).toBe('data')
    } finally {
      socket.disconnect()
    }
  })

  test('viewer can join room without presenter token (no token gating for viewer role)', async () => {
    const socket = await connectSocket()
    try {
      const joinedOrNotFound = await emitJoinRoom(socket, {
        roomId: roomCode, role: 'viewer',
      })
      expect(['data', 'timeout']).toContain(joinedOrNotFound.kind)
    } finally {
      socket.disconnect()
    }
  })
})
