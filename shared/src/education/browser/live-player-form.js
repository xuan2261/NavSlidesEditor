const { node, listen } = require('./dom.js')
function interactive(state) {
  return (
    !state.readOnly &&
    state.ownEligible !== false &&
    state.connected &&
    state.hydrated &&
    !state.pending &&
    ['active', 'guessing', 'playing', 'question', 'poll', 'word-cloud', 'matching'].includes(
      state.phase
    )
  )
}
function getLiveResult(state) {
  const own = state.ownSubmission,
    receipt = state.receipt
  const ownAttempt = own?.attemptId || own?.result?.attemptId,
    receiptAttempt = receipt?.attemptId || receipt?.result?.attemptId
  const sameAttempt = ownAttempt && ownAttempt === receiptAttempt
  const sameCommand = own?.commandId && own.commandId === receipt?.commandId
  return own?.result &&
    !receipt?.error &&
    receipt?.result?.valid !== false &&
    (sameAttempt || sameCommand)
    ? own.result
    : receipt?.result || own?.result
}
function createLiveForm({
  root,
  session,
  transport,
  label = 'Submit answer',
  read,
  event,
  eligible = () => true,
}) {
  const document = root.ownerDocument,
    form = node(document, 'form')
  const fieldset = node(document, 'fieldset'),
    submit = node(document, 'button', label, { type: 'submit' })
  const status = node(document, 'p', '', { role: 'status', 'aria-live': 'polite' })
  form.append(fieldset, submit, status)
  root.append(form)
  let busy = false
  const save = () => {
    if (!busy) transport.setDraft?.(read())
  }
  listen(session, form, 'input', save)
  listen(session, form, 'change', save)
  listen(session, form, 'click', save)
  listen(session, form, 'pointerdown', save)
  listen(session, form, 'submit', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const state = transport.getSnapshot()
    if (busy || !interactive(state) || !eligible(state)) return
    const payload = read()
    transport.setDraft?.(payload)
    busy = true
    if (transport.emit(event, payload) === false) busy = false
    render(transport.getSnapshot())
  })
  function render(state) {
    if (!state.pending) busy = false
    const disabled = busy || !interactive(state) || !eligible(state)
    fieldset.disabled = disabled
    submit.disabled = disabled
    const result = getLiveResult(state)
    const message =
      state.pending || busy
        ? 'Submitting…'
        : state.error ||
          state.receipt?.error ||
          (result
            ? result.valid === false
              ? 'Invalid answer. Please edit and try again.'
              : result.correct === true
                ? 'Correct.'
                : result.correct === false
                  ? result.terminal
                    ? 'Incorrect. No attempts remaining.'
                    : interactive(state)
                      ? 'Incorrect. You may try again.'
                      : 'Incorrect.'
                  : 'Answer received.'
            : state.ownSubmission
              ? 'Submission received.'
              : '')
    if (status.textContent !== message) status.textContent = message
  }
  return { form, fieldset, submit, status, render }
}
function renderReveal(element, state) {
  const revealed = state.revealed?.question
  element.replaceChildren()
  if (!revealed) return
  if (revealed.explanation) element.append(node(element.ownerDocument, 'p', revealed.explanation))
  const key = revealed.answerKey,
    question = state.question
  if (!key || !question) return
  const label = (id) => question.options?.find?.((option) => option.id === id)?.text || id
  let answer = ''
  if (key.optionId) answer = label(key.optionId)
  else if (key.optionIds) answer = key.optionIds.map(label).join(', ')
  else if (typeof key.value === 'boolean') answer = String(key.value)
  else if (key.accepted) answer = key.accepted.join(' / ')
  else if (key.itemIds) answer = key.itemIds.map(label).join(' → ')
  else if (key.pairs)
    answer = key.pairs
      .map(
        (pair) =>
          `${question.options.left.find((item) => item.id === pair.leftId)?.text} → ${question.options.right.find((item) => item.id === pair.rightId)?.text}`
      )
      .join('; ')
  else if (key.regions) answer = key.regions.map((region) => label(region.id)).join(', ')
  if (answer) element.append(node(element.ownerDocument, 'p', `Answer: ${answer}`))
}
module.exports = { interactive, getLiveResult, createLiveForm, renderReveal }
