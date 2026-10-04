const { node, listen, button } = require('./dom.js')
const {
  createAssignmentState,
  reduceAssignment,
  assignmentAnswer,
  moveOrder,
} = require('../assignment-state.js')
const { createValidation, throwInvalid } = require('../game-validation-utils.js')
const { validateMedia } = require('../question-shape.js')
const { createDragController } = require('./drag-controller.js')
const { createOrderingDrag } = require('./assignment-order-drag.js')
const { validateAnswerPayload } = require('../question-answer-payload.js')

function validateRows(rows, path) {
  const validation = createValidation()
  const list = validation.list(rows, [path], 1, 1000)
  validation.unique(list, [path])
  list.forEach((row, i) => {
    validation.text(row?.label, [path, i, 'label'], true)
    if (row?.media !== undefined) validateMedia(row.media, [path, i, 'media'], validation.errors)
  })
  throwInvalid(validation.errors, 'Assignment controls')
}
function labelButton(document, row, attribute) {
  const control = button(document, row.label, 'assignment-control')
  control.setAttribute(attribute, row.id)
  if (row.media) {
    control.prepend(
      node(document, 'img', undefined, {
        src: row.media.src.trim(),
        alt: row.media.alt,
        draggable: 'false',
      })
    )
  }
  return control
}
function focusArrows(session, root, controls) {
  listen(session, root, 'keydown', (event) => {
    const index = controls.indexOf(event.target)
    if (index < 0 || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key))
      return
    const step = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1
    controls[(index + step + controls.length) % controls.length].focus()
    event.preventDefault()
    event.stopPropagation()
  })
}

function createAssignmentControls({
  document,
  sources,
  targets,
  bijection = true,
  session,
  onChange = () => {},
}) {
  validateRows(sources, 'sources')
  validateRows(targets, 'targets')
  const config = {
    sourceIds: sources.map((row) => row.id),
    targetIds: targets.map((row) => row.id),
    bijection,
  }
  const generation = session.getState().generation
  const element = node(document, 'div', undefined, { 'data-ns-assignment-controls': '' })
  element.append(
    node(
      document,
      'p',
      'Select a source, then a target. Drag a source to place it. Use arrows to focus controls; Escape cancels selection.'
    )
  )
  const sourceGroup = node(document, 'div', undefined, { role: 'group', 'aria-label': 'Sources' })
  const targetGroup = node(document, 'div', undefined, { role: 'group', 'aria-label': 'Targets' })
  const status = node(document, 'p', '', { role: 'status', 'aria-live': 'polite' })
  element.append(sourceGroup, targetGroup, status)
  let state = createAssignmentState(),
    disabled = false,
    destroyed = false
  const sourceControls = sources.map((row) => {
    const wrapper = node(document, 'div')
    const control = labelButton(document, row, 'data-ns-source')
    control.style.touchAction = 'none'
    const assignment = node(document, 'span', '', { 'data-ns-assigned-label': '' })
    const clear = button(document, `Clear ${row.label}`, 'assignment-clear')
    wrapper.append(control, assignment, clear)
    sourceGroup.append(wrapper)
    listen(session, control, 'click', () => {
      if (state.selectedId !== row.id) send({ type: 'select', sourceId: row.id })
    })
    listen(session, clear, 'click', () => send({ type: 'clear', sourceId: row.id }))
    return { id: row.id, element: control, assignment, clear }
  })
  const targetControls = targets.map((row) => {
    const control = labelButton(document, row, 'data-ns-target')
    const assignments = node(document, 'span', '', { 'data-ns-target-items': '' })
    const wrapper = node(document, 'div')
    wrapper.append(control, assignments)
    targetGroup.append(wrapper)
    listen(session, control, 'click', () => {
      if (!state.selectedId) {
        status.textContent = 'Select a source first.'
        return
      }
      send({ type: 'assign', sourceId: state.selectedId, targetId: row.id })
    })
    return { id: row.id, element: control, assignments }
  })
  function render(next = state, options = {}) {
    state = next
    if (options.disabled !== undefined) disabled = options.disabled
    sourceControls.forEach((row) => {
      const assigned = state.assignments.find((value) => value.sourceId === row.id)
      row.element.disabled = disabled
      row.element.setAttribute('aria-pressed', String(state.selectedId === row.id))
      row.assignment.textContent = assigned
        ? ` → ${targets.find((target) => target.id === assigned.targetId)?.label || assigned.targetId}`
        : ''
      row.clear.disabled = disabled || !assigned
    })
    targetControls.forEach((row) => {
      row.element.disabled = disabled
      row.assignments.textContent = state.assignments
        .filter((value) => value.targetId === row.id)
        .map(
          (value) => sources.find((source) => source.id === value.sourceId)?.label || value.sourceId
        )
        .join(', ')
    })
    status.textContent =
      state.error ||
      (state.selectedId
        ? `Selected ${sources.find((row) => row.id === state.selectedId)?.label}. Choose a target.`
        : '')
  }
  function send(command) {
    if (disabled || destroyed || session.getState().generation !== generation) return
    const next = reduceAssignment(config, state, command)
    render(next)
    onChange(next, command)
    if (command.type === 'assign' && !state.error)
      status.textContent = `Placed ${sources.find((row) => row.id === command.sourceId)?.label} in ${targets.find((row) => row.id === command.targetId)?.label}.`
    if (command.type === 'clear' && !state.error)
      status.textContent = `Cleared ${sources.find((row) => row.id === command.sourceId)?.label}.`
  }
  const drag = createDragController({
    root: element,
    session,
    sources: sourceControls,
    targets: targetControls,
    enabled: () => !disabled && !destroyed,
    onSelect: (sourceId) => {
      if (state.selectedId !== sourceId) send({ type: 'select', sourceId })
    },
    onCommit: (sourceId, targetId) => send({ type: 'assign', sourceId, targetId }),
    onCancel: () => send({ type: 'cancel' }),
  })
  const cancel = () => {
    const source = sourceControls.find((row) => row.id === state.selectedId)
    drag.cancel()
    if (state.selectedId !== null || state.error) send({ type: 'cancel' })
    source?.element.focus()
  }
  listen(session, element, 'keydown', (event) => {
    if (event.key !== 'Escape') return
    cancel()
    event.preventDefault()
    event.stopPropagation()
  })
  focusArrows(
    session,
    sourceGroup,
    sourceControls.map((row) => row.element)
  )
  focusArrows(
    session,
    targetGroup,
    targetControls.map((row) => row.element)
  )
  const destroy = () => {
    if (destroyed) return
    drag.destroy()
    destroyed = true
  }
  session.own(destroy)
  render()
  return {
    element,
    getState: () => state,
    getAnswer: () => assignmentAnswer(state),
    render,
    cancel,
    destroy,
  }
}

