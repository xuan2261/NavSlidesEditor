const { findPresentationById } = require('./presentation-finder')
const liveRoomsService = require('./live-rooms')
const { generateRevealHTML, getSlideNotes, normalizePresentationNotes } = require('revealjs-shared')

function getTextFromHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '').trim()
}

function getSlideTitle(slide, fallback) {
  const textElement = (slide.elements || []).find((element) => element.type === 'text' && element.content)
  const title = getTextFromHtml(textElement?.content)
  return title || fallback
}

function buildPresentationMeta(presentation) {
  const normalized = normalizePresentationNotes(presentation)
  const slides = []

  ;(normalized.slides || []).forEach((slide, slideIndex) => {
    slides.push({
      slideIndex,
      verticalIndex: 0,
      label: String(slideIndex + 1),
      title: getSlideTitle(slide, `Slide ${slideIndex + 1}`),
      notes: getSlideNotes(slide),
    })

    ;(slide.children || []).forEach((child, childIndex) => {
      slides.push({
        slideIndex,
        verticalIndex: childIndex + 1,
        label: `${slideIndex + 1}.${childIndex + 1}`,
        title: getSlideTitle(child, `Slide ${slideIndex + 1}.${childIndex + 1}`),
        notes: getSlideNotes(child),
      })
    })
  })

  return {
    presentationId: normalized.id,
    title: normalized.title || 'Untitled Presentation',
    slideCount: (normalized.slides || []).length,
    slides,
  }
}

async function emitPresentationPayload(socket, roomId, presentationId) {
  if (!presentationId) return
  const pres = await findPresentationById(presentationId)
  if (!pres) return
  const normalized = normalizePresentationNotes(pres)
  const html = generateRevealHTML(normalized)
  socket.emit('presentation-data', { html })
  socket.emit('presentation-meta', buildPresentationMeta(normalized))
}

/**
 * Attach all Socket.IO event handlers to the given io instance.
 * Extracted from server/index.js to reduce file size and improve modularity.
 */
function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // Helper: broadcast viewer count for a room
    function broadcastViewerCount(roomId) {
      const count = liveRoomsService.getViewerCount(roomId)
      io.to(roomId).emit('viewer-count', { count })
    }

    // Join presentation room
    socket.on('join-room', async ({ roomId, role, presentationId }) => {
      const joined = liveRoomsService.joinRoom(roomId, socket.id, role)
      if (!joined) {
        socket.emit('room-not-found', { roomId })
        return
      }
      socket.join(roomId)

      socket.data.roomId = roomId
      socket.data.role = role

      if (role === 'presenter' && presentationId) {
        try {
          const pres = await findPresentationById(presentationId)
          if (pres) {
            const normalized = normalizePresentationNotes(pres)
            const html = generateRevealHTML(normalized)
            const roomState = liveRoomsService.getRoomState(roomId)
            if (roomState) roomState.presentationId = presentationId
            io.to(roomId).emit('presentation-data', { html })
            io.to(roomId).emit('presentation-meta', buildPresentationMeta(normalized))
            io.to(roomId).emit('sync-state', roomState.state)
          }
        } catch (err) {
          console.error('Failed to load presentation for live room', err)
        }
      }

      if (role === 'viewer' || role === 'controller') {
        const state = liveRoomsService.getRoomState(roomId)
        if (state) {
          socket.emit('sync-state', state.state)
          if (state.presentationId) {
            try {
              await emitPresentationPayload(socket, roomId, state.presentationId)
            } catch {
              /* ignore */
            }
          }
        }
      }

      broadcastViewerCount(roomId)
    })

    // Presenter navigates
    socket.on('navigate', ({ slideIndex, verticalIndex = 0, fragmentIndex = 0 }) => {
      const state = { slideIndex, verticalIndex, fragmentIndex }
      const success = liveRoomsService.updateRoomState(socket.data.roomId, socket.id, {
        ...state,
      })
      if (success) {
        socket.to(socket.data.roomId).emit('navigate', state)
        socket.to(socket.data.roomId).emit('sync-state', state)
      }
    })

    socket.on('control-navigate', ({ slideIndex, verticalIndex = 0, fragmentIndex = 0 }) => {
      const roomState = liveRoomsService.getRoomState(socket.data.roomId)
      if (!roomState || !liveRoomsService.canControlRoom(socket.data.roomId, socket.id)) return
      if (!roomState.presenterId) return
      io.to(roomState.presenterId).emit('control-navigate', {
        slideIndex,
        verticalIndex,
        fragmentIndex,
      })
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
      if (roomState && liveRoomsService.canControlRoom(socket.data.roomId, socket.id)) {
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
