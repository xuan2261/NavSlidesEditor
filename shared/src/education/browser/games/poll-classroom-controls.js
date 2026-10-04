const { node, listen, button } = require('../dom.js')
const { isSafeMediaSrc } = require('../../../content-safety.js')
function appendSubmissionMedia(document, parent, media) {
  if (media && isSafeMediaSrc(media.src) && typeof media.alt === 'string' && media.alt.trim()) {
    const image = node(document, 'img', undefined, { src: media.src, alt: media.alt })
    image.style.maxWidth = '100%'
    image.style.maxHeight = '100px'
    parent.append(image)
  }
}
function createClassroomControls({ document, session, reset, clock, type, clear = false }) {
  const element = node(document, 'div', undefined, { class: 'ns-classroom-controls' })
  const roster = node(document, 'form', undefined, { 'data-ns-roster-form': '' })
  const name = node(document, 'input', undefined, {
    type: 'text',
    required: '',
    maxlength: '200',
    'aria-label': 'Participant name',
    'data-ns-participant-name': '',
  })
  const add = node(document, 'button', 'Add participant', { type: 'submit' })
  const participant = node(document, 'select', undefined, {
    'aria-label': 'Current participant',
    'data-ns-participant-select': '',
  })
  const leave = button(document, 'Remove participant', 'leave')
  roster.append(name, add)
  element.append(node(document, 'p', 'Local classroom — one device'), roster, participant, leave)
  const host = node(document, 'div', undefined, { class: 'ns-game-controls' })
  const start = button(document, 'Start', 'start'),
    reveal = button(document, 'Reveal results', 'reveal'),
    replay = button(document, 'Reset', 'reset')
  host.append(start, reveal)
  if (clear) {
    const clearButton = button(document, 'Clear words', 'clear')
    host.append(clearButton)
    listen(session, clearButton, 'click', () => send('clear'))
  }
  host.append(replay)
  element.append(host)
  const timer = node(document, 'output', undefined, {
    'data-ns-timer': '',
    'aria-label': 'Time remaining',
  })
  const status = node(document, 'p', undefined, { role: 'status', 'aria-live': 'polite' })
  element.append(timer, status)
  let identity = 0,
    action = 0,
    rosterKey = '',
    cancelTick = null,
    alive = true
  const send = (commandType, fields = {}) => {
    const state = session.getState()
    return session.dispatch({
      type: commandType,
      generation: state.generation,
      roundId: state.roundId,
      ...fields,
    })
  }
  listen(session, roster, 'submit', (event) => {
    event.preventDefault()
    if (!name.value.trim()) return
    const participantId = `participant-${session.getState().generation}-${++identity}`
    send('join', { participantId, name: name.value })
    participant.value = participantId
    name.value = ''
    participant.dispatchEvent(new document.defaultView.Event('change', { bubbles: true }))
  })
  listen(session, leave, 'click', () => send('leave', { participantId: participant.value }))
  listen(session, start, 'click', () => send('start'))
  listen(session, reveal, 'click', () => send('reveal'))
  listen(session, replay, 'click', reset)
  const messages = {
    'player-not-found': 'Add and select a participant first.',
    'vote-change-disabled': 'This participant has already voted; changes are disabled.',
    'empty-word-cloud-text': 'Enter a nonempty word or phrase.',
    'word-cloud-rate-limit': 'This participant has used all submissions.',
    'invalid-poll-option': 'Select a poll option.',
    'invalid-matching-pairs': 'Use each prompt and target at most once.',
    'action-id-conflict': 'This action was already used for another submission.',
  }
  function render(state) {
    const key = JSON.stringify(state.participants)
    if (key !== rosterKey) {
      rosterKey = key
      const selected = participant.value
      participant.replaceChildren(
        ...state.participants.map((row) => node(document, 'option', row.name, { value: row.id }))
      )
      if (state.participants.some((row) => row.id === selected)) participant.value = selected
    }
    participant.disabled = !state.participants.length
    leave.disabled = !state.participants.length
    start.disabled = state.phase === 'active'
    timer.textContent =
      state.phase === 'active'
        ? `${Math.max(0, Math.ceil((state.deadline - clock.now()) / 1000))} seconds remaining`
        : state.phase === 'ended'
          ? 'Round ended'
          : 'Ready to start'
    const result = state.lastResult
    status.textContent = result?.error
      ? messages[result.error] ||
        (result.error === `${type}-not-active` ? 'Start a new round to submit.' : result.error)
      : result?.ok
        ? result.score !== undefined
          ? `${result.score} / ${result.total} pairs correct`
          : 'Submission accepted.'
        : ''
    cancelTick?.()
    cancelTick = null
    if (state.phase === 'active' && alive) {
      const generation = state.generation,
        roundId = state.roundId
      cancelTick = session.schedule(
        () => {
          cancelTick = null
          const current = session.getState()
          if (!alive || current.generation !== generation || current.roundId !== roundId) return
          const next = send('expire')
          if (next === current) render(next)
        },
        Math.min(250, Math.max(0, state.deadline - clock.now()))
      )
    }
  }
  session.own(() => {
    alive = false
    cancelTick?.()
  })
  return {
    element,
    render,
    send,
    participant,
    status,
    submit(fields) {
      return send(type === 'poll' ? 'vote' : 'submit', {
        participantId: participant.value,
        actionId: `${session.getState().generation}:${type}:${++action}`,
        ...fields,
      })
    },
  }
}
module.exports = { createClassroomControls, appendSubmissionMedia }
