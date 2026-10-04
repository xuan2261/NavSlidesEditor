const { node } = require('./dom.js')

// This controller owns gestures only. It has no answer key, score or transport authority.
function createDragController({
  root,
  session,
  sources,
  targets,
  onSelect = () => {},
  onCommit,
  onCancel = () => {},
  enabled = () => true,
}) {
  const document = root.ownerDocument,
    generation = session.getState().generation
  let gesture = null,
    suppressedClick = null,
    destroyed = false
  const listeners = []
  const active = () =>
    !destroyed &&
    session.getState().generation === generation &&
    enabled() &&
    !root.closest('fieldset[disabled]')
  const listen = (element, type, handler, capture = false) => {
    element.addEventListener(type, handler, capture)
    listeners.push(() => element.removeEventListener(type, handler, capture))
  }
  const cleanup = () => {
    if (!gesture) return null
    const previous = gesture
    gesture = null
    previous.ghost?.remove()
    try {
      if (previous.handle.hasPointerCapture?.(previous.pointerId))
        previous.handle.releasePointerCapture(previous.pointerId)
    } catch (error) {
      // A cancelled browser pointer may already have released its capture.
      if (error.name !== 'NotFoundError') throw error
    }
    return previous
  }
  const cancel = () => {
    const previous = cleanup()
    suppressedClick = null
    if (previous) onCancel(previous.sourceId)
  }
  const contains = (element, x, y) => {
    const rect = element.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    )
  }
  listen(root, 'pointerdown', (event) => {
    suppressedClick = null
    if (!active() || event.button !== 0 || gesture) return
    const handle = event.target.closest?.('[data-ns-source]')
    const source = sources.find((row) => row.element === handle)
    if (!source || handle.matches(':disabled')) return
    gesture = {
      handle,
      sourceId: source.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      ghost: null,
    }
    try {
      handle.setPointerCapture(event.pointerId)
    } catch (error) {
      cancel()
      if (error.name !== 'NotFoundError' && error.name !== 'InvalidStateError') throw error
      return
    }
    onSelect(source.id)
    event.stopPropagation()
  })
  listen(
    document,
    'pointermove',
    (event) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      if (!active()) {
        cancel()
        return
      }
      if (!gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 4)
        return
      gesture.moved = true
      if (!gesture.ghost) {
        gesture.ghost = node(document, 'div', gesture.handle.textContent, {
          'data-ns-drag-ghost': '',
          'aria-hidden': 'true',
        })
        Object.assign(gesture.ghost.style, {
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: '2147483647',
          padding: '8px',
          background: '#25253a',
          color: '#fff',
        })
        document.body.append(gesture.ghost)
      }
      gesture.ghost.style.left = `${event.clientX + 12}px`
      gesture.ghost.style.top = `${event.clientY + 12}px`
      event.preventDefault()
      event.stopPropagation()
    },
    true
  )
  listen(
    document,
    'pointerup',
    (event) => {
      if (!gesture || event.pointerId !== gesture.pointerId) return
      if (!active()) {
        cancel()
        return
      }
      const previous = cleanup()
      if (!previous.moved) return
      event.preventDefault()
      event.stopPropagation()
      const target = targets.find(
        (row) =>
          !row.element.matches(':disabled') && contains(row.element, event.clientX, event.clientY)
      )
      // Match the synthetic click from this exact pointer sequence, never a timer/debounce.
      suppressedClick = {
        pointerId: previous.pointerId,
        handle: previous.handle,
        target: target?.element,
      }
      if (target) onCommit(previous.sourceId, target.id)
      else onCancel(previous.sourceId)
    },
    true
  )
  for (const type of ['pointercancel', 'lostpointercapture'])
    listen(
      document,
      type,
      (event) => {
        if (gesture && gesture.pointerId === event.pointerId) cancel()
      },
      true
    )
  listen(
    document,
    'keydown',
    (event) => {
      suppressedClick = null
      if (event.key === 'Escape' && gesture) {
        const handle = gesture.handle
        cancel()
        handle.focus()
        event.preventDefault()
        event.stopPropagation()
      }
    },
    true
  )
  listen(
    root,
    'click',
    (event) => {
      if (!suppressedClick) return
      const match =
        event.pointerId !== undefined
          ? event.pointerId === suppressedClick.pointerId
          : event.detail > 0 &&
            (suppressedClick.handle.contains(event.target) ||
              suppressedClick.target?.contains(event.target))
      if (!match) return
      suppressedClick = null
      event.preventDefault()
      event.stopImmediatePropagation()
    },
    true
  )
  const destroy = () => {
    if (destroyed) return
    cancel()
    destroyed = true
    listeners.splice(0).forEach((remove) => remove())
  }
  session.own(destroy)
  return { cancel, destroy }
}

module.exports = { createDragController }
