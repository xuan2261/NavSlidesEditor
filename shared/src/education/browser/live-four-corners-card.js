const { node } = require('./dom.js')
const { createLiveForm } = require('./live-player-form.js')
function createLiveFourCornersCard(context) {
  const { root, transport } = context,
    document = root.ownerDocument,
    state = transport.getSnapshot()
  const question = state.question
  root.append(node(document, 'h2', question.prompt))
  const inputs = []
  const form = createLiveForm({
    ...context,
    event: 'game-fourcorners-choice',
    label: 'Choose corner',
    eligible: (next) => !next.ownSubmission && !next.corners?.eliminated?.includes(next.playerId),
    read: () => ({ cornerId: inputs.find((input) => input.checked)?.value }),
  })
  form.fieldset.append(node(document, 'legend', 'Choose a corner'))
  for (const option of question.options) {
    const label = node(document, 'label', option.text),
      input = node(document, 'input', undefined, {
        type: 'radio',
        name: 'corner',
        value: option.id,
        required: '',
      })
    label.prepend(input)
    label.style.cssText = 'display:block;min-height:44px'
    form.fieldset.append(label)
    inputs.push(input)
  }
  const chosen = state.draft?.cornerId || state.ownSubmission?.cornerId
  inputs.forEach((input) => {
    input.checked = input.value === chosen
  })
  const reveal = node(document, 'p')
  root.append(reveal)
  return {
    render(next) {
      form.render(next)
      if (next.ownSubmission?.cornerId)
        inputs.forEach((input) => {
          input.checked = input.value === next.ownSubmission.cornerId
        })
      const correct = next.revealed?.correctCorner || next.revealed?.question?.answerKey?.optionId
      reveal.textContent = next.corners?.eliminated?.includes(next.playerId)
        ? 'Eliminated. Watch the next round.'
        : correct
          ? `Correct corner: ${question.options.find((option) => option.id === correct)?.text || correct}`
          : ''
    },
  }
}
module.exports = { createLiveFourCornersCard }
