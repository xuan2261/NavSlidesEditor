const {
  INTERACTION_ACTION_KINDS,
  createInteractionSlideState,
  executeInteractionAction,
  isInteractionElementVisible,
} = require('../interaction-actions.js')
const controllers = new WeakMap()
const SURFACES = '[data-ns-element-id], [data-ns-element-for]'
const sectionOf = (node) => node?.closest?.('[data-ns-effective-slide-id]')
const elementId = (node) => node.dataset.nsElementId || node.dataset.nsElementFor

function initInteractionPresenter({ document, reveal, variables, resetSlide }) {
  if (controllers.has(document)) return controllers.get(document)
  const scopes = new Map(),
    saved = new Map(),
    alerts = new Set()
  let alive = true
  function remember(node) {
    if (!saved.has(node))
      saved.set(node, {
        hidden: node.hidden,
        inert: node.inert,
        display: node.style.display,
        aria: node.getAttribute('aria-hidden'),
      })
  }
  function fragmentReady(node, section) {
    for (let ancestor = node; ancestor && ancestor !== section; ancestor = ancestor.parentElement) {
      if (ancestor.classList.contains('fragment') && !ancestor.classList.contains('visible'))
        return false
    }
    return true
  }
  function render(scope) {
    for (const [id, nodes] of scope.nodes) {
      const owner =
        nodes.find(
          (node) => node.hasAttribute('data-ns-element-id') && !node.hasAttribute('data-ns-action')
        ) || nodes[0]
      const visible = isInteractionElementVisible(
        scope.state,
        id,
        fragmentReady(owner, scope.section)
      )
      for (const node of nodes) {
        remember(node)
        const baseline = saved.get(node)
        node.hidden = !visible
        node.inert = !visible || baseline.inert
        node.style.display = visible ? baseline.display : 'none'
        if (!visible) node.setAttribute('aria-hidden', 'true')
        else if (baseline.aria === null) node.removeAttribute('aria-hidden')
        else node.setAttribute('aria-hidden', baseline.aria)
      }
    }
  }
  function scan() {
    for (const section of document.querySelectorAll('[data-ns-effective-slide-id]')) {
      if (scopes.has(section)) continue
      const nodes = new Map()
      for (const node of section.querySelectorAll(SURFACES)) {
        if (sectionOf(node) !== section) continue
        const id = elementId(node)
        if (!id) continue
        if (!nodes.has(id)) nodes.set(id, [])
        nodes.get(id).push(node)
      }
      if (!nodes.size) continue
      const elements = [...nodes].map(([id, surfaces]) => ({
        id,
        initialVisibility: surfaces.some((node) => node.dataset.nsInitialVisibility === 'hidden')
          ? 'hidden'
          : 'visible',
      }))
      const scope = {
        section,
        nodes,
        state: createInteractionSlideState({ id: section.dataset.nsEffectiveSlideId, elements }),
        alert: null,
      }
      scopes.set(section, scope)
      render(scope)
    }
  }
  function diagnostic(scope, error) {
    if (!scope.alert && error) {
      scope.alert = document.createElement('p')
      scope.alert.setAttribute('role', 'alert')
      scope.alert.dataset.nsInteractionError = ''
      scope.section.append(scope.alert)
      alerts.add(scope.alert)
    }
    if (scope.alert) {
      scope.alert.textContent = error
      scope.alert.hidden = !error
    }
  }
  function activate(source) {
    const section = sectionOf(source),
      scope = scopes.get(section)
    if (!scope || section !== reveal.getCurrentSlide()) return
    const id = elementId(source) || elementId(source.closest(SURFACES) || source)
    const nodes = scope.nodes.get(id)
    if (source.hidden || source.closest('[inert]') || (id && !scope.state.visibility[id])) return
    if (
      nodes &&
      !fragmentReady(
        nodes.find((node) => !node.hasAttribute('data-ns-action')) || nodes[0],
        section
      )
    )
      return
    let action
    try {
      action = JSON.parse(source.dataset.nsAction)
    } catch {
      diagnostic(scope, 'Action metadata is invalid. Edit this action in the authoring controls.')
      return
    }
    const result = executeInteractionAction(scope.state, action, {
      variables,
      onReset: (next) => {
        scope.state = next
        resetSlide?.(section)
        reveal.navigateFragment?.(-1)
      },
    })
    scope.state = result.state
    diagnostic(scope, result.error)
    render(scope)
    if (!source.isConnected || source.hidden || source.closest('[inert]')) {
      const fallback = [...section.querySelectorAll('button, [href], [tabindex]')].find(
        (node) =>
          !node.hidden &&
          !node.closest('[inert]') &&
          fragmentReady(node, section) &&
          node.tabIndex >= 0
      )
      fallback?.focus()
    }
  }
  function sourceFor(event) {
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement
    if (!target || target.closest('[data-ns-game-ui], [data-ns-editor-canvas]')) return null
    const source = target.closest('[data-ns-action]')
    if (
      !source ||
      (target !== source &&
        target.closest('button, input, select, textarea, a, [contenteditable="true"]') !== source &&
        target.closest('button, input, select, textarea, a, [contenteditable="true"]'))
    )
      return null
    try {
      if (!INTERACTION_ACTION_KINDS.has(JSON.parse(source.dataset.nsAction).kind)) return null
    } catch {
      /* Report malformed metadata through activate. */
    }
    return source
  }
  function click(event) {
    const source = sourceFor(event)
    if (!source || event.defaultPrevented) return
    event.preventDefault()
    activate(source)
  }
  function keydown(event) {
    const source = sourceFor(event)
    if (!source || event.defaultPrevented || !['Enter', ' '].includes(event.key)) return
    if (source.matches('button, input, select, textarea, a[href]')) {
      if (event.repeat) event.preventDefault()
      return
    }
    event.preventDefault()
    if (!event.repeat) activate(source)
  }
  function reconcile() {
    if (alive) {
      scan()
      for (const scope of scopes.values()) render(scope)
    }
  }
  function destroy() {
    if (!alive) return
    alive = false
    document.removeEventListener('click', click)
    document.removeEventListener('keydown', keydown)
    for (const name of ['slidechanged', 'fragmentshown', 'fragmenthidden'])
      reveal.off(name, reconcile)
    document.defaultView?.removeEventListener('pagehide', destroy)
    for (const [node, baseline] of saved) {
      node.hidden = baseline.hidden
      node.inert = baseline.inert
      node.style.display = baseline.display
      if (baseline.aria === null) node.removeAttribute('aria-hidden')
      else node.setAttribute('aria-hidden', baseline.aria)
    }
    for (const alert of alerts) alert.remove()
    scopes.clear()
    saved.clear()
    alerts.clear()
    controllers.delete(document)
  }
  const controller = { destroy }
  if (document.documentElement.dataset.nsEducationView === 'editor') return controller
  controllers.set(document, controller)
  scan()
  document.addEventListener('click', click)
  document.addEventListener('keydown', keydown)
  for (const name of ['slidechanged', 'fragmentshown', 'fragmenthidden']) reveal.on(name, reconcile)
  document.defaultView?.addEventListener('pagehide', destroy, { once: true })
  return controller
}
module.exports = { initInteractionPresenter }
