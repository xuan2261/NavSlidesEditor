const { createRuntimeSession } = require('../runtime-session.js')
const { normalizeGameConfig } = require('../normalize-game-config.js')
const { validateGameConfig } = require('../game-schema.js')
const { validatePublicGameConfig } = require('../game-public-validation.js')
const { throwInvalid } = require('../game-validation-utils.js')
const { createLocalActivity } = require('./local-activity.js')
const { GAME_CATALOG } = require('../game-registry.js')
const { getDocumentVariables } = require('./document-variables.js')
const { presentLiveObserver, subscribeLive } = require('./live-transport.js')
const { presentLiveHost } = require('./live-host-presenter.js')
const instances = new WeakMap()
const hostBindings = new WeakMap()
function bindHostRoot(root, binding) {
  if (binding) {
    hostBindings.set(root, binding)
    root.dataset.nsTransportGameId = binding.transportGameId
  } else {
    hostBindings.delete(root)
    delete root.dataset.nsTransportGameId
  }
}
function getRootLifecycle(root) {
  return instances.get(root)?.lifecycle
}
function mount(root, { mode = 'local', transport, clock, random, variables } = {}) {
  const existing = instances.get(root)
  if (existing) return existing.api
  if (!root?.matches('[data-ns-game]')) throw new Error('Provide an education game root')
  const type = root.dataset.nsGameType,
    host = hostBindings.get(root)
  const liveEligible = GAME_CATALOG[type]?.runtimeCapabilities.live === true
  const audience = liveEligible && root.dataset.nsEducationView === 'audience' && !host
  const runtimeMode = liveEligible && (audience || mode === 'live' || host) ? 'live' : 'local'
  const raw = host?.config || JSON.parse(root.querySelector('[data-ns-game-config]').textContent)
  const config = audience ? raw : normalizeGameConfig({ gameType: type, [type]: raw })
  throwInvalid(
    (audience ? validatePublicGameConfig(type, config) : validateGameConfig(type, config)).errors
  )
  const activity = runtimeMode === 'local' ? createLocalActivity(type, config, { random }) : null
  const store = variables || getDocumentVariables(root.ownerDocument)
  let presenter,
    alive = true,
    paused = false
  const initial =
    runtimeMode === 'local'
      ? (activeClock) => ({ ...activity.initial(activeClock), runtimeMode })
      : () => ({ runtimeMode, connection: 'waiting', state: null })
  const reducer =
    runtimeMode === 'local'
      ? activity.reduce
      : (state, command) =>
          command.type === 'transport'
            ? {
                ...state,
                ...(command.connection === undefined ? {} : { connection: command.connection }),
                ...(command.state === undefined ? {} : { state: command.state }),
              }
            : state
  const session = createRuntimeSession(initial, reducer, {
    clock,
    pauseOnHide: runtimeMode === 'local',
    onState: (state) => presenter?.render(state),
  })
  const staticView = root.querySelector('[data-ns-game-static]')
  function install() {
    const context = {
      root,
      config,
      session,
      reset,
      clock: session.clock,
      random,
      transport,
      runtimeMode,
      variables: store,
    }
    presenter =
      runtimeMode === 'local'
        ? activity.present(context)
        : host
          ? presentLiveHost(context)
          : presentLiveObserver(context)
    presenter.render(session.getState())
    if (runtimeMode === 'live') subscribeLive(session, root, transport)
    if (staticView) staticView.hidden = true
  }
  function reset() {
    if (!alive) return
    const focused = root.contains(root.ownerDocument.activeElement)
      ? root.ownerDocument.activeElement.dataset.nsCommand
      : null
    presenter = null
    session.reset()
    install()
    if (focused)
      [...root.querySelectorAll('[data-ns-command]')]
        .find((control) => control.dataset.nsCommand === focused)
        ?.focus()
  }
  function destroy() {
    if (!alive) return
    alive = false
    try {
      session.destroy()
    } finally {
      instances.delete(root)
      bindHostRoot(root, null)
      if (staticView) staticView.hidden = false
      root.classList.remove('ns-education-paused')
    }
  }
  const api = { getState: session.getState, reset, destroy }
  const lifecycle = {
    pause: () => {
      if (!alive || paused) return
      paused = true
      presenter?.pause?.()
      session.pause()
      if (runtimeMode === 'local') root.classList.add('ns-education-paused')
    },
    resume: () => {
      if (!alive || !paused) return
      paused = false
      session.resume()
      presenter?.resume?.()
      root.classList.remove('ns-education-paused')
    },
  }
  instances.set(root, { api, lifecycle })
  try {
    install()
  } catch (error) {
    destroy()
    throw error
  }
  return api
}
module.exports = { mount, getRootLifecycle, bindHostRoot }
