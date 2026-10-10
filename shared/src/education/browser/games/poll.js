const { node, listen } = require('../dom.js')
const { pollAggregate } = require('../../games/poll.js')
const { createClassroomControls, appendSubmissionMedia } = require('./poll-classroom-controls.js')
function presentPoll({ root, config, session, reset, clock }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const controls = createClassroomControls({
    document,
    config,
    session,
    reset,
    clock,
    type: 'poll',
  })
  const form = node(document, 'form', undefined, { 'data-ns-submission-form': '' })
  const fieldset = node(document, 'fieldset'),
    legend = node(document, 'legend', config.prompt)
  fieldset.append(legend)
  const options = config.options.map((option) => {
    const label = node(document, 'label'),
      input = node(document, 'input', undefined, {
        type: 'radio',
        name: 'poll-option',
        value: option.id,
        'data-ns-poll-option': '',
      })
    label.append(input, node(document, 'span', option.text))
    appendSubmissionMedia(document, label, option.media)
    fieldset.append(label)
    return input
  })
  const submit = node(document, 'button', 'Submit vote', { type: 'submit' })
  form.append(fieldset, submit)
  const results = node(document, 'div', undefined, { 'data-ns-results': '', 'aria-live': 'polite' })
  ui.replaceChildren(node(document, 'h3', config.title), controls.element, form, results)
  session.own(() => ui.replaceChildren())
  let resultKey = ''
  function render(state) {
    controls.render(state)
    fieldset.disabled = state.phase !== 'active'
    submit.disabled = state.phase !== 'active' || !state.participants.length
    results.hidden = !state.resultsVisible
    const aggregate = pollAggregate(config, state),
      key = JSON.stringify(aggregate)
    if (key !== resultKey) {
      resultKey = key
      results.replaceChildren(
        node(document, 'p', `${aggregate.totalVotes} participants voted`),
        ...aggregate.options.map((option) => node(document, 'p', `${option.text}: ${option.votes}`))
      )
    }
  }
  listen(session, form, 'submit', (event) => {
    event.preventDefault()
    controls.submit({ optionId: options.find((input) => input.checked)?.value })
  })
  return { render }
}
module.exports = { presentPoll }
