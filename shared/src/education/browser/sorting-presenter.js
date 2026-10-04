const { node, listen, button } = require('./dom.js')
const { createAssignmentControls } = require('./assignment-controls.js')

function presentSorting({ root, config, session, reset }) {
  const document = root.ownerDocument
  const ui = root.querySelector('[data-ns-game-ui]')
  ui.replaceChildren(node(document, 'h3', config.title))
  const feedback = node(document, 'p', '', { role: 'status', 'aria-live': 'polite' })
  const summary = node(document, 'p', '', { 'data-ns-sorting-summary': '' })
  const form = node(document, 'form', undefined, { 'aria-label': 'Sorting answer' })
  const controls = createAssignmentControls({
    document,
    sources: config.items.map((item) => ({
      id: item.id,
      label: item.text,
      ...(item.media ? { media: item.media } : {}),
    })),
    targets: config.buckets.map((bucket) => ({ id: bucket.id, label: bucket.label })),
    bijection: false,
    session,
    onChange: (_next, command) => session.dispatch(command),
  })
  const submit = node(document, 'button', 'Check sorting', {
    type: 'submit',
    'data-ns-command': 'sorting-submit',
  })
  const restart = button(document, 'Reset sorting', 'sorting-reset')
  form.append(controls.element, submit)
  ui.append(form, feedback, summary, restart)
  session.own(() => ui.replaceChildren())
  listen(session, form, 'submit', (event) => {
    event.preventDefault()
    event.stopPropagation()
    session.dispatch({ type: 'submit' })
  })
  listen(session, restart, 'click', () => {
    controls.cancel()
    reset()
  })
  function render(state) {
    const disabled = state.phase !== 'active'
    controls.render(state.assignment, { disabled })
    submit.disabled = disabled
    const remaining = Math.max(0, config.attemptLimit - state.attempts)
    feedback.textContent =
      state.error ||
      (state.feedback === 'correct'
        ? 'Correct! All items are sorted.'
        : state.feedback === 'incorrect'
          ? remaining
            ? 'Not yet. Change your assignments and try again.'
            : 'No attempts remain. Reset to try again.'
          : '')
    summary.textContent = `Score: ${state.score}. Attempts: ${state.attempts}/${config.attemptLimit}.`
  }
  render(session.getState())
  return { render, pause: controls.cancel, cancel: controls.cancel, destroy: controls.destroy }
}

module.exports = { presentSorting }
