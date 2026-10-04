const { node } = require('./dom.js')
const { createLiveForm } = require('./live-player-form.js')
function createLivePollCard(context) {
  const { root, transport } = context,
    document = root.ownerDocument,
    state = transport.getSnapshot()
  const poll = state.poll,
    inputs = []
  root.append(node(document, 'h2', poll.prompt))
  const form = createLiveForm({
    ...context,
    label: 'Vote',
    event: 'game-poll-submit',
    eligible: (next) => !next.ownSubmission || next.poll.allowChangeVote === true,
    read: () => ({ optionId: inputs.find((input) => input.checked)?.value }),
  })
  for (const option of poll.options) {
    const label = node(document, 'label', option.text),
      input = node(document, 'input', undefined, {
        type: 'radio',
        name: 'poll',
        value: option.id,
        required: '',
      })
    input.checked = option.id === (state.draft?.optionId || state.ownSubmission?.optionId)
    label.prepend(input)
    label.style.cssText = 'display:block;min-height:44px'
    form.fieldset.append(label)
    inputs.push(input)
  }
  const results = node(document, 'ul'),
    total = node(document, 'p')
  root.append(results, total)
  return {
    render(next) {
      form.render(next)
      if (next.ownSubmission?.optionId && !next.draft)
        inputs.forEach((input) => {
          input.checked = input.value === next.ownSubmission.optionId
        })
      results.replaceChildren()
      for (const vote of next.poll.votes || []) {
        const option = poll.options.find((option) => option.id === vote.optionId)
        results.append(
          node(
            document,
            'li',
            `${option?.text || vote.optionId}: ${vote.count} (${vote.percentage}%)`
          )
        )
      }
      total.textContent = `${next.poll.totalVotes || 0} votes`
    },
  }
}
module.exports = { createLivePollCard }
