const { node, listen, button } = require('../dom.js')
const { isId } = require('../../question-shape.js')
const { createQuizAnswerControls } = require('../quiz-answer-controls.js')
const { describeAnswer } = require('../quiz-presenter.js')
const { createRoundGamesView } = require('./round-games-view.js')

function presentHotPotato({ root, config, session, reset, clock }) {
  clock = session.clock || clock
  const view = createRoundGamesView({ root, session, reset, clock }),
    document = view.document
  const participants = new Map()
  let participantId = '',
    controls,
    submit,
    board,
    score,
    start
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
      controls = undefined
      submit = undefined
      start = undefined
      view.body.append(
        node(document, 'h3', config.title),
        node(document, 'p', 'Local classroom — one device; choose the learner answering.')
      )
      roster()
      score = node(document, 'p', '', { 'aria-label': 'Participant score' })
      board = node(document, 'ol', undefined, { 'aria-label': 'Leaderboard' })
      board.hidden = !config.showLeaderboard
      view.body.append(score, board)
      if (state.phase === 'ready')
        start = view.control('Start quiz', 'start', () => send(commandFor(state, 'start')))
      if (question && state.phase !== 'ended') {
        view.body.append(
          node(
            document,
            'h4',
            `Question ${state.questionIndex + 1}/${state.roundCount}: ${question.prompt}`
          )
        )
        if (question.media && question.kind !== 'image-hotspot') {
          const image = node(document, 'img', undefined, question.media)
          image.style.cssText = 'max-width:100%;max-height:240px;object-fit:contain'
          view.body.append(image)
        }
        if (state.phase === 'active') {
          const form = node(document, 'form', undefined, { 'data-ns-answer-form': '' })
          controls = createQuizAnswerControls({ document, question, session: view.session })
          const answers = controls
          view.session.own(() => {
            answers.cancel?.()
            answers.destroy?.()
          })
          submit = button(document, 'Submit answer', 'submit-answer')
          submit.type = 'submit'
          form.append(controls.element, submit)
          view.body.append(form)
          listen(view.session, form, 'submit', (event) => {
            event.preventDefault()
            const current = session.getState()
            if (
              !participants.has(participantId) ||
              current.phase !== 'active' ||
              current.currentQuestion?.id !== question.id ||
              Object.hasOwn(current.answeredPlayers, participantId)
            )
              return
            send(
              commandFor(state, 'submit-answer', {
                playerId: participantId,
                answer: answers.getAnswer(),
              })
            )
          })
          view.control('Reveal answers', 'reveal', () => send(commandFor(state, 'reveal')))
        } else if (state.phase === 'review') {
          view.body.append(
            node(document, 'p', `Answer: ${describeAnswer(question, question.answerKey)}`)
          )
          if (question.feedback.explanation)
            view.body.append(node(document, 'p', question.feedback.explanation))
          view.control(
            state.questionIndex + 1 < state.roundCount ? 'Next question' : 'Finish quiz',
            'next',
            () => send(commandFor(state, 'next-question'))
          )
        }
      }
      if (state.phase !== 'ended')
        view.control('End game', 'end', () => send(commandFor(state, 'end')))
    }
    if (start) start.disabled = participants.size === 0
    const result = Object.hasOwn(state.answeredPlayers, participantId)
      ? state.answeredPlayers[participantId]
      : undefined
    if (controls?.setDisabled) controls.setDisabled(!participants.has(participantId) || !!result)
    else if (controls) controls.element.disabled = !participants.has(participantId) || !!result
    if (submit) submit.disabled = !participants.has(participantId) || !!result
    score.textContent = participantId
      ? `${participants.get(participantId)}: ${Object.hasOwn(state.scores, participantId) ? state.scores[participantId] : 0} points`
      : 'Add a named participant to begin.'
    const entries = [...participants]
      .map(([id, name]) => ({
        name,
        score: Object.hasOwn(state.scores, id) ? state.scores[id] : 0,
      }))
      .sort((a, b) => b.score - a.score)
    board.replaceChildren(
      ...entries.map((entry) => node(document, 'li', `${entry.name}: ${entry.score}`))
    )
    const due = state.phase === 'active' ? state.deadline : null
    view.timer(due)
    view.schedule(state, due, commandFor(state, 'deadline'), render)
    if (state.phase === 'active' && due === null)
      root.querySelector('[role=timer]').textContent = 'No time limit'
    let message =
      state.phase === 'ended'
        ? 'Game ended.'
        : state.phase === 'review'
          ? 'Answers revealed.'
          : 'Choose a participant and answer.'
    if (result && state.phase !== 'ended')
      message = `${result.late ? 'Late answer. ' : ''}${
        result.late && !config.allowLate
          ? 'Not accepted after the deadline.'
          : result.correct
            ? question.feedback.correct || 'Correct.'
            : question.feedback.incorrect || 'Incorrect.'
      } ${result.points} points.`
    else if (state.deadlinePassed && state.phase === 'active')
      message = 'Time expired; late answers are allowed.'
    if (result?.correct && state.phase !== 'ended')
      message += ` ${question.points} base + ${result.points - question.points} speed bonus.`
    if (state.deadlinePassed && state.phase === 'review' && !result)
      message = 'Time expired. Answers revealed.'
    view.feedback(state.error || message)
  }
  return { render, pause: () => controls?.cancel?.() }
}
module.exports = { presentHotPotato }
