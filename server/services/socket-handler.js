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

function withVerticalIndex(payload, verticalIndex) {
  return Number(verticalIndex) ? { ...payload, verticalIndex } : payload
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSlideTarget(slideIndex, verticalIndex = 0) {
  const normalizedSlideIndex = Number(slideIndex)
  const normalizedVerticalIndex = Number(verticalIndex)
  if (!Number.isInteger(normalizedSlideIndex) || normalizedSlideIndex < 0) return null
  if (!Number.isInteger(normalizedVerticalIndex) || normalizedVerticalIndex < 0) return null
  return {
    slideIndex: normalizedSlideIndex,
    verticalIndex: normalizedVerticalIndex,
  }
}

// Helper: schedule timer-end notification
function emitTimerEnded(roomId, elementId, timer, io) {
  timer.running = false
  timer.pausedRemaining = 0
  timer.endedAt = null
  io.to(roomId).emit('timer:sync', {
    elementId,
    remaining: 0,
    duration: timer.duration,
    running: false,
    endedAt: null,
  })
  io.to(roomId).emit('timer:ended', { elementId })
}

function finalizeExpiredTimer(roomId, elementId, timer, timerTimeouts, io, now = Date.now()) {
  if (!timer?.running || timer.endedAt == null || timer.endedAt > now) return false
  if (timerTimeouts?.[elementId]) clearTimeout(timerTimeouts[elementId])
  delete timerTimeouts[elementId]
  emitTimerEnded(roomId, elementId, timer, io)
  return true
}

// Helper: schedule timer-end notification
function scheduleTimerEnd(roomId, elementId, timers, timerTimeouts, io, now = Date.now()) {
  const timer = timers[elementId]
  if (!timer || !timer.running || timer.endedAt == null) return null
  const remainingMs = timer.endedAt - now
  if (remainingMs <= 0) {
    finalizeExpiredTimer(roomId, elementId, timer, timerTimeouts, io, now)
    return null
  }
  const timeoutId = setTimeout(() => {
    const t = timers[elementId]
    if (t && t.running && t.endedAt === timer.endedAt) emitTimerEnded(roomId, elementId, t, io)
    delete timerTimeouts[elementId]
  }, remainingMs)
  return timeoutId
}

function armTimerEnd(roomId, elementId, timers, timerTimeouts, io) {
  const timer = timers[elementId]
  const now = Date.now()
  if (!timer?.running || timer.endedAt == null) return null
  return scheduleTimerEnd(roomId, elementId, timers, timerTimeouts, io, now)
}

function getSlideTitle(slide, fallback) {
  const textElement = (slide.elements || []).find((element) => element.type === 'text' && element.content)
  const title = getTextFromHtml(textElement?.content)
  return title || fallback
}

function buildPresentationMeta(presentation, { includeSpeakerNotes = true } = {}) {
  const normalized = normalizePresentationNotes(presentation)
  const slides = []

  ;(normalized.slides || []).forEach((slide, slideIndex) => {
    slides.push({
      slideIndex,
      verticalIndex: 0,
      label: String(slideIndex + 1),
      title: getSlideTitle(slide, `Slide ${slideIndex + 1}`),
      ...(includeSpeakerNotes ? { notes: getSlideNotes(slide) } : {}),
    })

    ;(slide.children || []).forEach((child, childIndex) => {
      slides.push({
        slideIndex,
        verticalIndex: childIndex + 1,
        label: `${slideIndex + 1}.${childIndex + 1}`,
        title: getSlideTitle(child, `Slide ${slideIndex + 1}.${childIndex + 1}`),
        ...(includeSpeakerNotes ? { notes: getSlideNotes(child) } : {}),
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

async function emitPresentationPayload(socket, presentationId, findById, canEmit = () => true, role = 'viewer') {
  if (!presentationId) return false
  const pres = await findById(presentationId)
  if (!pres || !canEmit()) return false
  const normalized = normalizePresentationNotes(pres)
  const includeNotes = role === 'presenter' || role === 'speaker'
  if (role !== 'remote') {
    socket.emit('presentation-data', {
      html: generateRevealHTML(normalized, { includeSpeakerNotes: includeNotes }),
    })
  }
  socket.emit('presentation-meta', buildPresentationMeta(normalized, { includeSpeakerNotes: includeNotes }))
  return true
}

function setupSocketHandlers(io, dependencies = {}) {
  const liveRooms = dependencies.liveRoomsService || liveRoomsService
  const findById = dependencies.findPresentationById || findLivePresentationById
  const connectedSockets = new Map()

  io.on('connection', (socket) => {
    connectedSockets.set(socket.id, socket)
    const onPayload = (event, handler) => socket.on(event, (payload) => {
      const normalized = payload && typeof payload === 'object' ? payload : {}
      return handler(normalized)
    })

    function broadcastViewerCount(roomId) {
      const count = liveRooms.getViewerCount(roomId)
      io.to(roomId).emit('viewer-count', { count })
    }
    async function emitRoomPresentation(roomId, presentationId, roomState, generation, presenterId) {
      const recipients = [
        [roomState.presenterId, 'presenter'],
        ...roomState.speakers.map((id) => [id, 'speaker']),
        ...roomState.remotes.map((id) => [id, 'remote']),
        ...roomState.viewers.map((id) => [id, 'viewer']),
      ]
      const presenter = connectedSockets.get(roomState.presenterId)
      const presenterEventStart = presenter?.emitted?.length || 0
      for (const [socketId, memberRole] of recipients) {
        const recipient = connectedSockets.get(socketId)
        if (!recipient) continue
        await emitPresentationPayload(recipient, presentationId, findById, () => {
          const current = liveRooms.getRoomState(roomId)
          return current === roomState &&
            current.presentationGeneration === generation &&
            current.presentationId === presentationId &&
            current.presenterId === presenterId
        }, memberRole)
        recipient.emit('sync-state', roomState.state)
      }
      if (
        recipients.length === 1 &&
        !roomState.viewers.length &&
        !roomState.remotes.length &&
        !roomState.speakers.length
      ) {
        for (const event of (presenter?.emitted || []).slice(presenterEventStart)) {
          if (event.event === 'presentation-data' || event.event === 'presentation-meta') {
            io.to(roomId).emit(event.event, event.payload)
          }
        }
      }
    }


    onPayload('join-room', async ({ roomId, role, presentationId, presenterToken, capability } = {}) => {
      const roomBeforeJoin = liveRooms.getRoomState(roomId)
      const presenterWasDisconnected = role === 'presenter' &&
        roomBeforeJoin?.presenterId == null &&
        roomBeforeJoin?.presenterConnected === true
      const joinResult = liveRooms.joinRoom(roomId, socket.id, role, {
        capability: capability || presenterToken,
      })
      if (!joinResult.ok) {
        if (joinResult.error !== 'room-not-found') {
          socket.emit('join-error', {
            roomId,
            reason: joinResult.error,
            message: joinResult.error === 'already-joined-room'
              ? 'Socket is already joined to another live room'
              : 'Live access denied',
          })
        } else {
          socket.emit('room-not-found', { roomId })
        }
        return
      }
      socket.join(roomId)

      socket.data.roomId = roomId
      socket.data.role = role
      if (presenterWasDisconnected) {
        io.to(roomId).emit('presenter-reconnected')
      }
      const joinedRoom = liveRooms.getRoomState(roomId)
      const joinedGeneration = joinedRoom?.presentationGeneration
      if (role === 'presenter' && presentationId && joinedRoom) {
        joinedRoom.presentationId = null
      }
      const presenterStatus = {
        hasPresenter: Boolean(joinedRoom?.presenterId),
        presenterConnected: joinedRoom?.presenterConnected === true,
      }
      socket.emit('presenter-status', presenterStatus)
      if (role === 'presenter') socket.to(roomId).emit('presenter-status', presenterStatus)
      if (role === 'presenter' && presentationId) {
        const presenterLoadRoom = joinedRoom
        const presenterLoadGeneration = joinedGeneration
        try {
          const pres = await findById(presentationId)
          const roomState = liveRooms.getRoomState(roomId)
          if (
            pres &&
            roomState === presenterLoadRoom &&
            roomState.presenterId === socket.id &&
            roomState.presentationGeneration === presenterLoadGeneration
          ) {
            roomState.presentationId = presentationId
            await emitRoomPresentation(
              roomId,
              presentationId,
              roomState,
              presenterLoadGeneration,
              socket.id
            )
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
        const stillJoined = typeof liveRooms.getRoomForSocket !== 'function' ||
          liveRooms.getRoomForSocket(socket.id) === roomId
        const presenterJoinIsCurrent = roomState === joinedRoom &&
          roomState?.presentationGeneration === joinedGeneration &&
          roomState?.presenterId === socket.id &&
          stillJoined
        if (presenterJoinIsCurrent) {
          for (const [elementId, timer] of Object.entries(roomState.timers || {})) {
            if (timer.running && !roomState.timerTimeouts[elementId]) {
              roomState.timerTimeouts[elementId] = armTimerEnd(
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

      if (role === 'viewer' || role === 'remote' || role === 'speaker' || role === 'controller') {
        const state = joinedRoom
        const payloadRole = role === 'controller' ? 'remote' : role
        if (state) {
          const expectedPresentationId = state.presentationId
          const expectedGeneration = joinedGeneration
          const expectedPresenterId = state.presenterId
          socket.emit('sync-state', state.state)
          if (expectedPresentationId) {
            try {
              await emitPresentationPayload(socket, expectedPresentationId, findById, () => {
                const current = liveRooms.getRoomState(roomId)
                return current === state &&
                  current.presentationGeneration === expectedGeneration &&
                  current.presentationId === expectedPresentationId &&
                  current.presenterId === expectedPresenterId
              }, payloadRole)
            } catch {
              /* ignore */
            }
          }
        }
      }

      // Do not finish a stale async join against a removed/recreated room, a
      // disconnected socket, or a presenter that has since been replaced.
      const room = liveRooms.getRoomState(roomId)
      const stillJoined = typeof liveRooms.getRoomForSocket !== 'function' ||
        liveRooms.getRoomForSocket(socket.id) === roomId
      const stillAuthoritative = role !== 'presenter' || room?.presenterId === socket.id
      if (
        room !== joinedRoom ||
        room?.presentationGeneration !== joinedGeneration ||
        !stillJoined ||
        !stillAuthoritative
      ) return

      broadcastViewerCount(roomId)

      // Send annotations:sync to all joining clients (presenter and viewers)
      socket.emit('annotations:sync', { slideAnnotations: room.annotations || {} })

      // Send timer state to joining clients (for Phase 2)
      for (const [elementId, timer] of Object.entries(room.timers || {})) {
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
    onPayload('navigate', ({ slideIndex, verticalIndex = 0, fragmentIndex = 0 } = {}) => {
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
        const annotationKey = liveRooms.getAnnotationKey
          ? liveRooms.getAnnotationKey(slideIndex, verticalIndex)
          : (Number(verticalIndex) ? `${slideIndex}:${verticalIndex}` : String(slideIndex))
        socket.to(socket.data.roomId).emit('annotations:sync', withVerticalIndex({
          slideIndex,
          annotations: room?.annotations?.[annotationKey] || [],
        }, verticalIndex))
      }
    })
    onPayload('control-navigate', ({ slideIndex, verticalIndex = 0, fragmentIndex = 0 } = {}) => {
      const roomState = liveRooms.getRoomState(socket.data.roomId)
      const legacyController = roomState?.legacyRoleAliases &&
        liveRooms.getRoleForSocket?.(socket.id) === 'controller'
      if (!roomState || (!legacyController && !liveRooms.canNavigateRoom(socket.data.roomId, socket.id))) return
      if (!roomState.presenterId) {
        socket.emit('presenter-status', {
          hasPresenter: false,
          presenterConnected: roomState.presenterConnected === true,
        })
        return
      }
      io.to(roomState.presenterId).emit('control-navigate', {
        slideIndex,
        verticalIndex,
        fragmentIndex,
      })
    })

    // Presenter moves cursor
    onPayload('cursor-move', ({ x, y } = {}) => {
      const roomState = liveRooms.getRoomState(socket.data.roomId)
      if (roomState && roomState.presenterId === socket.id) {
        socket.to(socket.data.roomId).emit('cursor-move', { x, y })
      }
    })

    // Presenter sends laser pointer
    onPayload('laser', ({ x, y, active } = {}) => {
      const roomState = liveRooms.getRoomState(socket.data.roomId)
      if (roomState && liveRooms.canNavigateRoom(socket.data.roomId, socket.id)) {
        socket.to(socket.data.roomId).emit('laser', { x, y, active })
      }
    })

    // Annotation events — only presenter/controller can emit
    onPayload('annotation:add', (payload = {}) => {
      const { slideIndex, verticalIndex = 0, annotation } = payload || {}
      const target = normalizeSlideTarget(slideIndex, verticalIndex)
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canAnnotateRoom(roomId, socket.id)) return
      if (!target || !isRecord(annotation)) return

      const fullAnnotation = {
        ...annotation,
        id: typeof annotation.id === 'string' && annotation.id.length > 0
          ? annotation.id
          : crypto.randomUUID(),
        createdAt: annotation.createdAt || new Date().toISOString(),
        createdBy: 'presenter',
      }

      const room = liveRooms.getRoomState(roomId)
      const annotationKey = liveRooms.getAnnotationKey
        ? liveRooms.getAnnotationKey(target.slideIndex, target.verticalIndex)
        : (target.verticalIndex ? `${target.slideIndex}:${target.verticalIndex}` : String(target.slideIndex))
      if (!room.annotations[annotationKey]) room.annotations[annotationKey] = []
      room.annotations[annotationKey].push(fullAnnotation)

      io.to(roomId).emit(
        'annotation:add',
        withVerticalIndex({ slideIndex: target.slideIndex, annotation: fullAnnotation }, target.verticalIndex)
      )
    })

    onPayload('annotation:remove', (payload = {}) => {
      const { slideIndex, verticalIndex = 0, annotationId } = payload || {}
      const target = normalizeSlideTarget(slideIndex, verticalIndex)
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canAnnotateRoom(roomId, socket.id)) return
      if (!target || typeof annotationId !== 'string' || !annotationId) return
      const room = liveRooms.getRoomState(roomId)
      const annotationKey = liveRooms.getAnnotationKey
        ? liveRooms.getAnnotationKey(target.slideIndex, target.verticalIndex)
        : (target.verticalIndex ? `${target.slideIndex}:${target.verticalIndex}` : String(target.slideIndex))
      if (!room.annotations[annotationKey]) return
      room.annotations[annotationKey] = room.annotations[annotationKey].filter(a => a.id !== annotationId)
      io.to(roomId).emit(
        'annotation:removed',
        withVerticalIndex({ slideIndex: target.slideIndex, annotationId }, target.verticalIndex)
      )
    })

    onPayload('annotation:clear', (payload = {}) => {
      const { slideIndex, verticalIndex = 0 } = payload || {}
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canAnnotateRoom(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (slideIndex === undefined || slideIndex === null) {
        room.annotations = {}
        io.to(roomId).emit('annotation:cleared', { global: true })
        return
      }

      const target = normalizeSlideTarget(slideIndex, verticalIndex)
      if (!target) return
      const annotationKey = liveRooms.getAnnotationKey
        ? liveRooms.getAnnotationKey(target.slideIndex, target.verticalIndex)
        : (target.verticalIndex ? `${target.slideIndex}:${target.verticalIndex}` : String(target.slideIndex))
      room.annotations[annotationKey] = []
      io.to(roomId).emit(
        'annotation:cleared',
        withVerticalIndex({ slideIndex: target.slideIndex }, target.verticalIndex)
      )
    })

    // Timer event handlers (Phase 2 — server-authoritative timer sync)
    onPayload('game-timer-start', ({ elementId, duration } = {}) => {
      if (!isValidElementId(elementId)) return
      const d = Number(duration)
      if (!Number.isFinite(d) || d < 1 || d > 7200) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlTimer(roomId, socket.id)) return
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
      room.timerTimeouts[elementId] = armTimerEnd(roomId, elementId, room.timers, room.timerTimeouts, io)
      io.to(roomId).emit('timer:sync', {
        elementId,
        remaining: d,
        duration: d,
        running: true,
        endedAt: room.timers[elementId].endedAt,
      })
    })

    onPayload('game-timer-pause', ({ elementId } = {}) => {
      if (!isValidElementId(elementId)) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlTimer(roomId, socket.id)) return
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

    onPayload('game-timer-resume', ({ elementId } = {}) => {
      if (!isValidElementId(elementId)) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlTimer(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (!room) return
      const timer = room.timers?.[elementId]
      if (!timer || timer.running || timer.pausedRemaining === null) return
      timer.endedAt = Date.now() + timer.pausedRemaining * 1000
      timer.pausedRemaining = null
      timer.pausedAt = null
      timer.running = true
      room.timerTimeouts[elementId] = armTimerEnd(roomId, elementId, room.timers, room.timerTimeouts, io)
      if (!timer.running) return
      const remaining = Math.max(0, Math.ceil((timer.endedAt - Date.now()) / 1000))
      io.to(roomId).emit('timer:sync', {
        elementId,
        remaining,
        duration: timer.duration,
        running: true,
        endedAt: timer.endedAt,
      })
    })

    onPayload('game-timer-adjust', ({ elementId, delta } = {}) => {
      if (!isValidElementId(elementId)) return
      const adj = Number(delta)
      if (!Number.isFinite(adj) || Math.abs(adj) > 3600) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlTimer(roomId, socket.id)) return
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
        room.timerTimeouts[elementId] = armTimerEnd(roomId, elementId, room.timers, room.timerTimeouts, io)
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

    onPayload('game-timer-stop', ({ elementId } = {}) => {
      if (!isValidElementId(elementId)) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlTimer(roomId, socket.id)) return
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

    onPayload('disconnect', () => {
      connectedSockets.delete(socket.id)
      const result = liveRooms.leaveRoom(socket.id, {
        onPresenterLeft: (roomId) => {
          io.to(roomId).emit('presenter-left')
          const room = typeof io.in === 'function' ? io.in(roomId) : null
          room?.socketsLeave?.(roomId)
        },
      })
      if (result) {
        if (result.role === 'presenter') {
          io.to(result.roomId).emit('presenter-disconnected')
        }
        broadcastViewerCount(result.roomId)
      }
    })
  })
}

module.exports = { setupSocketHandlers }
