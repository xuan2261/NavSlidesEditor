const { resolveSlideTiming } = require('./pptx-timing-document')

// Reveal supplies click boundaries only. Source delays and with/after dependencies
// remain a separate schedule; several authored behaviors may target one occurrence.
function createSourceTimingPlayback(nodes, baseIndex = 0) {
  const initial = new Map(), steps = [], groups = new Map()
  let step, click = baseIndex, previousStart = 0, previousEnd = 0
  for (const node of nodes) {
    const groupKey = node.sourceGroupLocator ? JSON.stringify([node.definitionId, node.sourceGroupLocator]) : null
    const grouped = node.groupedWithPrevious && !node.triggerOverridden && !node.orderOverridden
    const sourceGroup = grouped ? groups.get(groupKey) : null
    if (!sourceGroup && (!step || node.trigger === 'onClick')) {
      step = { index: node.trigger === 'onClick' ? ++click : null, events: [] }
      steps.push(step)
      previousStart = previousEnd = 0
    }
    const baseMs = sourceGroup ? sourceGroup.baseMs
      : node.trigger === 'afterPrevious' ? previousEnd : node.trigger === 'onClick' ? 0 : previousStart
    const atMs = baseMs + node.delayMs
    previousStart = atMs
    previousEnd = sourceGroup ? Math.max(sourceGroup.endMs, atMs + node.durationMs) : atMs + node.durationMs
    if (sourceGroup) sourceGroup.endMs = previousEnd
    else if (groupKey && !node.groupedWithPrevious) groups.set(groupKey, { baseMs, endMs: previousEnd, step })
    if (node.status !== 'ready') continue
    if (!initial.has(node.targetInstanceId)) {
      const visible = ['disappear', 'fade-out'].includes(node.effect)
      initial.set(node.targetInstanceId, { targetInstanceId: node.targetInstanceId, visible, opacity: visible ? 1 : 0 })
    }
    const eventStep = sourceGroup?.step || step
    eventStep.events.push({ targetInstanceId: node.targetInstanceId, effect: node.effect,
      atMs, durationMs: node.durationMs })
  }
  return { initial: [...initial.values()], steps }
}
function sourceTimingPlayback(document, slide) {
  const baseIndex = Math.max(0, ...(slide.elements || []).filter(element => element.fragment && !element.hidden)
    .map(element => Number.isFinite(element.fragmentIndex) && element.fragmentIndex > 0 ? element.fragmentIndex : 1))
  return createSourceTimingPlayback(resolveSlideTiming(document, slide).nodes, baseIndex)
}

// Self-contained: embedded by htmlGenerator without a module loader.
function attachSourceTimingPlayback(root, reveal) {
  const view = root.ownerDocument.defaultView
  const controllers = []
  for (const holder of root.querySelectorAll('[data-ns-source-timing]')) {
    const section = holder.closest('section')
    const plan = JSON.parse(holder.getAttribute('data-ns-source-timing'))
    const targets = new Map()
    for (const node of section.querySelectorAll('[data-pptx-instance-id]')) {
      const id = node.getAttribute('data-pptx-instance-id')
      if (plan.initial.some(entry => entry.targetInstanceId === id)) targets.set(id, node)
    }
    controllers.push({ section, holder, plan, targets, timers: new Set(), animations: new Set(),
      styles: new Map([...targets].map(([id, node]) => [id, { opacity: node.style.opacity, visibility: node.style.visibility }])),
      index: null, active: false })
  }
  const printing = new URLSearchParams(view.location.search).has('print-pdf')
  let overview = false
  function cancel(controller) {
    for (const timer of controller.timers) view.clearTimeout(timer)
    controller.timers.clear()
    for (const animation of controller.animations) animation.cancel()
    controller.animations.clear()
  }
  function initialState(controller, showAll = false) {
    for (const state of controller.plan.initial) {
      const node = controller.targets.get(state.targetInstanceId)
      if (!node) continue
      node.style.visibility = showAll || state.visible ? 'visible' : 'hidden'
      node.style.opacity = showAll ? '1' : String(state.opacity)
    }
  }
  function finish(controller, event) {
    const node = controller.targets.get(event.targetInstanceId)
    if (!node) return
    const visible = event.effect === 'appear' || event.effect === 'fade-in'
    node.style.visibility = visible ? 'visible' : 'hidden'
    node.style.opacity = visible ? '1' : '0'
  }
  function run(controller, event) {
    const node = controller.targets.get(event.targetInstanceId)
    if (!node) return
    const incoming = event.effect === 'fade-in', fading = incoming || event.effect === 'fade-out'
    if (!fading || event.durationMs === 0) { finish(controller, event); return }
    node.style.visibility = 'visible'
    node.style.opacity = incoming ? '0' : '1'
    const animation = node.animate([{ opacity: incoming ? 0 : 1 }, { opacity: incoming ? 1 : 0 }],
      { duration: event.durationMs, easing: 'linear', fill: 'forwards' })
    controller.animations.add(animation)
    animation.onfinish = () => {
      if (!controller.animations.delete(animation)) return
      finish(controller, event)
      animation.cancel()
    }
  }
  function apply(controller, index, animate) {
    cancel(controller)
    initialState(controller)
    for (const step of controller.plan.steps) {
      if (step.index !== null && step.index > index) continue
      const current = step.index === index || (step.index === null && index === 0)
      if (!animate || !current) {
        for (const event of [...step.events].sort((a, b) => a.atMs + a.durationMs - b.atMs - b.durationMs)) finish(controller, event)
        continue
      }
      for (const event of step.events) {
        if (!event.atMs) run(controller, event)
        else {
          const timer = view.setTimeout(() => { controller.timers.delete(timer); run(controller, event) }, event.atMs)
          controller.timers.add(timer)
        }
      }
    }
  }
  function reconcile(event) {
    const currentSlide = typeof reveal?.getCurrentSlide === 'function' ? reveal.getCurrentSlide() : null
    for (const controller of controllers) {
      if (overview || printing) {
        cancel(controller)
        initialState(controller, true)
        controller.index = null
        continue
      }
      const active = controller.section === currentSlide
      if (!active) {
        if (controller.active) { cancel(controller); initialState(controller) }
        controller.active = false
        controller.index = null
        continue
      }
      const index = Math.max(0, ...[...controller.holder.querySelectorAll('[data-ns-source-step].visible')]
        .map(marker => Number(marker.getAttribute('data-ns-source-step'))))
      if (!controller.active || controller.index !== index) {
        apply(controller, index, event?.type !== 'fragmenthidden' && event?.type !== 'overviewhidden')
        controller.index = index
      }
      controller.active = true
    }
  }
  const showOverview = () => { overview = true; reconcile({ type: 'overviewshown' }) }
  const hideOverview = () => { overview = false; reconcile({ type: 'overviewhidden' }) }
  const events = ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden']
  for (const event of events) reveal.on(event, reconcile)
  reveal.on('overviewshown', showOverview)
  reveal.on('overviewhidden', hideOverview)
  reconcile({ type: 'ready' })
  return () => {
    for (const event of events) reveal.off(event, reconcile)
    reveal.off('overviewshown', showOverview)
    reveal.off('overviewhidden', hideOverview)
    for (const controller of controllers) {
      cancel(controller)
      for (const [id, style] of controller.styles) Object.assign(controller.targets.get(id).style, style)
    }
  }
}

module.exports = { createSourceTimingPlayback, sourceTimingPlayback, attachSourceTimingPlayback }
