// Room = presentationId or room code
// Roles: presenter (1 per room), controller (remote/speaker), viewer (many)
const crypto = require('crypto')

const rooms = new Map() // roomId -> { presenterId, presenterTokenHash, controllers, viewers, ... }
const socketToRoom = new Map() // socketId -> roomId
const socketRoles = new Map() // socketId -> role

// Grace window before an orphaned room (presenter gone, no viewers or controllers) is reaped.
// Mirrors the game-room TTL pattern. Overridable for fast tests.
const DEFAULT_LIVE_ROOM_TTL_MS = 60 * 1000
const DEFAULT_PRESENTER_GRACE_MS = 5 * 1000
let liveRoomTtlMs = DEFAULT_LIVE_ROOM_TTL_MS
let presenterGraceMs = DEFAULT_PRESENTER_GRACE_MS

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

function createPresenterToken() {
  return crypto.randomBytes(24).toString('base64url')
}

function createRoom(presenterToken, presenterId = null) {
  return {
    presenterId,
    presenterConnected: false,
    presenterTokenHash: hashToken(presenterToken),
    controllers: [],
    viewers: [],
    presentationId: null,
    presentationGeneration: 0,
    state: { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 },
    annotations: {},    // slideIndex -> Annotation[]
    timers: {},         // elementId -> TimerState
    timerTimeouts: {},  // elementId -> setTimeout ID
    cleanupTimer: null, // pending orphaned-room reap handle
    presenterTerminationTimer: null,
    presenterTerminationHandler: null,
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

function getAnnotationKey(slideIndex, verticalIndex = 0) {
  return Number(verticalIndex) ? `${slideIndex}:${verticalIndex}` : String(slideIndex)
}

function isValidPresenterToken(room, presenterToken) {
  if (!room || !presenterToken) return false
  return room.presenterTokenHash === hashToken(presenterToken)
}

// Pre-register a room (before presenter connects via Socket.IO)
function registerRoom(roomId, presenterToken) {
  if (!rooms.has(roomId)) {
    const room = createRoom(presenterToken)
    rooms.set(roomId, room)
    maybeScheduleRoomCleanup(roomId, room)
  }
}

function joinRoom(roomId, socketId, role, options = {}) {
  const { presenterToken } = options
  const room = rooms.get(roomId)
  const previousRoomId = socketToRoom.get(socketId)
  if (previousRoomId && previousRoomId !== roomId) {
    return { ok: false, error: 'already-joined-room' }
  }

  if (role === 'presenter') {
    if (!room) {
      return { ok: false, error: 'room-not-found' }
    }
    if (!isValidPresenterToken(room, presenterToken)) {
      return { ok: false, error: 'invalid-presenter-token' }
    }
    cancelPresenterTermination(room)
    room.presentationGeneration += 1
    room.presenterId = socketId
    room.presenterConnected = true
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
  // Joins cancel only orphan cleanup. Presenter joins also cancel terminal
  // disconnect handling; viewer/controller joins cannot extend presenter grace.
  cancelRoomCleanup(room)
  socketToRoom.set(socketId, roomId)
  socketRoles.set(socketId, role)
  return { ok: true }
}

function leaveRoom(socketId, options = {}) {
  const roomId = socketToRoom.get(socketId)
  if (!roomId) return null

  socketToRoom.delete(socketId)
  const role = socketRoles.get(socketId)
  socketRoles.delete(socketId)
  const room = rooms.get(roomId)
  if (!room) return null

  if (room.presenterId === socketId) {
    room.presenterId = null  // Keep room alive during bounded reconnect grace
    // Clear orphaned timer timeouts — they were scheduled for the disconnected presenter.
    // When the presenter reconnects, new timers can be created from scratch.
    if (room.timerTimeouts) {
      for (const id of Object.values(room.timerTimeouts)) {
        clearTimeout(id)
      }
      room.timerTimeouts = {}
    }
    schedulePresenterTermination(roomId, options.onPresenterLeft)
    return { roomId, role: 'presenter' }
  }

  if (role === 'presenter') {
    return { roomId, role: 'stale-presenter' }
  }

  room.viewers = room.viewers.filter((id) => id !== socketId)
  room.controllers = room.controllers.filter((id) => id !== socketId)
  maybeScheduleRoomCleanup(roomId, room)
  return { roomId, role: role || 'viewer' }
}

// Arm a grace-window reap when a room is orphaned (no presenter, viewers, or controllers).
// A (re)join within the window cancels it via cancelRoomCleanup. In-memory only —
// annotations are NOT flushed to storage on cleanup.
function maybeScheduleRoomCleanup(roomId, room) {
  if (!room) return
  if (room.presenterTerminationTimer) return
  if (room.presenterId || room.viewers.length > 0 || room.controllers.length > 0) return
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  room.cleanupTimer = setTimeout(() => removeRoom(roomId), liveRoomTtlMs)
}

function cancelRoomCleanup(room) {
  if (room?.cleanupTimer) {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
  }
}

function cancelPresenterTermination(room) {
  if (room?.presenterTerminationTimer) {
    clearTimeout(room.presenterTerminationTimer)
    room.presenterTerminationTimer = null
  }
  if (room) room.presenterTerminationHandler = null
}

function schedulePresenterTermination(roomId, onExpire) {
  const room = rooms.get(roomId)
  if (!room || room.presenterId) return false
  cancelPresenterTermination(room)
  room.presenterTerminationHandler = typeof onExpire === 'function' ? onExpire : null
  room.presenterTerminationTimer = setTimeout(() => {
    const current = rooms.get(roomId)
    if (!current || current.presenterId) return
    current.presenterTerminationTimer = null
    const handler = current.presenterTerminationHandler
    current.presenterTerminationHandler = null
    current.presenterConnected = false
    try {
      if (handler) handler(roomId)
    } finally {
      removeRoom(roomId)
    }
  }, presenterGraceMs)
  return true
}

function getRoomState(roomId) {
  return rooms.get(roomId)
}

function removeRoom(roomId) {
  const room = rooms.get(roomId)
  if (!room) return false
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
  cancelPresenterTermination(room)
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
  if (!room) return false
  if (room.presenterId === socketId) return true
  return Boolean(room.presenterId && room.controllers.includes(socketId))
}

function getViewerCount(roomId) {
  return rooms.get(roomId)?.viewers.length || 0
}

function _resetRooms() {
  for (const room of rooms.values()) {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer)
    cancelPresenterTermination(room)
    for (const id of Object.values(room.timerTimeouts || {})) clearTimeout(id)
  }
  rooms.clear()
  socketToRoom.clear()
  socketRoles.clear()
  liveRoomTtlMs = DEFAULT_LIVE_ROOM_TTL_MS
  presenterGraceMs = DEFAULT_PRESENTER_GRACE_MS
}

// Test seam: shrink the orphaned-room grace window so cleanup tests run fast.
function _setLiveRoomTtl(ms) {
  liveRoomTtlMs = ms
}

// Test seam: control presenter reconnect grace independently from orphan cleanup.
function _setPresenterGraceMs(ms) {
  presenterGraceMs = Math.max(0, Number(ms) || 0)
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
  _setPresenterGraceMs,
  computeTimerRemaining,
  getAnnotationKey,
}
