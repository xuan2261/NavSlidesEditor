const { node, listen } = require('../dom.js')
const { wordCloudAggregate } = require('../../games/word-cloud.js')
const { createClassroomControls } = require('./poll-classroom-controls.js')
function presentWordCloud({ root, config, session, reset, clock }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const controls = createClassroomControls({
    document,
    config,
    session,
    reset,
    clock,
    type: 'word-cloud',
    clear: true,
  })
  const form = node(document, 'form', undefined, { 'data-ns-submission-form': '' })
  const fieldset = node(document, 'fieldset'),
    legend = node(document, 'legend', config.prompt)
  const input = node(document, 'input', undefined, {
    type: 'text',
    'aria-label': 'Word or phrase',
    'data-ns-cloud-input': '',
  })
  const quota = node(document, 'p', undefined, { 'data-ns-quota': '' })
  fieldset.append(
    legend,
    input,
    node(
      document,
      'small',
      `Phrases are normalized and limited to ${config.maxPhraseLength} UTF-16 characters.`
    )
  )
  const submit = node(document, 'button', 'Submit phrase', { type: 'submit' })
  form.append(fieldset, submit, quota)
  const results = node(document, 'div', undefined, { 'data-ns-results': '', 'aria-live': 'polite' })
  ui.replaceChildren(node(document, 'h3', config.title), controls.element, form, results)
  session.own(() => ui.replaceChildren())
  let resultKey = ''
  function render(state) {
    controls.render(state)
    fieldset.disabled = state.phase !== 'active'
    submit.disabled = state.phase !== 'active' || !state.participants.length
    const used =
      state.quotas.find((row) => row.participantId === controls.participant.value)?.count || 0
    quota.textContent = `${used} / ${config.maxSubmissionsPerPlayer} submissions used`
    const aggregate = wordCloudAggregate(config, state),
      key = JSON.stringify(aggregate)
    if (key !== resultKey) {
      resultKey = key
      results.replaceChildren(
        node(document, 'p', `${aggregate.totalSubmissions} phrases submitted`),
        ...aggregate.entries.map((entry) =>
          node(document, 'span', `${entry.text} (${entry.count})`, { class: 'ns-cloud-word' })
        )
      )
    }
  }
  listen(session, controls.participant, 'change', () => render(session.getState()))
  listen(session, form, 'submit', (event) => {
    event.preventDefault()
    controls.submit({ text: input.value })
  })
  return { render }
}
module.exports = { presentWordCloud }
