const { readLiveEnvelope, createLiveCommand, acceptLiveSnapshot } = require('../live-round-state')
const commands = Object.freeze({
  'name-picker': { pick: 'game-random', spin: 'game-random', random: 'game-random' },
  'hot-potato': {
    start: 'game-next',
    next: 'game-next',
    nextQuestion: 'game-next',
    reveal: 'game-quiz-reveal',
  },
  quiz: {
    start: 'game-next',
    next: 'game-next',
    nextQuestion: 'game-next',
    reveal: 'game-quiz-reveal',
  },
  poll: {
    start: 'game-poll-start',
    startPoll: 'game-poll-start',
    reveal: 'game-poll-reveal',
    refreshResults: 'game-poll-reveal',
  },
  'word-cloud': {
    start: 'game-word-cloud-start',
    startWordCloud: 'game-word-cloud-start',
    reveal: 'game-word-cloud-reveal',
    refreshWordCloud: 'game-word-cloud-reveal',
    clear: 'game-word-cloud-clear',
  },
  matching: {
    start: 'game-matching-start',
    startMatching: 'game-matching-start',
    reveal: 'game-matching-reveal',
    revealMatching: 'game-matching-reveal',
  },
  'four-corners': {
    start: 'game-fourcorners-start',
    next: 'game-fourcorners-start',
    reveal: 'game-fourcorners-reveal',
  },
  'relay-race': { start: 'game-relay-start', next: 'game-relay-next', pass: 'game-relay-next' },
  'trivia-champ': {
    start: 'game-trivia-start',
    next: 'game-trivia-next',
    reveal: 'game-trivia-reveal',
    bonus: 'game-trivia-bonus',
  },
  scattergories: {
    start: 'game-scatter-start',
    reveal: 'game-scatter-reveal',
    adjudicate: 'game-scatter-adjudicate',
  },
  jeopardy: {
    select: 'game-jeopardy-select',
    wager: 'game-jeopardy-wager',
    reveal: 'game-jeopardy-reveal',
    adjudicate: 'game-jeopardy-adjudicate',
  },
})
const timerEvents = Object.freeze({
  startTimer: 'game-timer-start',
  pauseGame: 'game-timer-pause',
  resumeTimer: 'game-timer-resume',
  stopTimer: 'game-timer-stop',
  addTime: 'game-timer-adjust',
  subTime: 'game-timer-adjust',
})
function eventFor(gameType, action) {
  if (action === 'end') return 'game-end'
  if (action === 'reset' || action === 'replay') return 'game-reset'
  if (action === 'assignTeam') return 'game-team-assign'
  return commands[gameType]?.[action] || null
}
function isHostCommandSupported(gameType, command) {
  return Boolean(eventFor(gameType, command?.action) || timerEvents[command?.action])
}
function dispatchHostCommand(binding, session, command, presenterSocket) {
  if (
    !binding ||
    !session ||
    !isHostCommandSupported(binding.gameType, command) ||
    (command?.gameType && command.gameType !== binding.gameType)
  )
    return false
  const timerEvent = timerEvents[command.action]
  if (timerEvent) {
    if (!presenterSocket?.connected || session.getState().connection !== 'connected') return false
    const payload = { elementId: binding.elementId, effectiveSlideId: binding.effectiveSlideId }
    if (timerEvent === 'game-timer-start') payload.duration = command.duration
    if (timerEvent === 'game-timer-adjust') payload.delta = command.delta
    presenterSocket.emit(timerEvent, payload)
    return true
  }
  const { action, gameType, elementId, effectiveSlideId, ...fields } = command
  return session.dispatch(eventFor(binding.gameType, action), fields)
}
function createLiveHostBridge({
  socket,
  gameId,
  onState = () => {},
  createCommandId = () => globalThis.crypto.randomUUID(),
}) {
  let identity = null,
    state = null,
    host = false,
    destroyed = false,
    connection = 'waiting'
  const retired = new Set(),
    pending = new Set()
  const listeners = [],
    subscriptions = new Set()
  function publish() {
    const snapshot = { connection, state: state || identity || {} }
    onState(snapshot)
    for (const listener of subscriptions) listener(snapshot)
  }
  function listen(event, fn) {
    socket.on(event, fn)
    listeners.push([event, fn])
  }
  listen('connect', () => {
    if (!destroyed) {
      connection = 'waiting'
      host = false
      publish()
    }
  })
  listen('game-session', (data) => {
    const next = readLiveEnvelope(data)
    if (destroyed || data?.gameId !== gameId || !next || retired.has(next.roomInstanceId)) return
    if (
      identity?.roomInstanceId === next.roomInstanceId &&
      (next.generation < identity.generation ||
        (next.generation === identity.generation && next.roundId < identity.roundId))
    )
      return
    if (identity?.roomInstanceId !== next.roomInstanceId) state = null
    identity = next
    host = data.isHost === true
    connection = host ? 'connected' : 'waiting'
    publish()
  })
  listen('game-round-state', (data) => {
    if (
      destroyed ||
      data?.gameId !== gameId ||
      !identity ||
      data.roomInstanceId !== identity.roomInstanceId
    )
      return
    if (
      data.generation < identity.generation ||
      (data.generation === identity.generation && data.roundId < identity.roundId)
    )
      return
    state = acceptLiveSnapshot(state, data)
    identity = readLiveEnvelope(state) || identity
    publish()
  })
  listen('game-command-result', (data) => {
    if (
      destroyed ||
      data?.gameId !== gameId ||
      data.roomInstanceId !== identity?.roomInstanceId ||
      !pending.delete(data.commandId)
    )
      return
    const next = readLiveEnvelope(data)
    if (
      next &&
      (next.generation > identity.generation ||
        (next.generation === identity.generation && next.roundId >= identity.roundId))
    )
      identity = next
    if (!data.accepted && (!state || data.stateVersion >= state.stateVersion)) {
      state = { ...state, commandError: data.error }
      publish()
    }
  })
  listen('disconnect', () => {
    connection = 'disconnected'
    host = false
    pending.clear()
    publish()
  })
  listen('game-error', (data) => {
    if (
      destroyed ||
      (data?.gameId && data.gameId !== gameId) ||
      !['room-not-found', 'invalid-host-capability'].includes(data?.message)
    )
      return
    connection = 'disconnected'
    host = false
    pending.clear()
    publish()
  })
  listen('game-room-expired', (data) => {
    if (data?.gameId !== gameId || data.roomInstanceId !== identity?.roomInstanceId) return
    retired.add(identity.roomInstanceId)
    if (retired.size > 32) retired.delete(retired.values().next().value)
    identity = null
    state = null
    pending.clear()
    connection = 'disconnected'
    host = false
    publish()
  })
  return {
    getState: () => ({ connection, state: state || identity || {} }),
    dispatch(event, payload = {}) {
      if (destroyed || !host || !socket.connected || !identity) return false
      const command = createLiveCommand(identity, createCommandId(), payload)
      if (!command) return false
      pending.add(command.commandId)
      if (pending.size > 128) pending.delete(pending.values().next().value)
      socket.emit(event, command)
      return true
    },
    subscribe(listener) {
      subscriptions.add(listener)
      listener(this.getState())
      return () => subscriptions.delete(listener)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const [event, fn] of listeners) socket.off(event, fn)
      subscriptions.clear()
      pending.clear()
    },
  }
}
module.exports = { createLiveHostBridge, dispatchHostCommand, isHostCommandSupported, eventFor }
