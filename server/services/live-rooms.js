// Live rooms keep only hashed bearer capabilities. Raw capabilities are returned
// once by room creation and are never retained in room state.
const crypto = require('crypto')

const rooms = new Map()
const socketToRoom = new Map()
const socketRoles = new Map()
const LIVE_ROLES = new Set(['presenter', 'speaker', 'remote', 'viewer'])

const DEFAULT_LIVE_ROOM_TTL_MS = 60 * 1000
const DEFAULT_PRESENTER_GRACE_MS = 5 * 1000
let liveRoomTtlMs = DEFAULT_LIVE_ROOM_TTL_MS
let presenterGraceMs = DEFAULT_PRESENTER_GRACE_MS

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

function createCapability() {
  return crypto.randomBytes(24).toString('base64url')
}

function createLiveCapabilities() {
  return {
    presenterToken: createCapability(),
    remoteToken: createCapability(),
    speakerToken: createCapability(),
  }
}

function createPresenterToken() {
  return createCapability()
}

function normalizeCapabilities(input) {
  if (input && typeof input === 'object') {
    return {
      presenterToken: input.presenterToken || createCapability(),
      remoteToken: input.remoteToken || createCapability(),
      speakerToken: input.speakerToken || createCapability(),
    }
  }
  return {
    presenterToken: input || createCapability(),
    remoteToken: createCapability(),
    speakerToken: createCapability(),
  }
}

function createRoom(capabilities, presenterId = null) {
  const tokens = normalizeCapabilities(capabilities)
  const room = {
    presenterId,
    presenterConnected: false,
    presenterTokenHash: hashToken(tokens.presenterToken),
    remoteTokenHash: hashToken(tokens.remoteToken),
    speakerTokenHash: hashToken(tokens.speakerToken),
    remotes: [],
    speakers: [],
    viewers: [],
    presentationId: null,
    presentationGeneration: 0,
    state: { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 },
    annotations: {},
    timers: {},
    timerTimeouts: {},
    cleanupTimer: null,
    presenterTerminationTimer: null,
    presenterTerminationHandler: null,
  }
  room.controllers = room.remotes
  return room
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

function isValidCapability(room, role, capability) {
  if (!room || !capability || !LIVE_ROLES.has(role)) return false
  const hashName = role === 'presenter' ? 'presenterTokenHash' : `${role}TokenHash`
  const expected = room[hashName]
  const actual = hashToken(capability)
  return Boolean(expected && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual)))
}

function isValidPresenterToken(room, token) {
  return isValidCapability(room, 'presenter', token)
}

function registerRoom(roomId, capabilities) {
  if (rooms.has(roomId)) return
  const room = createRoom(capabilities)
  room.legacyRoleAliases = typeof capabilities === 'string'
  rooms.set(roomId, room)
  maybeScheduleRoomCleanup(roomId, room)
}

function roleMembers(room, role) {
  const effectiveRole = role === 'controller' ? 'remote' : role
  if (effectiveRole === 'remote') return room.remotes
  if (effectiveRole === 'speaker') return room.speakers
  if (effectiveRole === 'viewer') return room.viewers
  return null
}
function joinRoom(roomId, socketId, requestedRole, options = {}) {
  const capability = options.capability || options.presenterToken
  const room = rooms.get(roomId)
  const legacyController = requestedRole === 'controller' && room?.legacyRoleAliases
  const role = legacyController ? 'remote' : requestedRole
  const previousRoomId = socketToRoom.get(socketId)
  if (previousRoomId && previousRoomId !== roomId) {
    return { ok: false, error: 'already-joined-room' }
  }
  if (!LIVE_ROLES.has(role)) return { ok: false, error: 'invalid-role' }
  if (!room) return { ok: false, error: 'room-not-found' }

  if (role !== 'viewer' && !legacyController && !isValidCapability(room, role, capability)) {
    return { ok: false, error: `invalid-${role}-token` }
  }
  if (role === 'presenter') {
    cancelPresenterTermination(room)
    room.presentationGeneration += 1
    room.presenterId = socketId
    room.presenterConnected = true
  } else {
    const members = roleMembers(room, role)
    if (!members.includes(socketId)) members.push(socketId)
  }

  cancelRoomCleanup(room)
  socketToRoom.set(socketId, roomId)
  socketRoles.set(socketId, legacyController ? 'controller' : role)
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

  const members = roleMembers(room, role)
  if (members) {
    const index = members.indexOf(socketId)
    if (index >= 0) members.splice(index, 1)
  }
  maybeScheduleRoomCleanup(roomId, room)
  return { roomId, role: role || 'viewer' }
}

function hasRole(roomId, socketId, roles) {
  const room = rooms.get(roomId)
  const role = socketRoles.get(socketId)
  const effectiveRole = role === 'controller' && room?.legacyRoleAliases ? 'remote' : role
  if (!room || !effectiveRole || !roles.includes(effectiveRole)) return false
  if (effectiveRole === 'presenter') return room.presenterId === socketId
  return roleMembers(room, effectiveRole)?.includes(socketId) === true && Boolean(room.presenterId)
}

// Arm a grace-window reap when a room is orphaned.
function maybeScheduleRoomCleanup(roomId, room) {
  if (!room) return
  if (room.presenterTerminationTimer) return
  const memberCount = room.viewers.length + room.remotes.length + room.speakers.length
  if (room.presenterId || memberCount > 0) return
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
function getRoleForSocket(socketId) {
  return socketRoles.get(socketId)
}

function updateRoomState(roomId, socketId, newState) {
  const room = rooms.get(roomId)
  if (!room || room.presenterId !== socketId) return false
  room.state = { ...room.state, ...newState }
  return true
}

function canNavigateRoom(roomId, socketId) {
  return hasRole(roomId, socketId, ['presenter', 'speaker', 'remote'])
}

function canAnnotateRoom(roomId, socketId) {
  const room = rooms.get(roomId)
  return hasRole(roomId, socketId, ['presenter', 'speaker']) ||
    Boolean(room?.legacyRoleAliases && hasRole(roomId, socketId, ['remote']))
}

function canControlTimer(roomId, socketId) {
  const room = rooms.get(roomId)
  return hasRole(roomId, socketId, ['presenter', 'speaker']) ||
    Boolean(room?.legacyRoleAliases && hasRole(roomId, socketId, ['remote']))
}
function canControlRoom(roomId, socketId) {
  return canNavigateRoom(roomId, socketId)
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

function _setPresenterGraceMs(ms) {
  presenterGraceMs = Math.max(0, Number(ms) || 0)
}

module.exports = {
  createPresenterToken,
  createLiveCapabilities,
  generateRoomCode,
  registerRoom,
  joinRoom,
  leaveRoom,
  getRoomState,
  removeRoom,
  getRoomForSocket,
  getRoleForSocket,
  updateRoomState,
  canNavigateRoom,
  canAnnotateRoom,
  canControlTimer,
  canControlRoom,
  getViewerCount,
  isValidPresenterToken,
  _resetRooms,
  _setLiveRoomTtl,
  _setPresenterGraceMs,
  computeTimerRemaining,
  getAnnotationKey,
}
