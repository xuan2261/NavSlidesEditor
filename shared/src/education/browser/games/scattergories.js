const { node, listen } = require('../dom.js')
const { createRoundGamesView } = require('./round-games-view.js')

function presentScattergories({ root, config, session, reset, clock }) {
  const view = createRoundGamesView({ root, session, reset, clock }),
    document = view.document
  let fields = [],
    scores = [],
    letterLabel,
    reviewButton,
    nextButton
  const commandFor = (state, type, extra = {}) => ({
    type,
    generation: state.generation,
    round: state.round,
    ...extra,
  })
  const send = (command) => {
    session.dispatch(command)
    render(session.getState())
  }
  function render(state) {
    // Review disables the existing fields, preserving response text, focus and node identity.
    if (
      view.build(
        JSON.stringify([
          state.generation,
          state.round,
          ['playing', 'review'].includes(state.phase) ? 'board' : state.phase,
        ])
      )
    ) {
      view.body.append(node(document, 'h3', config.title))
      letterLabel = node(document, 'h4')
      view.body.append(letterLabel)
      fields = []
      scores = []
      reviewButton = null
      nextButton = null
      if (state.phase === 'setup') {
        const form = node(document, 'form'),
          label = node(document, 'label', 'Starting letter ')
        const letter = node(document, 'input', undefined, {
          type: 'text',
          'data-ns-letter': '',
          'aria-label': 'Starting letter',
        })
        letter.value = config.letter
        letter.disabled = config.letterMode === 'random'
        label.append(letter)
        form.append(
          label,
          node(
            document,
            'button',
            config.letterMode === 'random' ? 'Choose random letter and start' : 'Start round',
            { type: 'submit' }
          )
        )
        listen(view.session, form, 'submit', (event) => {
          event.preventDefault()
          send(commandFor(state, 'start', { letter: letter.value }))
        })
        view.body.append(form)
      }
      if (['playing', 'review'].includes(state.phase)) {
        const form = node(document, 'form'),
          categories = node(document, 'div')
        for (const category of config.categories) {
          const group = node(document, 'fieldset')
          group.append(node(document, 'legend', category.label))
          for (const team of config.teams) {
            const label = node(document, 'label', `${team.name} `),
              input = node(document, 'input', undefined, {
                type: 'text',
                autocomplete: 'off',
                'data-ns-category': category.id,
                'data-ns-team': team.id,
                'aria-label': `${category.label}: ${team.name}`,
              })
            const result = node(document, 'span')
            label.append(input, result)
            group.append(label)
            label.style.display = 'block'
            input.style.maxWidth = '100%'
            listen(view.session, input, 'input', () =>
              send(
                commandFor(state, 'answer', {
                  teamId: team.id,
                  categoryId: category.id,
                  text: input.value,
                })
              )
            )
            fields.push({ category, team, input, result })
          }
          categories.append(group)
        }
        reviewButton = node(document, 'button', 'Score now', {
          type: 'submit',
          'data-ns-command': 'review',
        })
        form.append(categories, reviewButton)
        listen(view.session, form, 'submit', (event) => {
          event.preventDefault()
          send(commandFor(state, 'review'))
        })
        view.body.append(form)
        const board = node(document, 'ul', undefined, { 'aria-label': 'Round scores' })
        scores = config.teams.map((team) => {
          const row = node(document, 'li')
          board.append(row)
          return { team, row }
        })
        view.body.append(board)
        nextButton = view.control('New Round', 'new-round', () =>
          send(commandFor(state, 'new-round'))
        )
      }
    }
    letterLabel.textContent = state.letter
      ? `Round ${state.round}: starts with ${state.letter}`
      : `Round ${state.round}: choose a letter`
    for (const field of fields) {
      const text = state.answers[field.category.id]?.[field.team.id] ?? ''
      if (field.input.value !== text) field.input.value = text
      field.input.disabled = state.phase === 'review'
      field.result.textContent =
        state.phase === 'review' ? ` — +${state.results[field.category.id][field.team.id]}` : ''
    }
    for (const entry of scores)
      entry.row.textContent = `${entry.team.name}: ${state.scores[entry.team.id]}`
    if (reviewButton) reviewButton.disabled = state.phase !== 'playing'
    if (nextButton) nextButton.hidden = state.phase !== 'review'
    const due = state.phase === 'playing' ? state.deadline : null
    view.timer(due)
    view.schedule(state, due, commandFor(state, 'deadline'), render)
    const winner = config.teams.find((team) => team.id === state.winnerId)
    view.feedback(
      state.error ||
        (state.phase === 'review'
          ? `Review complete. ${winner.name} leads this round with ${state.scores[winner.id]} points. Scoring: ${config.scoring}.`
          : state.phase === 'playing'
            ? 'Enter one answer for each category and team.'
            : 'Ready to start.')
    )
  }
  return { render }
}
module.exports = { presentScattergories }
