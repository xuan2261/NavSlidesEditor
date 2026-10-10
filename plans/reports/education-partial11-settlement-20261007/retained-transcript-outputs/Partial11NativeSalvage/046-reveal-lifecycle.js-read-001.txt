const { mount, getRootLifecycle, bindHostRoot } = require('./mount.js')
const { getDocumentVariables, destroyDocumentVariables } = require('./document-variables.js')
const { initInteractionPresenter } = require('./interaction-presenter.js')
const { initPluginRuntime } = require('../plugin-message-contract.js')
const { buildSandboxFrameDocument, validateHtmlDependencies } = require('../html-sandbox-policy.js')
const documents = new WeakMap()
function attachRevealLifecycle(document, reveal, transport) {
  if (documents.has(document)) return documents.get(document)
  const roots = new Map()
  const variables = getDocumentVariables(document)
  const mode = document.documentElement.dataset.nsEducationView === 'audience' ? 'live' : 'local'
  const plugins = initPluginRuntime(document, {
    async loadSource(frame, signal) {
      const declaration = frame.getAttribute('data-html-dependencies')
      const dependencies = validateHtmlDependencies(
        declaration === null ? undefined : JSON.parse(declaration)
      )
      const baseUrl = new URL(frame.getAttribute('data-plugin-src'), document.baseURI).href
      const response = await document.defaultView.fetch(baseUrl, { signal })
      if (!response.ok) throw new Error(`Plugin sandbox unavailable (HTTP ${response.status}).`)
      const content = await response.text()
      return buildSandboxFrameDocument(content, dependencies, {
        plugin: true,
        baseUrl: response.url || baseUrl,
      })
    },
  })
  function reconcile() {
    const active = reveal.getCurrentSlide()
    plugins.scan()
    for (const [root] of roots) {
      const styles = document.defaultView.getComputedStyle(root)
      const visible =
        !document.hidden &&
        root.closest('section') === active &&
        !root.hidden &&
        styles.display !== 'none' &&
        styles.visibility !== 'hidden'
      const lifecycle = getRootLifecycle(root)
      if (visible) lifecycle?.resume()
      else lifecycle?.pause()
    }
  }
  function scan() {
    for (const [root, api] of roots)
      if (!root.isConnected) {
        api.destroy()
        roots.delete(root)
      }
    for (const root of document.querySelectorAll('[data-ns-game]')) {
      if (roots.has(root)) continue
      const tuple = {
        effectiveSlideId: root.closest('[data-ns-effective-slide-id]')?.dataset.nsEffectiveSlideId,
        elementId: root.dataset.nsElementId,
      }
      bindHostRoot(root, transport?.getHostBinding?.(tuple))
      try {
        roots.set(root, mount(root, { mode, transport, variables }))
      } catch (error) {
        const diagnostic = document.createElement('p')
        diagnostic.setAttribute('role', 'alert')
        diagnostic.textContent = error.message
        root.querySelector('[data-ns-game-ui]')?.replaceChildren(diagnostic)
      }
    }
    reconcile()
  }
  const unsubscribeBindings = transport?.onBindingsChanged?.(() => {
    for (const api of roots.values()) api.destroy()
    roots.clear()
    scan()
  })
  const priorCondition = reveal.getConfig().keyboardCondition
  const keyboardCondition = (event) => {
    const target =
      event.target?.closest?.('[data-ns-game], [data-ns-action]') ||
      document.activeElement?.closest?.('[data-ns-game], [data-ns-action]')
    if (target) return false
    return typeof priorCondition === 'function'
      ? priorCondition(event)
      : priorCondition !== 'focused' || reveal.isFocused()
  }
  reveal.configure({ keyboardCondition })
  for (const event of ['slidechanged', 'fragmentshown', 'fragmenthidden'])
    reveal.on(event, reconcile)
  document.addEventListener('visibilitychange', reconcile)
  const observer = new document.defaultView.MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.type === 'childList' &&
          [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node.nodeType === 1 &&
              (node.matches('[data-ns-game], iframe[data-plugin-data]') ||
                node.querySelector('[data-ns-game], iframe[data-plugin-data]'))
          )
      )
    )
      scan()
    else if (
      records.some((record) => roots.has(record.target) || record.target.tagName === 'SECTION')
    )
      reconcile()
  })
  observer.observe(document.querySelector('.reveal .slides'), {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'style', 'class'],
  })
  const interactions = initInteractionPresenter({
    document,
    reveal,
    variables,
    resetSlide: (section) => {
      for (const [root, api] of roots)
        if (root.closest('[data-ns-effective-slide-id]') === section) api.reset()
      reconcile()
    },
  })
  function destroy() {
    observer.disconnect()
    unsubscribeBindings?.()
    for (const event of ['slidechanged', 'fragmentshown', 'fragmenthidden'])
      reveal.off(event, reconcile)
    document.removeEventListener('visibilitychange', reconcile)
    document.defaultView.removeEventListener('pagehide', destroy)
    if (reveal.getConfig().keyboardCondition === keyboardCondition)
      reveal.configure({ keyboardCondition: priorCondition })
    for (const api of roots.values()) api.destroy()
    plugins?.destroy()
    interactions.destroy()
    destroyDocumentVariables(document)
    roots.clear()
    documents.delete(document)
    transport?.destroy?.()
  }
  document.defaultView.addEventListener('pagehide', destroy, { once: true })
  const controller = { destroy, scan }
  documents.set(document, controller)
  scan()
  return controller
}
module.exports = { attachRevealLifecycle }
