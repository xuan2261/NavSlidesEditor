const { inspectHostBindings } = require('./live-host-bindings.js')
const { gameInstanceKey } = require('../effective-slide-identity.js')
const { createLiveHostRoomSession } = require('./live-host-room-session.js')
const { dispatchHostCommand, isHostCommandSupported } = require('./live-host-bridge.js')
const { readHostCapabilities, saveHostCapabilities } = require('./live-host-capabilities.js')
function createLiveHostTransport(window) {
  const document = window.document,
    presentationId = document.documentElement.dataset.nsPresentationId
  const roomCode = new URLSearchParams(window.location.search).get('live')
  if (!roomCode) return undefined
  let presenterToken = ''
  try {
    const context = JSON.parse(window.name || '{}')
    if (context.roomCode === roomCode) presenterToken = context.presenterToken || ''
  } catch {
    /* An unauthenticated shell remains read-only. */
  }
  const subscriptions = new Map(),
    sessions = new Map(),
    pendingCommands = new Map(),
    timers = new Map()
  const rootKeys = new Set(
    Array.from(document.querySelectorAll('[data-ns-game]'), (root) =>
      gameInstanceKey({
        effectiveSlideId: root.closest('[data-ns-effective-slide-id]')?.dataset.nsEffectiveSlideId,
        elementId: root.dataset.nsElementId,
      })
    )
  )
  const capabilities = readHostCapabilities(window, presentationId, roomCode)
  let bindings = new Map(),
    bindingListener,
    generation,
    allocationGeneration,
    presenterSocket,
    epoch = 0,
    retryTimer,
    destroyed = false,
    connection = 'waiting',
    detachTimers
  function snapshotFor(key, snapshot) {
    return timers.has(key)
      ? { ...snapshot, state: { ...snapshot.state, timer: timers.get(key) } }
      : snapshot
  }
  function notify(tuple, snapshot) {
    for (const listener of subscriptions.get(tuple) || []) listener(snapshotFor(tuple, snapshot))
  }
  function attachTimers(socket) {
    detachTimers?.()
    let active = true
    const publish = (data, ended = false) => {
      const key = gameInstanceKey(data)
      if (
        !active ||
        destroyed ||
        presenterSocket !== socket ||
        !socket.connected ||
        !key ||
        !rootKeys.has(key)
      )
        return
      timers.set(
        key,
        ended ? { ...timers.get(key), ...data, running: false, remaining: 0, endedAt: null } : data
      )
      const binding = bindings.get(key)
      if (binding) notify(key, sessions.get(binding.transportGameId)?.getState() || { connection })
    }
    const sync = (data) => publish(data),
      ended = (data) => publish(data, true)
    socket.on('timer:sync', sync)
    socket.on('timer:ended', ended)
    detachTimers = () => {
      active = false
      socket.off('timer:sync', sync)
      socket.off('timer:ended', ended)
    }
  }
  function notifyOpener(type, extra = {}) {
    if (!window.opener || window.opener.closed) return
    window.opener.postMessage({ type, presentationId, roomCode, ...extra }, window.location.origin)
  }
  function publishBindings() {
    bindingListener?.()
    notifyOpener('navslides:game-bindings', {
      games: [...bindings.values()].map(({ config, ...mapping }) => mapping),
    })
  }
  function revoke(status = 'disconnected') {
    connection = status
    epoch++
    window.clearTimeout(retryTimer)
    detachTimers?.()
    detachTimers = undefined
    timers.clear()
    for (const session of sessions.values()) session.destroy()
    sessions.clear()
    bindings.clear()
    pendingCommands.clear()
    publishBindings()
    for (const key of subscriptions.keys()) notify(key, { connection })
  }
  function dispatch(tuple, command) {
    const key = gameInstanceKey(tuple),
      binding = bindings.get(key)
    return dispatchHostCommand(
      binding,
      sessions.get(binding?.transportGameId),
      command,
      presenterSocket
    )
  }
  function drain(key) {
    const queue = pendingCommands.get(key)
    if (!queue) return
    const [effectiveSlideId, elementId] = JSON.parse(key)
    while (queue.length) {
      const binding = bindings.get(key),
        command = queue[0]
      if (!binding) break
      if (
        command.gameType !== binding.gameType ||
        !isHostCommandSupported(binding.gameType, command)
      ) {
        queue.shift()
        continue
      }
      queue.shift()
      if (!dispatch({ effectiveSlideId, elementId }, command)) {
        queue.unshift(command)
        break
      }
    }
    if (!queue.length) pendingCommands.delete(key)
  }
  function message(event) {
    const data = event.data
    if (
      event.origin !== window.location.origin ||
      event.source !== window.opener ||
      data?.type !== 'navslides:game-shortcut' ||
      data.presentationId !== presentationId ||
      data.roomCode !== roomCode
    )
      return
    const command = data.detail
    if (
      typeof command?.effectiveSlideId !== 'string' ||
      typeof command.elementId !== 'string' ||
      typeof command.action !== 'string' ||
      typeof command.gameType !== 'string'
    )
      return
    if (!isHostCommandSupported(command.gameType, command)) return
    const key = gameInstanceKey(command),
      binding = bindings.get(key)
    if (!key) return
    if (binding && command.gameType !== binding.gameType) return
    if (dispatch(command, command)) return
    const queue = pendingCommands.get(key) || []
    if (queue.length >= 20 || (!pendingCommands.has(key) && pendingCommands.size >= 20)) return
    queue.push({ ...command })
    pendingCommands.set(key, queue)
  }
  function presentationReady(data, socket) {
    if (
      destroyed ||
      !presenterToken ||
      data?.presentationId !== presentationId ||
      !Number.isInteger(data.presentationGeneration)
    ) {
      revoke()
      return
    }
    presenterSocket = socket
    generation = data.presentationGeneration
    connection = 'waiting'
    attachTimers(socket)
    const expected = ++epoch
    window.clearTimeout(retryTimer)
    let attempt = 0
    async function request() {
      if (destroyed || expected !== epoch || !presenterSocket?.connected) return
      attempt++
      try {
        const response = await window.fetch(
          `/api/presentations/${encodeURIComponent(presentationId)}/present/game-bootstrap`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({ roomCode, presenterToken, hostCapabilities: capabilities }),
          }
        )
        const payload = await response.json()
        if (destroyed || expected !== epoch || !presenterSocket?.connected) return
        if (!response.ok) {
          if ([409, 503].includes(response.status) && attempt < 5)
            retryTimer = window.setTimeout(request, Math.min(500 * attempt, 2500))
          else revoke()
          return
        }
        const next = inspectHostBindings(document, payload, generation)
        if (!next) {
          revoke()
          return
        }
        const ids = new Set([...next.values()].map((binding) => binding.transportGameId))
        if (allocationGeneration && allocationGeneration !== payload.allocationGeneration)
          pendingCommands.clear()
        allocationGeneration = payload.allocationGeneration
        for (const [id, session] of sessions)
          if (!ids.has(id)) {
            session.destroy()
            sessions.delete(id)
          }
        for (const id of Object.keys(capabilities)) if (!ids.has(id)) delete capabilities[id]
        for (const game of payload.games) capabilities[game.transportGameId] = game.hostCapability
        saveHostCapabilities(window, presentationId, roomCode, capabilities)
        bindings = next
        publishBindings()
        for (const game of payload.games) {
          const key = gameInstanceKey(game)
          if (!sessions.has(game.transportGameId))
            sessions.set(
              game.transportGameId,
              createLiveHostRoomSession(
                window,
                game,
                presentationId,
                (snapshot) => {
                  notify(key, snapshot)
                  if (snapshot.connection === 'connected') drain(key)
                },
                () => presentationReady(data, socket)
              )
            )
          else sessions.get(game.transportGameId).refresh(game)
          const snapshot = sessions.get(game.transportGameId).getState()
          notify(key, snapshot)
          if (snapshot.connection === 'connected') drain(key)
        }
      } catch (error) {
        if (destroyed || expected !== epoch) return
        if (attempt < 5) retryTimer = window.setTimeout(request, Math.min(500 * attempt, 2500))
        else revoke()
      }
    }
    request()
  }
  function destroy() {
    if (destroyed) return
    destroyed = true
    notifyOpener('navslides:presenter-unready')
    revoke()
    window.removeEventListener('message', message)
    window.removeEventListener('beforeunload', destroy)
    pendingCommands.clear()
    subscriptions.clear()
    bindingListener = undefined
  }
  window.addEventListener('message', message)
  window.addEventListener('beforeunload', destroy)
  notifyOpener('navslides:presenter-ready')
  return {
    presentationReady,
    disconnect: revoke,
    destroy,
    dispatch,
    getHostBinding: (tuple) => bindings.get(gameInstanceKey(tuple)),
    onBindingsChanged(listener) {
      bindingListener = listener
      return () => {
        if (bindingListener === listener) bindingListener = undefined
      }
    },
    subscribe(tuple, listener) {
      const key = gameInstanceKey(tuple),
        listeners = subscriptions.get(key) || new Set()
      listeners.add(listener)
      subscriptions.set(key, listeners)
      const binding = bindings.get(key)
      listener(
        snapshotFor(key, sessions.get(binding?.transportGameId)?.getState() || { connection })
      )
      return () => {
        listeners.delete(listener)
        if (!listeners.size) subscriptions.delete(key)
      }
    },
  }
}
module.exports = { createLiveHostTransport }
