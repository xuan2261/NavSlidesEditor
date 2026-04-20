const { findPresentationById } = require('./presentation-finder')
const liveRoomsService = require('./live-rooms')
const { generateRevealHTML } = require('revealjs-shared')

/**
 * Attach all Socket.IO event handlers to the given io instance.
 * Extracted from server/index.js to reduce file size and improve modularity.
 */
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Helper: broadcast viewer count for a room
    function broadcastViewerCount(roomId) {
      const state = liveRoomsService.getRoomState(roomId)
      const count = state ? state.viewers.length : 0
      io.to(roomId).emit('viewer-count', { count })
    }

    // Join presentation room
    socket.on('join-room', async ({ roomId, role, presentationId }) => {
      socket.join(roomId)
      liveRoomsService.joinRoom(roomId, socket.id, role)

      socket.data.roomId = roomId
      socket.data.role = role

      if (role === 'presenter' && presentationId) {
        try {
          const pres = await findPresentationById(presentationId)
          if (pres) {
            const html = generateRevealHTML(pres)
            const roomState = liveRoomsService.getRoomState(roomId)
            if (roomState) roomState.presentationId = presentationId
            io.to(roomId).emit('presentation-data', { html })
          }
        } catch (err) {
          console.error('Failed to load presentation for live room', err)
        }
      }

      if (role === 'viewer') {
        const state = liveRoomsService.getRoomState(roomId)
        if (state) {
          socket.emit('sync-state', state.state)
          if (state.presentationId) {
            try {
              const pres = await findPresentationById(state.presentationId)
              if (pres) {
                const html = generateRevealHTML(pres)
                socket.emit('presentation-data', { html })
              }
            } catch { /* ignore */ }
          }
        }
      }

      broadcastViewerCount(roomId)
    })

    // Presenter navigates
    socket.on('navigate', ({ slideIndex, fragmentIndex }) => {
      const success = liveRoomsService.updateRoomState(socket.data.roomId, socket.id, { slideIndex, fragmentIndex })
      if (success) {
        socket.to(socket.data.roomId).emit('navigate', { slideIndex, fragmentIndex })
      }
    })

    // Presenter moves cursor
    socket.on('cursor-move', ({ x, y }) => {
      const roomState = liveRoomsService.getRoomState(socket.data.roomId)
      if (roomState && roomState.presenterId === socket.id) {
        socket.to(socket.data.roomId).emit('cursor-move', { x, y })
      }
    })

    // Presenter draws annotation
    socket.on('annotation', ({ type, data }) => {
      const roomState = liveRoomsService.getRoomState(socket.data.roomId)
      if (roomState && roomState.presenterId === socket.id) {
        socket.to(socket.data.roomId).emit('annotation', { type, data })
      }
    })

    // Presenter sends laser pointer
    socket.on('laser', ({ x, y, active }) => {
      const roomState = liveRoomsService.getRoomState(socket.data.roomId)
      if (roomState && roomState.presenterId === socket.id) {
        socket.to(socket.data.roomId).emit('laser', { x, y, active })
      }
    })

    socket.on('disconnect', () => {
      const result = liveRoomsService.leaveRoom(socket.id)
      if (result) {
        if (result.role === 'presenter') {
          io.to(result.roomId).emit('presenter-left')
        }
        broadcastViewerCount(result.roomId)
      }
    })
  })
}

module.exports = { setupSocketHandlers }
