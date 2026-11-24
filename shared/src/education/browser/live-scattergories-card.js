const { node } = require('./dom.js')
const { createLiveForm } = require('./live-player-form.js')
function createLiveScattergoriesCard(context) {
  const { root, transport } = context,
    document = root.ownerDocument,
    state = transport.getSnapshot()
  root.append(node(document, 'h2', `Letter: ${state.scatter.letter}`))
  const inputs = []
  const form = createLiveForm({
    ...context,
    label: 'Submit categories',
    event: 'game-scatter-submit',
    eligible: (next) => next.scatter?.submitterPlayerId === next.playerId && !next.ownSubmission,
    read: () => ({
      entries: inputs.map(({ id, input }) => ({ categoryId: id, text: input.value })),
    }),
  })
  for (const category of state.scatter.categories) {
    const label = node(document, 'label', `${category.label} `)
    const input = node(document, 'input', undefined, {
      type: 'text',
      maxlength: '256',
      autocomplete: 'off',
    })
    input.value =
      (state.draft?.entries || state.ownSubmission?.entries || []).find(
        (entry) => entry.categoryId === category.id
      )?.text || ''
    label.append(input)
    label.style.cssText = 'display:block;min-height:44px'
    form.fieldset.append(label)
    inputs.push({ id: category.id, input })
  }
  const waiting = node(document, 'p'),
    results = node(document, 'ul')
  root.append(waiting, results)
  return {
    render(next) {
      form.render(next)
      waiting.textContent =
        next.scatter.submitterPlayerId === next.playerId
          ? 'You are your team’s submitter.'
          : 'Waiting for your team’s submitter.'
      results.replaceChildren()
      const rows = next.revealed?.rows || []
      for (const row of rows) {
        const category = state.scatter.categories.find((category) => category.id === row.categoryId)
        const team = next.teams?.find((team) => team.id === row.teamId)
        results.append(
          node(
            document,
            'li',
            `${team?.name || row.teamId} · ${category?.label || row.categoryId}: ${row.text} — ${row.valid === false ? 'invalid' : row.valid === undefined ? 'awaiting adjudication' : row.unique ? 'unique' : 'duplicate'} · ${row.points} points`
          )
        )
      }
    },
  }
}
module.exports = { createLiveScattergoriesCard }
