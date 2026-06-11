// Room = presentationId or room code
// Roles: presenter (1 per room), controller (remote/speaker), viewer (many)
const crypto = require('crypto')

const rooms = new Map() // roomId -> { presenterId, presenterTokenHash, controllers, viewers, ... }
const socketToRoom = new Map() // socketId -> roomId
const socketRoles = new Map() // socketId -> role

// Grace window before an orphaned room (presenter gone, no viewers) is reaped.
// Mirrors the game-room TTL pattern. Overridable for fast tests.
const DEFAULT_LIVE_ROOM_TTL_MS = 60 * 1000
let liveRoomTtlMs = DEFAULT_LIVE_ROOM_TTL_MS

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

function createPresenterToken() {
  return crypto.randomBytes(24).toString('base64url')
}

function createRoom(presenterToken, presenterId = null) {
  return {
    presenterId,
    presenterTokenHash: hashToken(presenterToken),
    controllers: [],
    viewers: [],
    presentationId: null,
    state: { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 },
    annotations: {},    // slideIndex -> Annotation[]
    timers: {},         // elementId -> TimerState
    timerTimeouts: {},  // elementId -> setTimeout ID
    cleanupTimer: null, // pending orphaned-room reap handle
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.randomBytes(6)
  return Array.from(bytes, (value) => chars[value % chars.length]).join('')
}

function computeTimerRemaining(timer) {
  if (!timer.running || timer.endedAt === null) {
    return timer.pausedRemaining ?? timer.duration
  }
  return Math.max(0, Math.ceil((timer.endedAt - Date.now()) / 1000))
}

function isValidPresenterToken(room, presenterToken) {
  if (!room || !presenterToken) return false
  return room.presenterTokenHash === hashToken(presenterToken)
}

// Pre-register a room (before presenter connects via Socket.IO)
function registerRoom(roomId, presenterToken) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(presenterToken))
  }
}

function joinRoom(roomId, socketId, role, options = {}) {
  const { presenterToken } = options
  const room = rooms.get(roomId)

  if (role === 'presenter') {
    if (!room) {
      return { ok: false, error: 'room-not-found' }
    }
    if (!isValidPresenterToken(room, presenterToken)) {
      return { ok: false, error: 'invalid-presenter-token' }
    }
    room.presenterId = socketId
  } else if (role === 'controller') {
    if (!room) {
      return { ok: false, error: 'room-not-found' }
    }
    if (!room.controllers.includes(socketId)) {
      room.controllers.push(socketId)
    }
  } else {
    // Viewer — allow joining pre-registered rooms even without presenter
    if (!room) return { ok: false, error: 'room-not-found' }
    if (!room.viewers.includes(socketId)) {
      room.viewers.push(socketId)
    }
  }
  // Any (re)join inside the grace window cancels a pending orphaned-room reap.
  cancelRoomCleanup(room)
  socketToRoom.set(socketId, roomId)
  socketRoles.set(socketId, role)
  return { ok: true }
}

function leaveRoom(socketId) {
  const roomId = socketToRoom.get(socketId)
  if (!roomId) return null

  socketToRoom.delete(socketId)
  const role = socketRoles.get(socketId)
  socketRoles.delete(socketId)
  const room = rooms.get(roomId)
  if (!room) return null

  if (room.presenterId === socketId) {
    room.presenterId = null  // Keep room alive; annotations survive presenter disconnect
    // Clear orphaned timer timeouts — they were scheduled for the disconnected presenter.
    // When the presenter reconnects, new timers can be created from scratch.
    if (room.timerTimeouts) {
      for (const id of Object.values(room.timerTimeouts)) {
        clearTimeout(id)
      }
      room.timerTimeouts = {}
    }
    maybeScheduleRoomCleanup(roomId, room)
    return { roomId, role: 'presenter' }
  }

  room.viewers = room.viewers.filter((id) => id !== socketId)
  room.controllers = room.controllers.filter((id) => id !== socketId)
  maybeScheduleRoomCleanup(roomId, room)
  return { roomId, role: role || 'viewer' }
}

// Arm a grace-window reap when a room is orphaned (no presenter AND no viewers).
// A (re)join within the window cancels it via cancelRoomCleanup. In-memory only —
// annotations are NOT flushed to storage on cleanup.
function maybeScheduleRoomCleanup(roomId, room) {
  if (!room) return
  if (room.presenterId || room.viewers.length > 0) return
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupTimer = setTimeout(() => removeRoom(roomId), liveRoomTtlMs)
}

function cancelRoomCleanup(room) {
  if (room?.cleanupTimer) {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
  }
}

function getRoomState(roomId) {
  return rooms.get(roomId)
}

function removeRoom(roomId) {
  const room = rooms.get(roomId)
  if (!room) return false
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  for (const timeoutId of Object.values(room.timerTimeouts || {})) {
    clearTimeout(timeoutId)
  }
  rooms.delete(roomId)
  for (const [socketId, mappedRoomId] of socketToRoom.entries()) {
    if (mappedRoomId === roomId) {
      socketToRoom.delete(socketId)
      socketRoles.delete(socketId)
    }
  }
  return true
}

function getRoomForSocket(socketId) {
  return socketToRoom.get(socketId)
}

function updateRoomState(roomId, socketId, newState) {
  const room = rooms.get(roomId)
  if (!room || room.presenterId !== socketId) return false
  room.state = { ...room.state, ...newState }
  return true
}

function canControlRoom(roomId, socketId) {
  const room = rooms.get(roomId)
  return !!room && (room.presenterId === socketId || room.controllers.includes(socketId))
}

function getViewerCount(roomId) {
  return rooms.get(roomId)?.viewers.length || 0
}

function _resetRooms() {
  for (const room of rooms.values()) {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
    for (const id of Object.values(room.timerTimeouts || {})) clearTimeout(id)
  }
  rooms.clear()
  socketToRoom.clear()
  socketRoles.clear()
  liveRoomTtlMs = DEFAULT_LIVE_ROOM_TTL_MS
}

// Test seam: shrink the orphaned-room grace window so cleanup tests run fast.
function _setLiveRoomTtl(ms) {
  liveRoomTtlMs = ms
}

module.exports = {
  createPresenterToken,
  generateRoomCode,
  registerRoom,
  joinRoom,
  leaveRoom,
  getRoomState,
  removeRoom,
  getRoomForSocket,
  updateRoomState,
  canControlRoom,
  getViewerCount,
  isValidPresenterToken,
  _resetRooms,
  _setLiveRoomTtl,
  computeTimerRemaining,
}
