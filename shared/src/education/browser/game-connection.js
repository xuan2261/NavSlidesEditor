const { createLivePlayerState, reduceLivePlayerState } = require('../live-player-state.js')
const { createGameSessionStorage } = require('./game-session-storage.js')
const bootstrapRequests = new Map()
let sequence = 0
function randomId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `ns-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`
  )
}
const events = [
  'game-session',
  'game-round-state',
  'game-command-result',
  'game-answer-result',
  'game-error',
  'game-room-expired',
  'game-player-joined',
  'game-player-left',
  'game-leaderboard',
  'game-ended',
  'game-random-result',
  'game-poll-started',
  'game-poll-results',
  'game-poll-vote-accepted',
  'game-word-cloud-started',
  'game-word-cloud-results',
  'game-word-cloud-submit-accepted',
  'game-matching-started',
  'game-matching-results',
  'game-matching-submit-accepted',
]
function createGameConnection({
  socket,
  owned = true,
  gameId,
  playerName,
  role = 'player',
  options = {},
  storage,
  sessionStorage,
  fetch: fetcher = globalThis.fetch,
  id = randomId,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  if (!socket || !gameId) throw new TypeError('A socket and gameId are required')
  const persistence = createGameSessionStorage({
    storage,
    sessionStorage,
    role,
    gameId,
    randomId: id,
  })
  let state = {
    ...createLivePlayerState(gameId),
    playerId: persistence.playerId,
    readOnly: role === 'observer',
  }
  const subscribers = new Set(),
    listeners = []
  let released = false,
    disconnected = false,
    retryTimer = null,
    retries = 0
  let retainedCommand = null,
    recovering = false,
    recoverySession = false
  let capability = role === 'host' ? options.hostCapability || persistence.getCapability() : null
  if (capability) persistence.setCapability(capability)
  function publish(event, data) {
    if (released) return
    const next = reduceLivePlayerState(state, event, data)
    if (next === state) return
    state = { ...next, readOnly: role === 'observer' }
    if (
      retainedCommand &&
      (!state.pending ||
        state.pending.commandId !== retainedCommand.payload.commandId ||
        state.roomInstanceId !== retainedCommand.payload.roomInstanceId ||
        state.generation !== retainedCommand.payload.generation ||
        state.roundId !== retainedCommand.payload.roundId)
    ) {
      retainedCommand = null
      recovering = false
      recoverySession = false
    }
    subscribers.forEach((fn) => fn(state))
  }
  function on(event, callback) {
    socket.on(event, callback)
    listeners.push([event, callback])
  }
  async function bootstrap() {
    if (role !== 'host' || !options.gameType) return
    let request = bootstrapRequests.get(gameId)
    if (!request) {
      request = (async () => {
        const limit = Number.isInteger(options.maxHostBootstrapRetries)
          ? options.maxHostBootstrapRetries
          : 3
        for (let attempt = 0; ; attempt++) {
          try {
            const response = await fetcher('/api/games', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                gameId,
                gameType: options.gameType,
                options: options.options || {},
                ...(capability ? { hostCapability: capability } : {}),
              }),
            })
            if (!response.ok) throw new Error('host-room-create-failed')
            const result = await response.json()
            if (!result || (typeof result.hostCapability !== 'string' && !capability))
              throw new Error('host-capability-required')
            return result
          } catch (error) {
            if (attempt >= limit) throw error
          }
        }
      })()
      bootstrapRequests.set(gameId, request)
      request.then(
        () => bootstrapRequests.delete(gameId),
        () => bootstrapRequests.delete(gameId)
      )
    }
    const result = await request
    if (released) return
    if (typeof result.hostCapability === 'string' && result.hostCapability) {
      capability = result.hostCapability
      persistence.setCapability(capability)
    }
  }
  async function join() {
    try {
      await bootstrap()
      if (released || !socket.connected) return
      socket.emit('game-join', {
        gameId,
        playerName,
        playerId: persistence.playerId,
        role,
        ...(persistence.getToken() ? { sessionToken: persistence.getToken() } : {}),
        ...(capability ? { hostCapability: capability } : {}),
      })
    } catch (error) {
      publish('game-error', { message: error.message || 'Join failed' })
    }
  }
  function retry(data) {
    const limit = Number.isInteger(options.maxRoomNotFoundRetries)
      ? Math.max(0, options.maxRoomNotFoundRetries)
      : 5
    if (
      !owned ||
      !options.retryOnRoomNotFound ||
      retryTimer ||
      retries >= limit ||
      !['room-not-found', 'room-expired'].includes(data.message || data.error)
    )
      return
    retries++
    retryTimer = schedule(() => {
      retryTimer = null
      if (!released && socket.connected) join()
    }, 1000)
  }
  on('connect', () => {
    recoverySession = false
    publish('connect')
    if (owned) join()
  })
  on('disconnect', () => {
    recovering = !!retainedCommand && !retainedCommand.replayed
    recoverySession = false
    publish('disconnect')
  })
  on('connect_error', (error) => publish('connect_error', error))
  for (const event of events)
    on(event, (data = {}) => {
      if (released) return
      if (
        event === 'game-session' &&
        (data.gameId !== gameId ||
          (owned && role !== 'observer' && data.playerId !== persistence.playerId))
      )
        return
      if (
        event === 'game-session' &&
        data.gameId === gameId &&
        data.playerId === persistence.playerId
      )
        persistence.setToken(data.sessionToken)
      const previous = state
      publish(event, data)
      // Only an authenticated reconnect can arm one replay; peer snapshots cannot.
      if (
        event === 'game-session' &&
        state !== previous &&
        data.playerId === persistence.playerId &&
        typeof data.sessionToken === 'string' &&
        data.sessionToken.length > 0
      )
        recoverySession = recovering
      if (
        event === 'game-round-state' &&
        state !== previous &&
        state.hydrated &&
        !state.error &&
        recoverySession
      ) {
        recovering = false
        recoverySession = false
        if (retainedCommand && !retainedCommand.replayed && state.pending) {
          retainedCommand.replayed = true
          socket.emit(retainedCommand.event, retainedCommand.payload)
        }
      }
      if (event === 'game-error') retry(data)
      if (event === 'game-room-expired') retry({ message: 'room-expired' })
      if (event === 'game-round-state' && state.hydrated) {
        retries = 0
        if (retryTimer) {
          cancel(retryTimer)
          retryTimer = null
        }
      }
    })
  if (owned && socket.connected) join()
  return {
    socket,
    playerId: persistence.playerId,
    getSnapshot: () => state,
    subscribe: (fn) => {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
    setDraft: (draft) => publish('draft', draft),
    emit(event, payload = {}) {
      if (
        released ||
        role === 'observer' ||
        !state.connected ||
        !state.hydrated ||
        state.pending ||
        !/^game-/.test(event)
      )
        return false
      const commandId = id(),
        envelope = {
          gameId,
          roomInstanceId: state.roomInstanceId,
          generation: state.generation,
          roundId: state.roundId,
          commandId,
        }
      const body = { ...payload }
      delete body.sessionToken
      delete body.hostCapability
      if (event !== 'game-team-assign') delete body.playerId
      const answer = /-answer$/.test(event)
        ? { ...body, questionId: state.question?.id, attemptId: id() }
        : body
      if (event === 'game-answer' && state.gameType === 'hot-potato') {
        answer.answerIndex =
          state.question?.options?.findIndex((option) => option.id === body.answer?.optionId) ?? -1
        delete answer.answer
      }
      const command = structuredClone({ ...answer, ...envelope })
      retainedCommand = { event, payload: command, replayed: false }
      publish('pending', { commandId, attemptId: answer.attemptId, event })
      socket.emit(event, command)
      return true
    },
    release() {
      if (released) return
      released = true
      retainedCommand = null
      recovering = false
      recoverySession = false
      if (retryTimer) cancel(retryTimer)
      for (const [event, callback] of listeners) socket.off?.(event, callback)
      subscribers.clear()
      if (owned && !disconnected) {
        disconnected = true
        socket.disconnect()
      }
    },
  }
}
module.exports = { createGameConnection }
