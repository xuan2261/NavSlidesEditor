const logger = require('./logger')
const { findPresentationById, findServeablePresentation } = require('./presentation-finder')
const { readAuthoritativePresentation } = require('./package-backed-presentation-read')
const liveRoomsService = require('./live-rooms')
const { generateRevealHTML, getSlideNotes, normalizePresentationNotes } = require('revealjs-shared')
const crypto = require('crypto')
const { armTimerEnd, timerSnapshot, setupTimerHandlers } = require('./live-timer-handlers.js')
const { getServingBaseUrl } = require('../utils/serving-origin')

function getTextFromHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .trim()
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

function getSlideTitle(slide, fallback) {
  const textElement = (slide.elements || []).find(
    (element) => element.type === 'text' && element.content
  )
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

function getSocketBaseUrl(socket) {
  const origin = socket.handshake?.headers?.origin || socket.request?.headers?.origin
  if (typeof origin === 'string') {
    try {
      const url = new URL(origin)
      if (['http:', 'https:'].includes(url.protocol) && url.origin === origin) return url.origin
    } catch {
      // Non-browser transports may omit a usable Origin; use their serving request.
    }
  }
  return getServingBaseUrl(socket.request)
}

function emitPresentationPayload(socket, presentation, role, presentationGeneration) {
  const normalized = normalizePresentationNotes(presentation)
  const includeNotes = role === 'presenter' || role === 'speaker'
  if (role !== 'remote') {
    socket.emit('presentation-data', {
      presentationId: normalized.id,
      presentationGeneration,
      html: generateRevealHTML(normalized, {
        baseUrl: getSocketBaseUrl(socket),
        includeSpeakerNotes: includeNotes,
        educationView: 'audience',
      }),
    })
  }
  socket.emit(
    'presentation-meta',
    buildPresentationMeta(normalized, { includeSpeakerNotes: includeNotes })
  )
}

function setupSocketHandlers(io, dependencies = {}) {
  const liveRooms = dependencies.liveRoomsService || liveRoomsService
  const findById = dependencies.findPresentationById || findLivePresentationById
  const connectedSockets = new Map()

  function isCurrentRecipient(recipient, roomId, role) {
    const currentRole = liveRooms.getRoleForSocket(recipient.id)
    const effectiveRole = currentRole === 'controller' ? 'remote' : currentRole
    const expectedRole = role === 'controller' ? 'remote' : role
    return (
      connectedSockets.get(recipient.id) === recipient &&
      liveRooms.getRoomForSocket(recipient.id) === roomId &&
      effectiveRole === expectedRole
    )
  }

  io.on('connection', (socket) => {
    connectedSockets.set(socket.id, socket)
    const onPayload = (event, handler) =>
      socket.on(event, (payload) => {
        const normalized = payload && typeof payload === 'object' ? payload : {}
        return handler(normalized)
      })

    function broadcastViewerCount(roomId) {
      const count = liveRooms.getViewerCount(roomId)
      io.to(roomId).emit('viewer-count', { count })
    }
    function emitRoomPresentation(roomId, presentation, roomState, generation, presenterId) {
      const recipients = [
        [roomState.presenterId, 'presenter'],
        ...roomState.speakers.map((id) => [id, 'speaker']),
        ...roomState.remotes.map((id) => [id, 'remote']),
        ...roomState.viewers.map((id) => [id, 'viewer']),
      ]
      for (const [socketId, memberRole] of recipients) {
        const recipient = connectedSockets.get(socketId)
        if (!recipient || !isCurrentRecipient(recipient, roomId, memberRole)) continue
        const current = liveRooms.getRoomState(roomId)
        if (
          current !== roomState ||
          current.presentationGeneration !== generation ||
          current.presentationId !== presentation.id ||
          current.presenterId !== presenterId
        )
          return
        emitPresentationPayload(recipient, presentation, memberRole, generation)
        recipient.emit('sync-state', roomState.state)
      }
    }

    onPayload(
      'join-room',
      async ({ roomId, role, presentationId, presenterToken, capability } = {}) => {
        const roomBeforeJoin = liveRooms.getRoomState(roomId)
        const presenterWasDisconnected =
          role === 'presenter' &&
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
              message:
                joinResult.error === 'already-joined-room'
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
              emitRoomPresentation(roomId, pres, roomState, presenterLoadGeneration, socket.id)
            }
          } catch (err) {
            logger.error('Failed to load presentation for live room', err)
          }
        }

        // On presenter (re)connect, re-arm any running timers. leaveRoom cleared
        // their timeouts on disconnect but left the running timer state intact, so
        // a mid-countdown reconnect must reschedule timer:ended at the remaining time.
        if (role === 'presenter') {
          const roomState = liveRooms.getRoomState(roomId)
          const stillJoined = isCurrentRecipient(socket, roomId, role)
          const presenterJoinIsCurrent =
            roomState === joinedRoom &&
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
                const pres = await findById(expectedPresentationId)
                const current = liveRooms.getRoomState(roomId)
                if (
                  pres &&
                  current === state &&
                  current.presentationGeneration === expectedGeneration &&
                  current.presentationId === expectedPresentationId &&
                  current.presenterId === expectedPresenterId &&
                  isCurrentRecipient(socket, roomId, payloadRole)
                ) {
                  emitPresentationPayload(socket, pres, payloadRole, expectedGeneration)
                }
              } catch {
                /* ignore */
              }
            }
          }
        }

        // Do not finish a stale async join against a removed/recreated room, a
        // disconnected socket, or a presenter that has since been replaced.
        const room = liveRooms.getRoomState(roomId)
        const stillJoined = isCurrentRecipient(socket, roomId, role)
        const stillAuthoritative = role !== 'presenter' || room?.presenterId === socket.id
        if (
          room !== joinedRoom ||
          room?.presentationGeneration !== joinedGeneration ||
          !stillJoined ||
          !stillAuthoritative
        )
          return

        broadcastViewerCount(roomId)

        // Send annotations:sync to all joining clients (presenter and viewers)
        socket.emit('annotations:sync', { slideAnnotations: room.annotations || {} })

        // Send timer state to joining clients (for Phase 2)
        for (const timer of Object.values(room.timers || {})) {
          socket.emit('timer:sync', timerSnapshot(timer))
        }
      }
    )

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
          : Number(verticalIndex)
            ? `${slideIndex}:${verticalIndex}`
            : String(slideIndex)
        socket.to(socket.data.roomId).emit(
          'annotations:sync',
          withVerticalIndex(
            {
              slideIndex,
              annotations: room?.annotations?.[annotationKey] || [],
            },
            verticalIndex
          )
        )
      }
    })
    onPayload('control-navigate', ({ slideIndex, verticalIndex = 0, fragmentIndex = 0 } = {}) => {
      const roomState = liveRooms.getRoomState(socket.data.roomId)
      const legacyController =
        roomState?.legacyRoleAliases && liveRooms.getRoleForSocket?.(socket.id) === 'controller'
      if (
        !roomState ||
        (!legacyController && !liveRooms.canNavigateRoom(socket.data.roomId, socket.id))
      )
        return
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
        id:
          typeof annotation.id === 'string' && annotation.id.length > 0
            ? annotation.id
            : crypto.randomUUID(),
        createdAt: annotation.createdAt || new Date().toISOString(),
        createdBy: 'presenter',
      }

      const room = liveRooms.getRoomState(roomId)
      const annotationKey = liveRooms.getAnnotationKey
        ? liveRooms.getAnnotationKey(target.slideIndex, target.verticalIndex)
        : target.verticalIndex
          ? `${target.slideIndex}:${target.verticalIndex}`
          : String(target.slideIndex)
      if (!room.annotations[annotationKey]) room.annotations[annotationKey] = []
      room.annotations[annotationKey].push(fullAnnotation)

      io.to(roomId).emit(
        'annotation:add',
        withVerticalIndex(
          { slideIndex: target.slideIndex, annotation: fullAnnotation },
          target.verticalIndex
        )
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
        : target.verticalIndex
          ? `${target.slideIndex}:${target.verticalIndex}`
          : String(target.slideIndex)
      if (!room.annotations[annotationKey]) return
      room.annotations[annotationKey] = room.annotations[annotationKey].filter(
        (a) => a.id !== annotationId
      )
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
        : target.verticalIndex
          ? `${target.slideIndex}:${target.verticalIndex}`
          : String(target.slideIndex)
      room.annotations[annotationKey] = []
      io.to(roomId).emit(
        'annotation:cleared',
        withVerticalIndex({ slideIndex: target.slideIndex }, target.verticalIndex)
      )
    })

    setupTimerHandlers(socket, io, liveRooms, onPayload)

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
