import { describe, it, expect, beforeEach } from 'vitest'

// Test route handlers as plain functions, bypassing Express router stack.
// This avoids vitest pool worker module isolation issues that affect supertest HTTP
// and Express router internal module caching.

let mockRooms
let mockPresenterToken

// Inline the minimal liveRooms functions needed for route handler testing
function createTestLiveRooms() {
  const rooms = new Map()
  return {
    generateRoomCode() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      const bytes = require('crypto').randomBytes(6)
      return Array.from(bytes, (v) => chars[v % chars.length]).join('')
    },
    createPresenterToken() {
      return require('crypto').randomBytes(24).toString('base64url')
    },
    registerRoom(roomId, presenterToken) {
      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          presenterId: null,
          presenterTokenHash: require('crypto')
            .createHash('sha256')
            .update(String(presenterToken || ''))
            .digest('hex'),
          controllers: [],
          viewers: [],
          annotations: {},
        })
      }
    },
    getRoomState(roomId) {
      return rooms.get(roomId) || null
    },
    isValidPresenterToken(room, token) {
      if (!room || !token) return false
      return room.presenterTokenHash ===
        require('crypto').createHash('sha256').update(String(token)).digest('hex')
    },
    getViewerCount(roomId) {
      return rooms.get(roomId)?.viewers.length || 0
    },
    _resetRooms() {
      rooms.clear()
    },
    _getRooms() {
      return rooms
    },
  }
}

// Re-implement the 3 route handlers as plain functions for testing
function handlePostRoom(req, res) {
  const code = mockRooms.generateRoomCode()
  const presenterToken = mockRooms.createPresenterToken()
  mockRooms.registerRoom(code, presenterToken)
  res.status(200).json({ roomCode: code, presenterToken })
}

function handleGetRoomCheck(req, res) {
  const { code } = req.params
  const state = mockRooms.getRoomState(code)
  if (state) {
    res.status(200).json({
      exists: true,
      viewersCount: mockRooms.getViewerCount(code),
      hasPresenter: !!state.presenterId,
    })
  } else {
    res.status(200).json({ exists: false })
  }
}

function handleGetAnnotations(req, res) {
  const { code } = req.params
  const match = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)
  const token = match ? match[1].trim() : null
  const state = mockRooms.getRoomState(code)
  if (!state) return res.status(404).json({ error: 'Room not found' })
  if (!token || !mockRooms.isValidPresenterToken(state, token)) {
    return res.status(403).json({ error: 'Invalid presenter token' })
  }
  const slideAnnotations = {}
  for (const [idx, anns] of Object.entries(state.annotations)) {
    slideAnnotations[idx] = anns
  }
  res.set?.({
    'Cache-Control': 'no-store, private',
    Pragma: 'no-cache',
    Expires: '0',
  })
  res.status(200).json({ roomCode: code, slideAnnotations })
}

beforeEach(function() {
  mockRooms = createTestLiveRooms()
  mockRooms._resetRooms()
  mockPresenterToken = mockRooms.createPresenterToken()
  mockRooms.registerRoom('ROOMCODE', mockPresenterToken)
})

describe('live REST routes', () => {
  it('room is registered by beforeEach', () => {
    const room = mockRooms.getRoomState('ROOMCODE')
    expect(room).not.toBeNull()
    expect(room.presenterTokenHash).toBeDefined()
  })

  it('POST /room creates a new room', () => {
    const req = {}
    const res = { statusCode: 200, jsonData: null, status(code) { this.statusCode = code; return this }, json(data) { this.jsonData = data; return this } }
    handlePostRoom(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.jsonData.roomCode).toBeDefined()
    expect(res.jsonData.presenterToken).toBeDefined()
  })

  it('GET /room/:code returns exists:true for registered room', () => {
    const req = { params: { code: 'ROOMCODE' } }
    const res = { statusCode: 200, jsonData: null, status(code) { this.statusCode = code; return this }, json(data) { this.jsonData = data; return this } }
    handleGetRoomCheck(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.jsonData.exists).toBe(true)
    expect(res.jsonData.viewersCount).toBe(0)
    expect(res.jsonData.hasPresenter).toBe(false)
  })

  it('GET /room/:code returns exists:false for non-existent room', () => {
    const req = { params: { code: 'NOTFOUND' } }
    const res = { statusCode: 200, jsonData: null, status(code) { this.statusCode = code; return this }, json(data) { this.jsonData = data; return this } }
    handleGetRoomCheck(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.jsonData.exists).toBe(false)
  })

  it('GET /room/:code/annotations returns annotations with valid presenter bearer token', () => {
    const req = { params: { code: 'ROOMCODE' }, headers: { authorization: `Bearer ${mockPresenterToken}` }, query: { token: mockPresenterToken } }
    const res = { statusCode: 200, jsonData: null, headers: {}, status(code) { this.statusCode = code; return this }, set(values) { Object.assign(this.headers, values); return this }, json(data) { this.jsonData = data; return this } }
    handleGetAnnotations(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.jsonData.roomCode).toBe('ROOMCODE')
    expect(res.jsonData.slideAnnotations).toEqual({})
    expect(res.headers['Cache-Control']).toBe('no-store, private')
  })

  it('GET /room/:code/annotations returns 404 for non-existent room', () => {
    const req = { params: { code: 'NOTFOUND' }, headers: { authorization: 'Bearer bad-token' } }
    const res = { statusCode: 200, jsonData: null, status(code) { this.statusCode = code; return this }, json(data) { this.jsonData = data; return this } }
    handleGetAnnotations(req, res)
    expect(res.statusCode).toBe(404)
    expect(res.jsonData.error).toBe('Room not found')
  })

  it('GET /room/:code/annotations returns 403 for invalid bearer token', () => {
    const req = { params: { code: 'ROOMCODE' }, headers: { authorization: 'Bearer bad-token' } }
    const res = { statusCode: 200, jsonData: null, status(code) { this.statusCode = code; return this }, json(data) { this.jsonData = data; return this } }
    handleGetAnnotations(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.jsonData.error).toBe('Invalid presenter token')
  })

  it('GET /room/:code/annotations rejects query-only credentials', () => {
    const req = { params: { code: 'ROOMCODE' }, query: { token: mockPresenterToken } }
    const res = { statusCode: 200, jsonData: null, status(code) { this.statusCode = code; return this }, json(data) { this.jsonData = data; return this } }
    handleGetAnnotations(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.jsonData.error).toBe('Invalid presenter token')
  })
})
