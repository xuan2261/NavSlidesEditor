// This self-contained factory is also bundled into the shipped peer and generated host runtime.
function createPluginMessageRuntime() {
  const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
  const tokenPattern = /^[a-f0-9]{32,128}$/
  const plain = (value) =>
    value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
  function json(value, budget = { nodes: 0, bytes: 0 }, depth = 0) {
    if (++budget.nodes > 4096 || depth > 8) return false
    if (value === null || typeof value === 'boolean') return true
    if (typeof value === 'number') return Number.isFinite(value)
    if (typeof value === 'string') {
      budget.bytes += value.length * 2
      return budget.bytes <= 65536
    }
    if (!Array.isArray(value) && !plain(value)) return false
    const keys = Reflect.ownKeys(value).filter((key) => !(Array.isArray(value) && key === 'length'))
    if (
      keys.length > 256 ||
      (Array.isArray(value) &&
        (Object.getPrototypeOf(value) !== Array.prototype || keys.length !== value.length))
    )
      return false
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        typeof key !== 'string' ||
        forbidden.has(key) ||
        !descriptor ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      )
        return false
      if (Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
        return false
      budget.bytes += key.length * 2 + 16
      if (budget.bytes > 65536 || !json(descriptor.value, budget, depth + 1)) return false
    }
    return true
  }
  function validatePluginMessage(message, { direction, instanceToken, documentToken } = {}) {
    if (
      !plain(message) ||
      !json(message) ||
      typeof message.instanceToken !== 'string' ||
      typeof message.documentToken !== 'string' ||
      !tokenPattern.test(message.instanceToken) ||
      !tokenPattern.test(message.documentToken)
    )
      return false
    if (instanceToken !== undefined && message.instanceToken !== instanceToken) return false
    if (documentToken !== undefined && message.documentToken !== documentToken) return false
    const host = direction === 'host'
    if (!host && direction !== 'peer') return false
    if (message.source !== (host ? 'navslides-host' : 'navslides-plugin')) return false
    const payload = host ? ['pluginData', 'size'] : message.type === 'update-data' ? ['patch'] : []
    const allowed = ['source', 'type', 'instanceToken', 'documentToken', ...payload]
    if (
      Object.keys(message).length !== allowed.length ||
      Object.keys(message).some((key) => !allowed.includes(key))
    )
      return false
    if (host) {
      if (
        !['init', 'data-changed'].includes(message.type) ||
        !plain(message.pluginData) ||
        !plain(message.size)
      )
        return false
      if (
        Object.keys(message.size).length !== 2 ||
        !Object.keys(message.size).every((key) => ['width', 'height'].includes(key))
      )
        return false
      return ['width', 'height'].every(
        (key) =>
          Number.isFinite(message.size[key]) && message.size[key] > 0 && message.size[key] <= 100000
      )
    }
    return message.type === 'ready' || (message.type === 'update-data' && plain(message.patch))
  }
  function newToken() {
    const bytes = new Uint8Array(24)
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  function createPluginHostBridge({
    frame,
    hostWindow = globalThis.window,
    pluginData = {},
    size,
    onDataUpdate,
    onReady,
    createToken = newToken,
  }) {
    const instanceToken = createToken()
    let documentToken,
      ready = false,
      destroyed = false
    function send(type) {
      const message = {
        source: 'navslides-host',
        type,
        instanceToken,
        documentToken,
        pluginData,
        size,
      }
      if (!validatePluginMessage(message, { direction: 'host' }))
        throw new TypeError('Invalid plugin host data or size.')
      frame.contentWindow?.postMessage(message, '*')
    }
    const checkData = (data, nextSize) => {
      if (
        !validatePluginMessage(
          {
            source: 'navslides-host',
            type: 'init',
            instanceToken,
            documentToken: instanceToken,
            pluginData: data,
            size: nextSize,
          },
          { direction: 'host' }
        )
      ) {
        throw new TypeError('Invalid plugin host data or size.')
      }
    }
    checkData(pluginData, size)
    const receive = (event) => {
      if (
        destroyed ||
        !documentToken ||
        event.source !== frame.contentWindow ||
        !validatePluginMessage(event.data, { direction: 'peer', instanceToken, documentToken })
      )
        return
      if (event.data.type === 'ready') {
        if (ready) return
        ready = true
        send('data-changed')
        onReady?.()
        return
      }
      if (ready) onDataUpdate?.(event.data.patch)
    }
    hostWindow.addEventListener('message', receive)
    return {
      load() {
        if (destroyed) return
        ready = false
        documentToken = createToken()
        send('init')
      },
      update(data, nextSize = size) {
        if (destroyed) return
        checkData(data, nextSize)
        pluginData = data
        size = nextSize
        if (ready) send('data-changed')
      },
      destroy() {
        destroyed = true
        ready = false
        documentToken = undefined
        hostWindow.removeEventListener('message', receive)
      },
    }
  }
  function createPluginPeerBridge({
    peerWindow = globalThis.window,
    parentWindow = peerWindow.parent,
    onData,
    deferReady = false,
  }) {
    let binding,
      destroyed = false
    const send = (type, fields = {}) => {
      if (!binding || destroyed) return false
      const message = { source: 'navslides-plugin', type, ...binding, ...fields }
      if (!validatePluginMessage(message, { direction: 'peer', ...binding })) return false
      parentWindow.postMessage(message, '*')
      return true
    }
    const receive = (event) => {
      if (
        destroyed ||
        event.source !== parentWindow ||
        !validatePluginMessage(event.data, { direction: 'host', ...binding })
      )
        return
      const message = event.data
      if (!binding) {
        if (message.type !== 'init') return
        binding = { instanceToken: message.instanceToken, documentToken: message.documentToken }
        onData(message.pluginData, message.size)
        if (!deferReady) send('ready')
      } else if (message.type === 'data-changed') onData(message.pluginData, message.size)
    }
    peerWindow.addEventListener('message', receive)
    return {
      updateData: (patch) => send('update-data', { patch }),
      ready: () => send('ready'),
      destroy() {
        destroyed = true
        binding = undefined
        peerWindow.removeEventListener('message', receive)
      },
    }
  }
  function createPluginRelayBridge({
    frame,
    relayWindow = globalThis.window,
    createToken = newToken,
  }) {
    let childReady = false,
      outerBound = false,
      outerReady = false,
      outer
    const notifyReady = () => {
      if (outerBound && childReady && !outerReady) {
        outerReady = true
        outer.ready()
      }
    }
    const child = createPluginHostBridge({
      frame,
      hostWindow: relayWindow,
      pluginData: {},
      size: { width: 1, height: 1 },
      createToken,
      onReady() {
        childReady = true
        notifyReady()
      },
      onDataUpdate(patch) {
        if (outerBound && childReady) outer.updateData(patch)
      },
    })
    outer = createPluginPeerBridge({
      peerWindow: relayWindow,
      parentWindow: relayWindow.parent,
      deferReady: true,
      onData(data, size) {
        outerBound = true
        child.update(data, size)
        notifyReady()
      },
    })
    const load = () => {
      childReady = false
      child.load()
    }
    frame.addEventListener('load', load)
    return {
      destroy() {
        frame.removeEventListener('load', load)
        outer.destroy()
        child.destroy()
      },
    }
  }
  function initPluginRuntime(root = globalThis.document, { loadSource } = {}) {
    const bridges = new Map()
    let alive = true
    function scan() {
      if (!alive) return
      const frames = new Set(root.querySelectorAll('iframe[data-plugin-data]'))
      for (const [frame, bridge] of bridges)
        if (!frames.has(frame)) {
          bridge.destroy()
          bridges.delete(frame)
        }
      for (const frame of frames) {
        if (bridges.has(frame)) continue
        const controller = new frame.ownerDocument.defaultView.AbortController()
        let bridge, diagnostic
        const load = () => bridge?.load()
        const report = (error) => {
          if (controller.signal.aborted) return
          bridge?.destroy()
          frame.hidden = true
          diagnostic = frame.ownerDocument.createElement('p')
          diagnostic.setAttribute('role', 'alert')
          diagnostic.textContent = error.message || 'Plugin sandbox unavailable.'
          frame.after(diagnostic)
        }
        bridges.set(frame, {
          destroy() {
            controller.abort()
            frame.removeEventListener('load', load)
            bridge?.destroy()
            diagnostic?.remove()
          },
        })
        try {
          const data = JSON.parse(frame.getAttribute('data-plugin-data'))
          const size = {
            width: Number(frame.getAttribute('data-plugin-width')),
            height: Number(frame.getAttribute('data-plugin-height')),
          }
          bridge = createPluginHostBridge({
            frame,
            hostWindow: frame.ownerDocument.defaultView,
            pluginData: data,
            size,
            onDataUpdate(patch) {
              Object.assign(data, patch)
              bridge.update(data, size)
            },
          })
          frame.addEventListener('load', load)
          const deferred = frame.getAttribute('data-ns-srcdoc')
          if (deferred !== null) frame.srcdoc = deferred
          else if (frame.hasAttribute('data-plugin-src')) {
            if (!loadSource) throw new Error('Plugin source loader unavailable.')
            Promise.resolve(loadSource(frame, controller.signal))
              .then((source) => {
                if (!controller.signal.aborted) frame.srcdoc = source
              })
              .catch(report)
          } else {
            // Probe an already loaded opaque peer; every later load rotates document authority.
            bridge.load()
          }
        } catch (error) {
          report(error)
        }
      }
    }
    scan()
    return {
      scan,
      destroy() {
        alive = false
        for (const bridge of bridges.values()) bridge.destroy()
        bridges.clear()
      },
    }
  }
  return {
    validatePluginMessage,
    createPluginHostBridge,
    createPluginPeerBridge,
    createPluginRelayBridge,
    initPluginRuntime,
  }
}
module.exports = { createPluginMessageRuntime, ...createPluginMessageRuntime() }
