const { node, listen, button } = require('../dom.js')
const { isId } = require('../../question-shape.js')
const { createRoundGamesView } = require('./round-games-view.js')

function presentFourCorners({ root, config, session, reset, clock }) {
  clock = session.clock || clock
  const view = createRoundGamesView({ root, session, reset, clock }),
    document = view.document
  const participants = new Map()
  let participantId = '',
    cornerRows = [],
    board,
    start,
    selection
  const commandFor = (state, type, extra = {}) => ({
    type,
    generation: state.generation,
    questionId: state.currentQuestion?.id,
    ...extra,
  })
  const send = (command) => {
    session.dispatch(command)
    render(session.getState())
  }
  function roster() {
    const form = node(document, 'form', undefined, { 'data-ns-roster-form': '' })
    const id = node(document, 'input', undefined, {
      'aria-label': 'Participant ID',
      required: '',
      autocomplete: 'off',
    })
    const name = node(document, 'input', undefined, {
      'aria-label': 'Participant name',
      required: '',
      autocomplete: 'off',
    })
    const add = button(document, 'Add participant', 'add-participant')
    add.type = 'submit'
    const select = node(document, 'select', undefined, { 'aria-label': 'Current participant' })
    for (const [value, label] of participants)
      select.append(node(document, 'option', `${label} (${value})`, { value }))
    select.value = participantId
    form.append(
      node(document, 'label', 'Participant ID '),
      id,
      node(document, 'label', 'Participant name '),
      name,
      add
    )
    view.body.append(form, select)
    listen(view.session, form, 'submit', (event) => {
      event.preventDefault()
      const value = id.value.trim(),
        label = name.value.trim()
      if (!isId(value) || !label) {
        view.feedback('Enter a participant ID and name.')
        return
      }
      if (participants.has(value)) {
        view.feedback('This participant ID already exists; choose it from the roster.')
        return
      }
      participants.set(value, label)
      participantId = value
      render(session.getState())
    })
    listen(view.session, select, 'change', () => {
      participantId = select.value
      render(session.getState())
    })
  }
  function render(state) {
    const question = state.currentQuestion
    if (
      view.build(
        JSON.stringify([
          state.generation,
          state.questionIndex,
          state.phase,
          participantId,
          participants.size,
        ])
      )
    ) {
      cornerRows = []
      start = undefined
      view.body.append(
        node(document, 'h3', config.title),
        node(
          document,
          'p',
          'Local classroom — one device; choose each learner before recording a corner.'
        )
      )
      roster()
      selection = node(document, 'p', '', { 'aria-label': 'Current corner' })
      board = node(document, 'ul', undefined, { 'aria-label': 'Participant scores' })
      view.body.append(selection, board)
      if (state.phase === 'setup')
        start = view.control('Start round', 'start', () => send(commandFor(state, 'start-round')))
      if (question && state.phase !== 'ended') {
        view.body.append(
          node(
            document,
            'h4',
            `Round ${state.questionIndex + 1}/${state.roundCount}: ${question.prompt}`
          )
        )
        if (question.media) {
          const image = node(document, 'img', undefined, question.media)
          image.style.cssText = 'max-width:100%;max-height:240px;object-fit:contain'
          view.body.append(image)
        }
        const corners = node(document, 'div', undefined, {
          role: 'group',
          'aria-label': 'Choose a corner',
        })
        cornerRows = question.options.map((option) => {
          const control = view.control(
            option.text,
            `corner-${option.id}`,
            () => {
              if (participants.has(participantId))
                send(commandFor(state, 'vote', { participantId, cornerId: option.id }))
            },
            corners
          )
          control.setAttribute('aria-pressed', 'false')
          if (option.media) {
            const image = node(document, 'img', undefined, option.media)
            image.style.cssText = 'max-width:100%;max-height:160px;object-fit:contain'
            control.append(image)
          }
          const total = node(document, 'span', '', { 'data-ns-corner-total': option.id })
          control.append(total)
          return { option, control, total }
        })
        view.body.append(corners)
        if (state.phase === 'guessing')
          view.control('Reveal correct corner', 'reveal', () => send(commandFor(state, 'reveal')))
        if (state.phase === 'revealed') {
          const correct = question.options.find(
            (option) => option.id === question.answerKey.optionId
          )
          view.body.append(node(document, 'p', `Correct corner: ${correct.text}`))
          if (question.feedback.explanation)
            view.body.append(node(document, 'p', question.feedback.explanation))
          view.control(
            state.questionIndex + 1 < state.roundCount ? 'Next round' : 'Finish game',
            'next',
            () => send(commandFor(state, 'start-round'))
          )
        }
      }
      if (state.phase !== 'ended')
        view.control('End game', 'end', () => send(commandFor(state, 'end')))
    }
    if (start) start.disabled = participants.size === 0
    const vote = Object.hasOwn(state.votes, participantId) ? state.votes[participantId] : undefined,
      eliminated = state.eliminated.includes(participantId)
    selection.textContent = participantId
      ? `${participants.get(participantId)}: ${question?.options.find((option) => option.id === vote)?.text || 'No corner selected'}${eliminated ? ' — eliminated' : ''}`
      : 'Add a named participant to begin.'
    for (const { option, control, total } of cornerRows) {
      control.disabled =
        state.phase !== 'guessing' || !participants.has(participantId) || eliminated
      control.setAttribute('aria-pressed', String(vote === option.id))
      total.textContent = ` — ${Object.values(state.votes).filter((id) => id === option.id).length} participants`
    }
    board.replaceChildren(
      ...[...participants].map(([id, name]) =>
        node(
          document,
          'li',
          `${name}: ${Object.hasOwn(state.scores, id) ? state.scores[id] : 0}${state.eliminated.includes(id) ? ' — eliminated' : ''}`
        )
      )
    )
    const due = state.phase === 'guessing' ? state.deadline : null
    view.timer(due)
    view.schedule(state, due, commandFor(state, 'deadline'), render)
    const timer = root.querySelector('[role=timer]')
    timer.hidden = !config.showTimer
    if (state.phase === 'guessing' && due === null) timer.textContent = 'No time limit'
    let message =
      state.phase === 'ended'
        ? 'Game ended.'
        : state.phase === 'revealed'
          ? 'Correct corner revealed; scores recorded.'
          : 'Choose a participant and corner.'
    if (state.phase === 'revealed' && vote)
      message =
        vote === question.answerKey.optionId
          ? `${question.feedback.correct || 'Correct.'} ${question.points} points.`
          : `${question.feedback.incorrect || 'Incorrect.'}${eliminated ? ' Eliminated for this round.' : ''}`
    view.feedback(message)
  }
  return { render }
}
module.exports = { presentFourCorners }
