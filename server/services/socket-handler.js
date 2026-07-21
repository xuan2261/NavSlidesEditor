const { findPresentationById, findServeablePresentation } = require('./presentation-finder')
const { readAuthoritativePresentation } = require('./package-backed-presentation-read')
const liveRoomsService = require('./live-rooms')
const { generateRevealHTML, getSlideNotes, normalizePresentationNotes } = require('revealjs-shared')
const crypto = require('crypto')

function getTextFromHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '').trim()
}

// Validate elementId format
function isValidElementId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9-]+$/.test(id) && id.length <= 64
}

// Helper: schedule timer-end notification
function scheduleTimerEnd(roomId, elementId, timers, timerTimeouts, io) {
  const timer = timers[elementId]
  if (!timer || !timer.running) return null
  const remainingMs = timer.endedAt - Date.now()
  if (remainingMs <= 0) return null
  const timeoutId = setTimeout(() => {
    const t = timers[elementId]
    if (t && t.running && t.endedAt === timer.endedAt) {
      t.running = false
      t.pausedRemaining = 0
      t.endedAt = null
      io.to(roomId).emit('timer:sync', {
        elementId,
        remaining: 0,
        duration: t.duration,
        running: false,
        endedAt: null,
      })
      io.to(roomId).emit('timer:ended', { elementId })
    }
    delete timerTimeouts[elementId]
  }, remainingMs)
  return timeoutId
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

async function findLivePresentationById(id) {
  const userPresentation = await findServeablePresentation(id, { normalize: false })
  if (userPresentation) {
    const resolved = await readAuthoritativePresentation(id)
    return resolved?.presentation || null
  }
  return findPresentationById(id)
}

async function emitPresentationPayload(socket, presentationId, findById) {
  if (!presentationId) return
  const pres = await findById(presentationId)
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
function setupSocketHandlers(io, dependencies = {}) {
  const liveRooms = dependencies.liveRoomsService || liveRoomsService
  const findById = dependencies.findPresentationById || findLivePresentationById

  io.on('connection', (socket) => {
    // Helper: broadcast viewer count for a room
    function broadcastViewerCount(roomId) {
      const count = liveRooms.getViewerCount(roomId)
      io.to(roomId).emit('viewer-count', { count })
    }

    // Join presentation room
    socket.on('join-room', async ({ roomId, role, presentationId, presenterToken }) => {
      const joinResult = liveRooms.joinRoom(roomId, socket.id, role, { presenterToken })
      if (!joinResult.ok) {
        if (joinResult.error === 'invalid-presenter-token') {
          socket.emit('join-error', {
            roomId,
            reason: 'invalid-presenter-token',
            message: 'Presenter access denied',
          })
        } else {
          socket.emit('room-not-found', { roomId })
        }
        return
      }
      socket.join(roomId)

      socket.data.roomId = roomId
      socket.data.role = role

      if (role === 'presenter' && presentationId) {
        try {
          const pres = await findById(presentationId)
          if (pres) {
            const normalized = normalizePresentationNotes(pres)
            const html = generateRevealHTML(normalized)
            const roomState = liveRooms.getRoomState(roomId)
            if (roomState) roomState.presentationId = presentationId
            io.to(roomId).emit('presentation-data', { html })
            io.to(roomId).emit('presentation-meta', buildPresentationMeta(normalized))
            io.to(roomId).emit('sync-state', roomState.state)
          }
        } catch (err) {
          console.error('Failed to load presentation for live room', err)
        }
      }

      // On presenter (re)connect, re-arm any running timers. leaveRoom cleared
      // their timeouts on disconnect but left the running timer state intact, so
      // a mid-countdown reconnect must reschedule timer:ended at the remaining time.
      if (role === 'presenter') {
        const roomState = liveRooms.getRoomState(roomId)
        if (roomState) {
          for (const [elementId, timer] of Object.entries(roomState.timers || {})) {
            if (timer.running && !roomState.timerTimeouts[elementId]) {
              roomState.timerTimeouts[elementId] = scheduleTimerEnd(
                roomId,
                elementId,
                roomState.timers,
                roomState.timerTimeouts,
                io
              )
            }
          }
        }
      }

      if (role === 'viewer' || role === 'controller') {
        const state = liveRooms.getRoomState(roomId)
        if (state) {
          socket.emit('sync-state', state.state)
          if (state.presentationId) {
            try {
              await emitPresentationPayload(socket, state.presentationId, findById)
            } catch {
              /* ignore */
            }
          }
        }
      }

      broadcastViewerCount(roomId)

      // Send annotations:sync to all joining clients (presenter and viewers)
      const room = liveRooms.getRoomState(roomId)
      socket.emit('annotations:sync', { slideAnnotations: room?.annotations || {} })

      // Send timer state to joining clients (for Phase 2)
      for (const [elementId, timer] of Object.entries(room?.timers || {})) {
        const computeTimerRemaining = (t) => {
          if (!t.running || t.endedAt === null) return t.pausedRemaining ?? t.duration
          return Math.max(0, Math.ceil((t.endedAt - Date.now()) / 1000))
        }
        socket.emit('timer:sync', {
          elementId,
          remaining: computeTimerRemaining(timer),
          duration: timer.duration,
          running: timer.running,
          endedAt: timer.endedAt,
        })
      }
    })

    // Presenter navigates
    socket.on('navigate', ({ slideIndex, verticalIndex = 0, fragmentIndex = 0 }) => {
      const state = { slideIndex, verticalIndex, fragmentIndex }
      const success = liveRooms.updateRoomState(socket.data.roomId, socket.id, {
        ...state,
      })
      if (success) {
        socket.to(socket.data.roomId).emit('navigate', state)
        socket.to(socket.data.roomId).emit('sync-state', state)
        // Re-sync annotations scoped to the target slide so viewers swap to that
        // slide's strokes (empty if none) instead of bleeding the previous slide.
        const room = liveRooms.getRoomState(socket.data.roomId)
        socket.to(socket.data.roomId).emit('annotations:sync', {
          slideIndex,
          annotations: room?.annotations?.[slideIndex] || [],
        })
      }
    })

    socket.on('control-navigate', ({ slideIndex, verticalIndex = 0, fragmentIndex = 0 }) => {
      const roomState = liveRooms.getRoomState(socket.data.roomId)
      if (!roomState || !liveRooms.canControlRoom(socket.data.roomId, socket.id)) return
      if (!roomState.presenterId) return
      io.to(roomState.presenterId).emit('control-navigate', {
        slideIndex,
        verticalIndex,
        fragmentIndex,
      })
    })

    // Presenter moves cursor
    socket.on('cursor-move', ({ x, y }) => {
      const roomState = liveRooms.getRoomState(socket.data.roomId)
      if (roomState && roomState.presenterId === socket.id) {
        socket.to(socket.data.roomId).emit('cursor-move', { x, y })
      }
    })

    // Presenter sends laser pointer
    socket.on('laser', ({ x, y, active }) => {
      const roomState = liveRooms.getRoomState(socket.data.roomId)
      if (roomState && liveRooms.canControlRoom(socket.data.roomId, socket.id)) {
        socket.to(socket.data.roomId).emit('laser', { x, y, active })
      }
    })

    // Annotation events — only presenter/controller can emit
    socket.on('annotation:add', ({ slideIndex, annotation }) => {
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId) return
      if (!liveRooms.canControlRoom(roomId, socket.id)) return

      const fullAnnotation = {
        ...annotation,
        id: annotation.id || crypto.randomUUID(),
        createdAt: annotation.createdAt || new Date().toISOString(),
        createdBy: 'presenter',
      }

      const room = liveRooms.getRoomState(roomId)
      if (!room.annotations[slideIndex]) room.annotations[slideIndex] = []
      room.annotations[slideIndex].push(fullAnnotation)

      io.to(roomId).emit('annotation:add', { slideIndex, annotation: fullAnnotation })
    })

    socket.on('annotation:remove', ({ slideIndex, annotationId }) => {
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlRoom(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (!room.annotations[slideIndex]) return
      room.annotations[slideIndex] = room.annotations[slideIndex].filter(a => a.id !== annotationId)
      io.to(roomId).emit('annotation:removed', { slideIndex, annotationId })
    })

    socket.on('annotation:clear', ({ slideIndex }) => {
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlRoom(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (slideIndex !== undefined) {
        room.annotations[slideIndex] = []
      } else {
        room.annotations = {}
      }
      io.to(roomId).emit('annotation:cleared', { slideIndex })
    })

    // Timer event handlers (Phase 2 — server-authoritative timer sync)
    socket.on('game-timer-start', ({ elementId, duration }) => {
      if (!isValidElementId(elementId)) return
      const d = Number(duration)
      if (!Number.isFinite(d) || d < 1 || d > 7200) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlRoom(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (!room) return
      room.timers[elementId] = {
        duration: d,
        endedAt: Date.now() + d * 1000,
        pausedAt: null,
        pausedRemaining: null,
        running: true,
      }
      if (room.timerTimeouts?.[elementId]) clearTimeout(room.timerTimeouts[elementId])
      room.timerTimeouts[elementId] = scheduleTimerEnd(roomId, elementId, room.timers, room.timerTimeouts, io)
      io.to(roomId).emit('timer:sync', {
        elementId,
        remaining: d,
        duration: d,
        running: true,
        endedAt: room.timers[elementId].endedAt,
      })
    })

    socket.on('game-timer-pause', ({ elementId }) => {
      if (!isValidElementId(elementId)) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlRoom(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (!room) return
      const timer = room.timers?.[elementId]
      if (!timer || !timer.running) return
      timer.pausedRemaining = Math.max(0, Math.ceil((timer.endedAt - Date.now()) / 1000))
      timer.running = false
      timer.pausedAt = Date.now()
      timer.endedAt = null
      if (room.timerTimeouts?.[elementId]) { clearTimeout(room.timerTimeouts[elementId]); delete room.timerTimeouts[elementId] }
      io.to(roomId).emit('timer:sync', {
        elementId,
        remaining: timer.pausedRemaining,
        duration: timer.duration,
        running: false,
        endedAt: null,
      })
    })

    socket.on('game-timer-resume', ({ elementId }) => {
      if (!isValidElementId(elementId)) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlRoom(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (!room) return
      const timer = room.timers?.[elementId]
      if (!timer || timer.running || timer.pausedRemaining === null) return
      timer.endedAt = Date.now() + timer.pausedRemaining * 1000
      timer.pausedRemaining = null
      timer.pausedAt = null
      timer.running = true
      room.timerTimeouts[elementId] = scheduleTimerEnd(roomId, elementId, room.timers, room.timerTimeouts, io)
      const remaining = Math.max(0, Math.ceil((timer.endedAt - Date.now()) / 1000))
      io.to(roomId).emit('timer:sync', {
        elementId,
        remaining,
        duration: timer.duration,
        running: true,
        endedAt: timer.endedAt,
      })
    })

    socket.on('game-timer-adjust', ({ elementId, delta }) => {
      if (!isValidElementId(elementId)) return
      const adj = Number(delta)
      if (!Number.isFinite(adj) || Math.abs(adj) > 3600) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlRoom(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (!room) return
      const timer = room.timers?.[elementId]
      if (!timer) return
      if (timer.running) {
        timer.endedAt = Math.max(Date.now() + 1000, timer.endedAt + adj * 1000)
      } else if (timer.pausedRemaining !== null) {
        timer.pausedRemaining = Math.max(0, timer.pausedRemaining + adj)
      }
      timer.duration = Math.max(1, timer.duration + adj)
      if (timer.running && room.timerTimeouts?.[elementId]) {
        clearTimeout(room.timerTimeouts[elementId])
        room.timerTimeouts[elementId] = scheduleTimerEnd(roomId, elementId, room.timers, room.timerTimeouts, io)
      }
      const remaining = timer.running
        ? Math.max(0, Math.ceil((timer.endedAt - Date.now()) / 1000))
        : (timer.pausedRemaining ?? timer.duration)
      io.to(roomId).emit('timer:sync', {
        elementId,
        remaining,
        duration: timer.duration,
        running: timer.running,
        endedAt: timer.endedAt,
      })
    })

    socket.on('game-timer-stop', ({ elementId }) => {
      if (!isValidElementId(elementId)) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlRoom(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (!room) return
      if (room.timerTimeouts?.[elementId]) { clearTimeout(room.timerTimeouts[elementId]); delete room.timerTimeouts[elementId] }
      delete room.timers[elementId]
      io.to(roomId).emit('timer:sync', {
        elementId,
        remaining: 0,
        duration: 0,
        running: false,
        endedAt: null,
      })
    })

    socket.on('disconnect', () => {
      const result = liveRooms.leaveRoom(socket.id)
      if (result) {
        if (result.role === 'presenter') {
          // Room survives — presenter may reconnect. Emit 'presenter-disconnected'.
          io.to(result.roomId).emit('presenter-disconnected')
        }
        broadcastViewerCount(result.roomId)
      }
    })
  })
}

module.exports = { setupSocketHandlers }
