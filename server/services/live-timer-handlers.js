const { gameInstanceKey } = require('revealjs-shared')

function timerSnapshot(timer, now = Date.now()) {
  const { effectiveSlideId, elementId, duration, running, endedAt, pausedRemaining } = timer
  return {
    effectiveSlideId,
    elementId,
    duration,
    running,
    endedAt,
    pausedRemaining,
    remaining:
      running && endedAt != null
        ? Math.max(0, Math.ceil((endedAt - now) / 1000))
        : (pausedRemaining ?? duration),
  }
}
function emitTimerEnd(roomId, timer, io) {
  timer.running = false
  timer.pausedRemaining = 0
  timer.endedAt = null
  io.to(roomId).emit('timer:sync', timerSnapshot(timer))
  io.to(roomId).emit('timer:ended', {
    effectiveSlideId: timer.effectiveSlideId,
    elementId: timer.elementId,
  })
}
function armTimerEnd(roomId, key, timers, timerTimeouts, io) {
  const timer = timers[key],
    now = Date.now()
  if (!timer?.running || timer.endedAt == null) return null
  const deadline = timer.endedAt,
    remaining = deadline - now
  if (remaining <= 0) {
    if (timerTimeouts[key]) clearTimeout(timerTimeouts[key])
    delete timerTimeouts[key]
    emitTimerEnd(roomId, timer, io)
    return null
  }
  const timeout = setTimeout(() => {
    if (timerTimeouts[key] !== timeout) return
    delete timerTimeouts[key]
    if (timers[key] === timer && timer.running && timer.endedAt === deadline)
      emitTimerEnd(roomId, timer, io)
  }, remaining)
  return timeout
}
function clearTimerTimeout(room, key) {
  if (room.timerTimeouts[key]) clearTimeout(room.timerTimeouts[key])
  delete room.timerTimeouts[key]
}
function setupTimerHandlers(socket, io, liveRooms, onPayload) {
  for (const action of ['start', 'pause', 'resume', 'adjust', 'stop']) {
    onPayload(`game-timer-${action}`, (payload) => {
      const key = gameInstanceKey(payload)
      if (!key) return
      const roomId = liveRooms.getRoomForSocket(socket.id)
      if (!roomId || !liveRooms.canControlTimer(roomId, socket.id)) return
      const room = liveRooms.getRoomState(roomId)
      if (!room) return
      let timer = room.timers[key]
      if (action === 'start') {
        const duration = Number(payload.duration)
        if (!Number.isFinite(duration) || duration < 1 || duration > 7200) return
        clearTimerTimeout(room, key)
        timer = room.timers[key] = {
          effectiveSlideId: payload.effectiveSlideId,
          elementId: payload.elementId,
          duration,
          endedAt: Date.now() + duration * 1000,
          pausedAt: null,
          pausedRemaining: null,
          running: true,
        }
        room.timerTimeouts[key] = armTimerEnd(roomId, key, room.timers, room.timerTimeouts, io)
      } else if (action === 'stop') {
        clearTimerTimeout(room, key)
        delete room.timers[key]
        io.to(roomId).emit('timer:sync', {
          effectiveSlideId: payload.effectiveSlideId,
          elementId: payload.elementId,
          remaining: 0,
          duration: 0,
          running: false,
          endedAt: null,
          pausedRemaining: 0,
        })
        return
      } else {
        if (!timer) return
        if (action === 'pause') {
          if (!timer.running) return
          const now = Date.now()
          timer.pausedRemaining = Math.max(0, Math.ceil((timer.endedAt - now) / 1000))
          timer.running = false
          timer.pausedAt = now
          timer.endedAt = null
          clearTimerTimeout(room, key)
        } else if (action === 'resume') {
          if (timer.running || timer.pausedRemaining == null) return
          timer.endedAt = Date.now() + timer.pausedRemaining * 1000
          timer.pausedRemaining = null
          timer.pausedAt = null
          timer.running = true
          room.timerTimeouts[key] = armTimerEnd(roomId, key, room.timers, room.timerTimeouts, io)
          if (!timer.running) return
        } else {
          const delta = Number(payload.delta)
          if (!Number.isFinite(delta) || Math.abs(delta) > 3600) return
          if (timer.running)
            timer.endedAt = Math.max(Date.now() + 1000, timer.endedAt + delta * 1000)
          else if (timer.pausedRemaining != null)
            timer.pausedRemaining = Math.max(0, timer.pausedRemaining + delta)
          timer.duration = Math.max(1, timer.duration + delta)
          if (timer.running) {
            clearTimerTimeout(room, key)
            room.timerTimeouts[key] = armTimerEnd(roomId, key, room.timers, room.timerTimeouts, io)
          }
        }
      }
      io.to(roomId).emit('timer:sync', timerSnapshot(timer))
    })
  }
}
module.exports = { armTimerEnd, timerSnapshot, setupTimerHandlers }
