const { node, listen } = require('../dom.js')
const { createQuizAnswerControls } = require('../quiz-answer-controls.js')
const { createRoundGamesView } = require('./round-games-view.js')

function presentTriviaChamp({ root, config, session, reset, clock }) {
  const view = createRoundGamesView({ root, session, reset, clock }),
    document = view.document
  let scores = [],
    roundRows = [],
    bonusLabel,
    answers = null
  const commandFor = (state, type, extra = {}) => ({
    type,
    generation: state.generation,
    turn: state.turn,
    roundId: state.roundId,
    questionId: state.questionId,
    ...extra,
  })
  const send = (command) => {
    session.dispatch(command)
    render(session.getState())
  }
  function render(state) {
    if (view.build(JSON.stringify([state.generation, state.turn, state.phase, state.buzzTeamId]))) {
      answers = null
      view.body.append(node(document, 'h3', config.title))
      const rounds = node(document, 'ol', undefined, { 'aria-label': 'Authored rounds' })
      roundRows = config.rounds.map((round) => {
        const row = node(document, 'li', `${round.name} — ${round.mode} — ${round.timeLimit}s`)
        rounds.append(row)
        return { round, row }
      })
      view.body.append(rounds)
      const board = node(document, 'ul', undefined, { 'aria-label': 'Scores' })
      scores = config.teams.map((team) => {
        const row = node(document, 'li')
        board.append(row)
        return { team, row }
      })
      view.body.append(board)
      bonusLabel = node(document, 'p')
      view.body.append(bonusLabel)
      if (state.phase === 'setup')
        view.control('Start championship', 'start', () => send(commandFor(state, 'start')))
      if (['active', 'review'].includes(state.phase)) {
        const round = config.rounds[state.roundIndex],
          question = config.questions.find((question) => question.id === state.questionId)
        view.body.append(
          node(
            document,
            'h4',
            `${round.name}: ${state.questionIndex + 1}/${round.questionIds.length} — ${question.prompt}`
          )
        )
        if (question.media && question.kind !== 'image-hotspot') {
          const image = node(document, 'img', undefined, question.media)
          image.style.maxWidth = '100%'
          view.body.append(image)
        }
        if (state.phase === 'active') {
          if (!state.buzzTeamId) {
            for (const mode of ['normal', 'lightning', 'jackpot'])
              if (mode === 'normal' || config[`${mode}Round`].enabled) {
                view.control(
                  mode === 'normal'
                    ? 'Normal scoring'
                    : mode === 'lightning'
                      ? 'Lightning ×3'
                      : `Jackpot ×${config.jackpotRound.multiplier}`,
                  `bonus-${mode}`,
                  () => send(commandFor(state, 'bonus', { mode }))
                )
              }
          }
          if (round.mode === 'buzzer' && !state.buzzTeamId) {
            for (const team of config.teams)
              view.control(`Buzz: ${team.name}`, `buzz-${team.id}`, () =>
                send(commandFor(state, 'buzz', { teamId: team.id }))
              )
          } else {
            const form = node(document, 'form'),
              teamSelect = node(document, 'select', undefined, {
                'aria-label':
                  round.mode === 'individual' ? 'Answering participant team' : 'Answering team',
              })
            for (const team of config.teams)
              teamSelect.append(node(document, 'option', team.name, { value: team.id }))
            if (state.buzzTeamId) {
              teamSelect.value = state.buzzTeamId
              teamSelect.disabled = true
            }
            answers = createQuizAnswerControls({ document, question, session: view.session })
            form.append(
              teamSelect,
              answers.element,
              node(document, 'button', 'Submit answer', { type: 'submit' })
            )
            listen(view.session, form, 'submit', (event) => {
              event.preventDefault()
              send(
                commandFor(state, 'answer', {
                  teamId: teamSelect.value,
                  answer: answers.getAnswer(),
                })
              )
            })
            view.body.append(form)
          }
        } else {
          if (question.feedback.explanation)
            view.body.append(node(document, 'p', question.feedback.explanation))
          view.control('Next question / round', 'next', () => send(commandFor(state, 'next')))
        }
      }
    }
    for (const entry of scores)
      entry.row.textContent = `${entry.team.name}: ${state.scores[entry.team.id]}`
    for (const entry of roundRows) {
      if (entry.round.id === state.roundId) entry.row.setAttribute('aria-current', 'step')
      else entry.row.removeAttribute('aria-current')
    }
    bonusLabel.textContent = `Scoring: ${state.bonus}${state.buzzTeamId ? ` — ${config.teams.find((team) => team.id === state.buzzTeamId).name} won the buzz (+${config.buzzPoints})` : ''}`
    const due = state.phase === 'active' ? state.deadline : null
    view.timer(due)
    view.schedule(state, due, commandFor(state, 'deadline'), render)
    const winner = config.teams.find((team) => team.id === state.winnerId)
    view.feedback(
      state.error ||
        (state.phase === 'ended'
          ? `${winner.name} wins!`
          : state.phase === 'review'
            ? state.correct
              ? 'Correct answer.'
              : 'Incorrect answer.'
            : state.phase === 'active'
              ? 'Question in progress.'
              : 'Ready to start.')
    )
  }
  return { render, pause: () => answers?.cancel() }
}
module.exports = { presentTriviaChamp }
