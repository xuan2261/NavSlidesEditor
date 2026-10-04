const { node } = require('./dom.js')
const { createLiveForm } = require('./live-player-form.js')
function createLiveWordCloudCard(context) {
  const { root, transport } = context,
    document = root.ownerDocument,
    state = transport.getSnapshot()
  root.append(node(document, 'h2', state.wordCloud.prompt))
  const input = node(document, 'input', undefined, {
    type: 'text',
    maxlength: String(state.wordCloud.maxPhraseLength || 40),
    required: '',
    autocomplete: 'off',
  })
  input.value = state.draft?.text || ''
  const label = node(document, 'label', 'Your word or phrase ')
  label.append(input)
  const form = createLiveForm({
    ...context,
    label: 'Submit word',
    event: 'game-word-cloud-submit',
    eligible: (next) =>
      (next.ownSubmission?.count || 0) < (next.wordCloud.maxSubmissionsPerPlayer || 5),
    read: () => ({ text: input.value }),
  })
  form.fieldset.append(label)
  const words = node(document, 'ul'),
    quota = node(document, 'p')
  root.append(quota, words)
  let count = state.ownSubmission?.count || 0
  return {
    render(next) {
      const acceptedCount = next.ownSubmission?.count || 0
      const accepted = acceptedCount > count
      count = acceptedCount
      if (accepted) {
        input.value = ''
        transport.setDraft?.({ text: '' })
      }
      form.render(next)
      quota.textContent = `${count} / ${next.wordCloud.maxSubmissionsPerPlayer || 5} submissions`
      words.replaceChildren()
      for (const word of next.wordCloud.words || [])
        words.append(node(document, 'li', `${word.text} (${word.count})`))
    },
  }
}
module.exports = { createLiveWordCloudCard }
