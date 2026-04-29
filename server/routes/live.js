const express = require('express')
const liveRooms = require('../services/live-rooms')

const router = express.Router()

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
    })
  } else {
    res.json({ exists: false })
  }
})

module.exports = router
