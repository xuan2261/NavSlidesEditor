const express = require('express')
const liveRooms = require('../services/live-rooms')

const router = express.Router()

function getBearerToken(req) {
  const value = req.get('authorization') || ''
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

// Generate a new room ID and register it
router.post('/room', (req, res) => {
  const code = liveRooms.generateRoomCode()
  const presenterToken = liveRooms.createPresenterToken()
  // Pre-register the room so viewers can check it exists before presenter connects
  liveRooms.registerRoom(code, presenterToken)
  res.json({ roomCode: code, presenterToken })
})

// Check if a room exists
router.get('/room/:code', (req, res) => {
  const { code } = req.params
  const state = liveRooms.getRoomState(code)
  if (state) {
    res.json({
      exists: true,
      viewersCount: liveRooms.getViewerCount(code),
      hasPresenter: !!state.presenterId,
      presenterConnected: state.presenterConnected === true,
    })
  } else {
    res.json({ exists: false })
  }
})

// Get annotations for a room (presenter-only via token auth)
router.get('/room/:code/annotations', (req, res) => {
  const { code } = req.params
  const { token } = req.query
  const room = liveRooms.getRoomState(code)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (!token || !liveRooms.isValidPresenterToken(room, token)) {
    return res.status(403).json({ error: 'Invalid presenter token' })
  }
  const slideAnnotations = {}
  for (const [idx, anns] of Object.entries(room.annotations)) {
    slideAnnotations[idx] = anns
  }
  res.json({ roomCode: code, slideAnnotations })
})

// End a room and clear in-memory live state. Presenter token required.
router.delete('/room/:code', (req, res) => {
  const { code } = req.params
  const token = getBearerToken(req) || req.query.token
  const room = liveRooms.getRoomState(code)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (!token || !liveRooms.isValidPresenterToken(room, token)) {
    return res.status(403).json({ error: 'Invalid presenter token' })
  }
  const io = req.app.get('io')
  if (io) {
    io.to(code).emit('room-ended', { roomId: code })
    io.in(code).socketsLeave(code)
  }
  liveRooms.removeRoom(code)
  res.status(204).end()
})

module.exports = router
