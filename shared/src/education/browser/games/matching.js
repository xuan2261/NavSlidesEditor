const { node, listen } = require('../dom.js')
const { createAssignmentControls } = require('../assignment-controls.js')
const { createClassroomControls } = require('./poll-classroom-controls.js')
function presentMatching({ root, config, session, reset, clock }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const controls = createClassroomControls({
    document,
    config,
    session,
    reset,
    clock,
    type: 'matching',
  })
  const sources = config.pairs.map((row) => ({
    id: row.promptId,
    label: row.prompt,
    media: row.promptMedia,
  }))
  const targets = session.getState().targetOrder.map((id) => {
    const row = config.pairs.find((pair) => pair.targetId === id)
    return { id, label: row.target, media: row.targetMedia }
  })
  const assignments = createAssignmentControls({
    document,
    sources,
    targets,
    bijection: true,
    session,
    onChange: (_next, command) => controls.send(command.type, command),
  })
  const form = node(document, 'form', undefined, { 'data-ns-submission-form': '' })
  const fieldset = node(document, 'fieldset'),
    legend = node(document, 'legend', config.prompt)
  fieldset.append(legend, assignments.element)
  const submit = node(document, 'button', 'Submit matches', { type: 'submit' })
  form.append(fieldset, submit)
  const results = node(document, 'div', undefined, { 'data-ns-results': '', 'aria-live': 'polite' })
  ui.replaceChildren(node(document, 'h3', config.title), controls.element, form, results)
  session.own(() => ui.replaceChildren())
  let resultKey = ''
  function render(state) {
    controls.render(state)
    const disabled =
      state.phase !== 'active' ||
      state.submissions.some(
        (row) => row.participantId === controls.participant.value && row.terminal
      )
    fieldset.disabled = disabled
    submit.disabled = disabled || !state.participants.length
    assignments.render(state.assignment, { disabled })
    const key = JSON.stringify([state.submissions, state.revealed, state.participants])
    if (key !== resultKey) {
      resultKey = key
      const rows = state.submissions.map((result) =>
        node(
          document,
          'p',
          `${state.participants.find((row) => row.id === result.participantId)?.name || result.participantId}: ${result.score} / ${result.total} pairs correct`
        )
      )
      if (state.revealed)
        rows.push(
          ...config.pairs.map((row) => node(document, 'p', `${row.prompt} → ${row.target}`))
        )
      results.replaceChildren(
        node(document, 'p', `${state.submissions.length} participants submitted`),
        ...rows
      )
    }
  }
  listen(session, form, 'submit', (event) => {
    event.preventDefault()
    controls.submit({
      pairs: assignments
        .getAnswer()
        .map(({ sourceId, targetId }) => ({ promptId: sourceId, targetId })),
    })
  })
  listen(session, controls.participant, 'change', () => render(session.getState()))
  return { render, pause: () => assignments.cancel() }
}
module.exports = { presentMatching }
