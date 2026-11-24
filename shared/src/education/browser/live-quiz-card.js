const { node, listen } = require('./dom.js')
const { createQuizAnswerControls } = require('./quiz-answer-controls.js')
const { createLiveForm, getLiveResult, renderReveal } = require('./live-player-form.js')
function createLiveQuizCard(context, event = 'game-answer', eligible = () => true) {
  const { root, session, transport } = context,
    document = root.ownerDocument
  const state = transport.getSnapshot(),
    question = state.question
  const title = node(document, 'h2', question.prompt),
    reveal = node(document, 'div'),
    attempts = node(document, 'p')
  root.append(title)
  if (question.media && question.kind !== 'image-hotspot') {
    const image = node(document, 'img', undefined, question.media)
    image.style.cssText = 'max-width:100%;max-height:240px;object-fit:contain'
    root.append(image)
  }
  const controls = createQuizAnswerControls({ document, question, session })
  const form = createLiveForm({
    ...context,
    event,
    eligible: (next) =>
      eligible(next) && !(next.ownSubmission?.result?.terminal || getLiveResult(next)?.terminal),
    read: () => ({ questionId: question.id, answer: controls.getAnswer() }),
  })
  form.fieldset.append(controls.element)
  root.append(attempts, reveal)
  const draft = state.draft?.answer || state.ownSubmission?.answer
  if (draft) controls.setAnswer(draft)
  let gesture
  listen(session, controls.element, 'pointerdown', (event) => {
    gesture = event.pointerId
  })
  listen(session, document, 'pointerup', (event) => {
    if (gesture === undefined || event.pointerId !== gesture) return
    gesture = undefined
    transport.setDraft?.({ questionId: question.id, answer: controls.getAnswer() })
  })
  listen(session, document, 'pointercancel', () => {
    gesture = undefined
  })
  return {
    render(next) {
      form.render(next)
      if (controls.setDisabled) controls.setDisabled(form.submit.disabled)
      else controls.element.disabled = form.submit.disabled
      const result = getLiveResult(next)
      attempts.textContent = next.quiz
        ? `Attempts: ${result?.attemptsUsed || 0} / ${next.quiz.attemptLimit}`
        : ''
      renderReveal(reveal, next)
    },
    destroy: () => {
      controls.cancel?.()
      controls.destroy?.()
    },
  }
}
module.exports = { createLiveQuizCard }
