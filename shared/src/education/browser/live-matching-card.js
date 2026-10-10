const { node } = require('./dom.js')
const { createAssignmentControls } = require('./assignment-controls.js')
const { createLiveForm } = require('./live-player-form.js')
function createLiveMatchingCard(context) {
  const { root, transport, session } = context,
    document = root.ownerDocument,
    state = transport.getSnapshot(),
    matching = state.matching
  root.append(node(document, 'h2', matching.prompt))
  const controls = createAssignmentControls({
    document,
    sources: matching.prompts.map((row) => ({ id: row.id, label: row.text })),
    targets: matching.targets.map((row) => ({ id: row.id, label: row.text })),
    session,
    onChange: () =>
      transport.setDraft?.({
        pairs: controls
          .getAnswer()
          .map(({ sourceId, targetId }) => ({ promptId: sourceId, targetId })),
      }),
  })
  const form = createLiveForm({
    ...context,
    event: 'game-matching-submit',
    label: 'Submit matches',
    eligible: (next) => !next.ownSubmission,
    read: () => ({
      pairs: controls
        .getAnswer()
        .map(({ sourceId, targetId }) => ({ promptId: sourceId, targetId })),
    }),
  })
  form.fieldset.append(controls.element)
  const pairs = state.draft?.pairs || state.ownSubmission?.pairs
  if (pairs)
    controls.render({
      ...controls.getState(),
      assignments: pairs.map(({ promptId, targetId }) => ({ sourceId: promptId, targetId })),
    })
  const results = node(document, 'div')
  root.append(results)
  return {
    render(next) {
      form.render(next)
      controls.render(controls.getState(), { disabled: form.submit.disabled })
      for (const target of controls.element.querySelectorAll('[data-ns-target]')) {
        const assignment = controls
          .getState()
          .assignments.find((pair) => pair.targetId === target.getAttribute('data-ns-target'))
        target.disabled =
          form.submit.disabled ||
          Boolean(assignment && assignment.sourceId !== controls.getState().selectedId)
      }
      results.replaceChildren()
      const revealed = next.revealed?.answerKey || next.matching.answerKey
      if (revealed) {
        results.append(node(document, 'h3', 'Revealed answers'))
        for (const pair of revealed)
          results.append(
            node(
              document,
              'p',
              `${matching.prompts.find((row) => row.id === pair.promptId)?.text || pair.promptId} → ${matching.targets.find((row) => row.id === pair.targetId)?.text || pair.targetId}`
            )
          )
      }
      if (Number.isFinite(next.ownSubmission?.score))
        results.append(
          node(document, 'p', `Matches: ${next.ownSubmission.score} / ${next.ownSubmission.total}`)
        )
    },
    destroy: controls.destroy,
  }
}
module.exports = { createLiveMatchingCard }
