const express = require('express')
const liveRooms = require('../services/live-rooms')

const router = express.Router()

function getBearerToken(req) {
  const value = req.get('authorization') || ''
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

function setCapabilityHeaders(res) {
  res.set({
    'Cache-Control': 'no-store, private',
    Pragma: 'no-cache',
    Expires: '0',
  })
}

// Generate a new room ID and register it.
router.post('/room', (req, res) => {
  const code = liveRooms.generateRoomCode()
  const capabilities = liveRooms.createLiveCapabilities()
  liveRooms.registerRoom(code, capabilities)
  setCapabilityHeaders(res)
  res.json({ roomCode: code, ...capabilities })
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

// Get annotations for a room (presenter-only via bearer auth).
router.get('/room/:code/annotations', (req, res) => {
  const { code } = req.params
  const token = getBearerToken(req)
  const room = liveRooms.getRoomState(code)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (!token || !liveRooms.isValidPresenterToken(room, token)) {
    return res.status(403).json({ error: 'Invalid presenter token' })
  }
  const slideAnnotations = {}
  for (const [idx, anns] of Object.entries(room.annotations)) {
    slideAnnotations[idx] = anns
  }
  setCapabilityHeaders(res)
  res.json({ roomCode: code, slideAnnotations })
})

// End a room and clear in-memory live state. Presenter bearer capability required.
router.delete('/room/:code', (req, res) => {
  const { code } = req.params
  const token = getBearerToken(req)
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
  setCapabilityHeaders(res)
  res.status(204).end()
})

module.exports = router
