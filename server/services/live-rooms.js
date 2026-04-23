// Room = presentationId or room code
// Roles: presenter (1 per room), controller (remote/speaker), viewer (many)
const rooms = new Map() // roomId -> { presenterId, controllers, viewers, presentationId, state }
const socketToRoom = new Map() // socketId -> roomId
const socketRoles = new Map() // socketId -> role

function createRoom(presenterId = null) {
  return {
    presenterId,
    controllers: [],
    viewers: [],
    presentationId: null,
    state: { slideIndex: 0, verticalIndex: 0, fragmentIndex: 0 },
  }
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Pre-register a room (before presenter connects via Socket.IO)
function registerRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom())
  }
}

function joinRoom(roomId, socketId, role) {
  let room = rooms.get(roomId)

  if (role === 'presenter') {
    if (!room) {
      room = createRoom(socketId)
      rooms.set(roomId, room)
    } else {
      room.presenterId = socketId
    }
  } else if (role === 'controller') {
    if (!room) {
      return false
    }
    if (!room.controllers.includes(socketId)) {
      room.controllers.push(socketId)
    }
  } else {
    // Viewer — allow joining pre-registered rooms even without presenter
    if (!room) return false
    if (!room.viewers.includes(socketId)) {
      room.viewers.push(socketId)
    }
  }
  socketToRoom.set(socketId, roomId)
  socketRoles.set(socketId, role)
  return true
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
    rooms.delete(roomId)
    return { roomId, role: 'presenter' }
  }

  room.viewers = room.viewers.filter((id) => id !== socketId)
  room.controllers = room.controllers.filter((id) => id !== socketId)
  return { roomId, role: role || 'viewer' }
}

function getRoomState(roomId) {
  return rooms.get(roomId)
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
  rooms.clear()
  socketToRoom.clear()
  socketRoles.clear()
}

module.exports = {
  generateRoomCode,
  registerRoom,
  joinRoom,
  leaveRoom,
  getRoomState,
  getRoomForSocket,
  updateRoomState,
  canControlRoom,
  getViewerCount,
  _resetRooms,
}