function createOrderingControls({ document, items, session, onChange = () => {} }) {
  validateRows(items, 'items')
  const element = node(document, 'div', undefined, { 'data-ns-ordering-controls': '' })
  const status = node(document, 'p', '', { role: 'status', 'aria-live': 'polite' })
  let itemIds = items.map((row) => row.id),
    destroyed = false
  const rows = items.map((item) => {
    const row = node(document, 'div', undefined, { 'data-ns-order-item': item.id })
    const handle = labelButton(document, item, 'data-ns-source')
    handle.style.touchAction = 'none'
    row.append(handle)
    const up = button(document, 'Move up', 'order-up'),
      down = button(document, 'Move down', 'order-down')
    up.setAttribute('aria-label', `Move ${item.label} up`)
    down.setAttribute('aria-label', `Move ${item.label} down`)
    row.append(up, down)
    const move = (direction, control) => {
      if (destroyed) return
      const next = moveOrder(itemIds, item.id, direction)
      if (next === itemIds) return
      itemIds = next
      render()
      control.focus()
      status.textContent = `${item.label} moved to position ${itemIds.indexOf(item.id) + 1}.`
      onChange({ itemIds: [...itemIds] })
    }
    listen(session, up, 'click', () => move(-1, up))
    listen(session, down, 'click', () => move(1, down))
    return { id: item.id, element: row, handle, up, down }
  })
  function render() {
    itemIds.forEach((id, index) => {
      const row = rows.find((value) => value.id === id)
      // aria-disabled keeps keyboard focus on the activated control at a boundary.
      row.up.setAttribute('aria-disabled', String(index === 0))
      row.down.setAttribute('aria-disabled', String(index === itemIds.length - 1))
      element.append(row.element)
    })
    element.append(status)
  }
  const drag = createOrderingDrag({
    root: element,
    rows,
    session,
    getOrder: () => itemIds,
    onChange: (next, sourceId) => {
      itemIds = next
      render()
      rows.find((row) => row.id === sourceId)?.handle.focus()
      onChange({ itemIds: [...itemIds] })
    },
  })
  function setAnswer(answer) {
    if (destroyed) return false
    const errors = []
    validateAnswerPayload({ kind: 'ordering', options: items }, answer, ['answer'], errors)
    throwInvalid(errors, 'Ordering answer')
    drag.cancel()
    const focus = document.activeElement
    itemIds = [...answer.itemIds]
    render()
    if (element.contains(focus)) focus.focus()
    return true
  }
  const destroy = () => {
    drag.destroy()
    destroyed = true
  }
  session.own(destroy)
  render()
  return {
    element,
    getAnswer: () => ({ itemIds: [...itemIds] }),
    setAnswer,
    cancel: drag.cancel,
    destroy,
  }
}

module.exports = { createAssignmentControls, createOrderingControls }
