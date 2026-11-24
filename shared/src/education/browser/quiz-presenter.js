const { node, listen, button } = require('./dom.js')
const { createQuizAnswerControls } = require('./quiz-answer-controls.js')
const { projectQuizQuestion } = require('../quiz-public-projection.js')

function presentQuiz({ root, config, session, reset, clock }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const title = node(document, 'h3', config.title || 'Quiz')
  const scope = node(
    document,
    'small',
    'Local classroom — answers are included in this offline document.'
  )
  const progress = node(document, 'p'),
    timer = node(document, 'p'),
    score = node(document, 'p')
  const status = node(document, 'p', '', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  })
  const prompt = node(document, 'h4'),
    media = node(document, 'div')
  const form = node(document, 'form'),
    answers = node(document, 'div')
  const submit = node(document, 'button', 'Submit answer', { type: 'submit' })
  const next = button(document, 'Next question', 'quiz-next'),
    replay = button(document, 'Reset quiz', 'quiz-reset')
  const extend = button(document, 'Add 30 seconds', 'quiz-extend-time')
  const explanation = node(document, 'p'),
    solution = node(document, 'p')
  form.append(answers, submit)
  ui.replaceChildren(
    title,
    scope,
    progress,
    timer,
    extend,
    score,
    status,
    prompt,
    media,
    form,
    explanation,
    solution,
    next,
    replay
  )
  let controls,
    questionToken,
    timerToken,
    cancelTimer,
    attemptNumber = 0
  session.own(() => {
    cancelTimer?.()
    ui.replaceChildren()
  })
  function dispatch(type, fields = {}) {
    const state = session.getState()
    return session.dispatch({
      type,
      generation: state.generation,
      questionId: state.questionId,
      now: clock.now(),
      ...fields,
    })
  }
  function armTimer(state) {
    const token = `${state.generation}/${state.questionId}`
    if (state.status !== 'active' || state.deadline === null) {
      cancelTimer?.()
      cancelTimer = undefined
      timerToken = undefined
      return
    }
    if (token === timerToken) return
    cancelTimer?.()
    timerToken = token
    const tick = () => {
      const current = session.getState()
      if (
        current.generation !== state.generation ||
        current.questionId !== state.questionId ||
        current.status !== 'active'
      )
        return
      if (clock.now() >= current.deadline) dispatch('expire')
      else {
        render(current)
        cancelTimer = session.schedule(
          tick,
          Math.min(250, Math.max(0, current.deadline - clock.now()))
        )
      }
    }
    cancelTimer = session.schedule(tick, Math.min(250, Math.max(0, state.deadline - clock.now())))
  }
  function render(state) {
    const question = state.config.questions.find((item) => item.id === state.questionId)
    const token = `${state.generation}/${state.questionId}`
    if (token !== questionToken) {
      controls?.cancel?.()
      controls?.destroy?.()
      questionToken = token
      answers.replaceChildren()
      media.replaceChildren()
      controls = undefined
      prompt.textContent = question?.prompt || 'Quiz complete'
      if (question) {
        controls = createQuizAnswerControls({ document, question, session })
        if (controls.destroy) session.own(controls.destroy)
        answers.append(controls.element)
        if (question.media && question.kind !== 'image-hotspot') {
          const image = node(document, 'img', undefined, question.media)
          image.style.cssText = 'max-width:100%;max-height:240px;object-fit:contain'
          media.append(image)
        }
      }
    }
    const projected = question ? projectQuizQuestion(question, state) : null
    if (controls?.setDisabled) controls.setDisabled(state.status !== 'active')
    else if (controls) controls.element.disabled = state.status !== 'active'
    form.hidden = !question
    submit.disabled = state.status !== 'active'
    extend.hidden = !question || state.deadline === null
    extend.disabled = state.status !== 'active'
    next.hidden = state.status !== 'terminal'
    next.textContent =
      state.questionIndex + 1 < state.questionIds.length ? 'Next question' : 'Finish quiz'
    progress.textContent = question
      ? `Question ${state.questionIndex + 1} of ${state.questionIds.length} • Attempts ${projected.attemptsUsed}/${config.attemptLimit}`
      : `${state.questionIds.length} questions completed`
    score.hidden = !config.showScore
    score.textContent = `Score: ${state.score}`
    timer.textContent = question
      ? state.deadline === null
        ? 'No time limit'
        : `Time remaining: ${Math.max(0, Math.ceil((state.deadline - clock.now()) / 1000))} seconds`
      : ''
    explanation.textContent = projected?.reveal?.explanation || ''
    solution.textContent = projected?.reveal
      ? `Answer: ${describeAnswer(question, projected.reveal.answerKey)}`
      : ''
    let message = ''
    if (state.status === 'complete') message = 'Quiz complete.'
    else if (state.lastResult?.error === 'deadline') message = 'Time expired.'
    else if (state.lastResult?.accepted === false && state.lastResult.error)
      message = state.lastResult.error
    else if (projected?.result)
      message = `${projected.result.correct ? 'Correct.' : 'Incorrect.'} ${projected.result.message}`
    else if (projected?.attemptsUsed) message = 'Answer received.'
    if (status.textContent !== message) status.textContent = message
    armTimer(state)
  }
  listen(session, form, 'submit', (event) => {
    event.preventDefault()
    if (session.getState().status !== 'active' || !controls) return
    dispatch('submit', {
      attemptId: `quiz-attempt-${++attemptNumber}`,
      answer: controls.getAnswer(),
    })
  })
  listen(session, next, 'click', () => dispatch('next'))
  listen(session, replay, 'click', reset)
  listen(session, extend, 'click', () => dispatch('extend-time'))
  return { render, pause: () => controls?.cancel?.() }
}

function describeAnswer(question, key) {
  const label = (id) => question.options?.find?.((item) => item.id === id)?.text || id
  switch (question.kind) {
    case 'single-choice':
      return label(key.optionId)
    case 'multi-choice':
      return key.optionIds.map(label).join(', ')
    case 'true-false':
      return key.value ? 'True' : 'False'
    case 'fill-blank':
      return key.accepted.join(' / ')
    case 'ordering':
      return key.itemIds.map(label).join(' → ')
    case 'matching':
      return key.pairs
        .map(
          (pair) =>
            `${question.options.left.find((item) => item.id === pair.leftId).text} → ${question.options.right.find((item) => item.id === pair.rightId).text}`
        )
        .join('; ')
    case 'image-hotspot':
      return key.regions.map((region) => label(region.id)).join(', ')
  }
}

module.exports = { presentQuiz, describeAnswer }
