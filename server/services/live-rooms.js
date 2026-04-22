// Room = presentationId or room code
// Roles: presenter (1 per room), viewer (many)
const rooms = new Map() // roomId -> { presenterId, viewers: [socketId, ...], state: { slideIndex, fragmentIndex } }
const socketToRoom = new Map() // socketId -> roomId

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
    rooms.set(roomId, {
      presenterId: null,
      viewers: [],
      state: { slideIndex: 0, fragmentIndex: 0 },
    })
  }
}

function joinRoom(roomId, socketId, role) {
  let room = rooms.get(roomId)

  if (role === 'presenter') {
    if (!room) {
      room = { presenterId: socketId, viewers: [], state: { slideIndex: 0, fragmentIndex: 0 } }
      rooms.set(roomId, room)
    } else {
      room.presenterId = socketId
    }
  } else {
    // Viewer — allow joining pre-registered rooms even without presenter
    if (!room) {
      // Room doesn't exist at all
      return false
    }
    if (!room.viewers.includes(socketId)) {
      room.viewers.push(socketId)
    }
  }
  socketToRoom.set(socketId, roomId)
  return true
}

function leaveRoom(socketId) {
  const roomId = socketToRoom.get(socketId)
  if (!roomId) return null

  socketToRoom.delete(socketId)
  const room = rooms.get(roomId)
  if (!room) return null

  if (room.presenterId === socketId) {
    rooms.delete(roomId)
    return { roomId, role: 'presenter' }
  } else {
    room.viewers = room.viewers.filter((id) => id !== socketId)
    return { roomId, role: 'viewer' }
  }
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

function _resetRooms() {
  rooms.clear()
  socketToRoom.clear()
}

module.exports = {
  generateRoomCode,
  registerRoom,
  joinRoom,
  leaveRoom,
  getRoomState,
  getRoomForSocket,
  updateRoomState,
  _resetRooms,
}
