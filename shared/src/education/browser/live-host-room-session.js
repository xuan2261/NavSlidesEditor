const { createLiveHostBridge } = require('./live-host-bridge.js')
const { isLiveId, readLiveEnvelope } = require('../live-round-state.js')
function createLiveHostRoomSession(window, game, presentationId, onState, onExpired) {
  const id = game.transportGameId,
    key = `navslides-game-host-state:${presentationId}:${id}`
  const stored = (() => {
    try {
      return JSON.parse(window.sessionStorage.getItem(key)) || {}
    } catch {
      return {}
    }
  })()
  const playerId =
    isLiveId(stored.playerId) && stored.playerId !== `presenter-${id}`
      ? stored.playerId
      : `presenter-host-${window.crypto.randomUUID()}`
  let sessionToken =
    playerId === stored.playerId && typeof stored.sessionToken === 'string'
      ? stored.sessionToken
      : ''
  let current = game,
    identity,
    expired = false,
    destroyed = false
  const socket = window.io('/games', { path: '/ws', reconnection: true }),
    listeners = []
  const bridge = createLiveHostBridge({
    socket,
    gameId: id,
    createCommandId: () => window.crypto.randomUUID(),
    onState: (snapshot) => {
      if (!destroyed) onState(snapshot)
    },
  })
  function listen(event, listener) {
    socket.on(event, listener)
    listeners.push([event, listener])
  }
  function save() {
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ playerId, sessionToken }))
    } catch {
      /* Storage is optional; server authority stays in this session. */
    }
  }
  function join() {
    if (destroyed || expired || !socket.connected) return
    socket.emit('game-join', {
      gameId: id,
      playerName: 'Presenter',
      playerId,
      role: 'host',
      gameType: current.gameType,
      hostCapability: current.hostCapability,
      ...(sessionToken ? { sessionToken } : {}),
    })
  }
  function expire() {
    if (destroyed || expired) return
    expired = true
    onExpired()
  }
  listen('connect', join)
  listen('game-session', (data) => {
    const next = readLiveEnvelope(data)
    if (
      destroyed ||
      !next ||
      next.gameId !== id ||
      data.playerId !== playerId ||
      data.isHost !== true ||
      typeof data.sessionToken !== 'string' ||
      !data.sessionToken
    )
      return
    identity = next
    sessionToken = data.sessionToken
    save()
  })
  listen('game-error', (data) => {
    if ((!data?.gameId || data.gameId === id) && data?.message === 'room-not-found') expire()
  })
  listen('game-room-expired', (data) => {
    if (data?.gameId === id && identity && data.roomInstanceId === identity.roomInstanceId) expire()
  })
  save()
  join()
  return {
    getState: bridge.getState,
    dispatch: bridge.dispatch,
    refresh(next) {
      const rejoin = expired || next.hostCapability !== current.hostCapability
      current = next
      if (rejoin) {
        expired = false
        join()
      }
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      bridge.destroy()
      for (const [event, listener] of listeners) socket.off(event, listener)
      socket.disconnect()
    },
  }
}
module.exports = { createLiveHostRoomSession }
