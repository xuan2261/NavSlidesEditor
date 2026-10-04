const { node, listen, button } = require('./dom.js')

function presentScoreboard({ root, config, session, reset, variables }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const heading = node(document, 'h3', config.title),
    local = node(document, 'small', 'Local classroom — one device')
  const teams = node(document, 'div', undefined, { 'aria-label': 'Scoreboard teams' })
  const status = node(document, 'div', '', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  })
  const replay = button(document, 'Reset', 'reset')
  const boundIds = [
    ...new Set(
      config.teams.filter((team) => team.variableId !== undefined).map((team) => team.variableId)
    ),
  ]
  const scope = node(
    document,
    'p',
    config.resetBoundVariables && boundIds.length
      ? `Reset restores local scores and only this scoreboard’s bound variables: ${boundIds.join(', ')}.`
      : 'Reset restores local team scores. Deck variables are preserved.'
  )
  const rows = config.teams.map((team) => {
    const row = node(document, 'div', undefined, { role: 'region', 'aria-label': team.name })
    const name = node(document, 'h4', team.name),
      score = node(document, 'output', '', {
        'data-ns-score': team.id,
        'aria-label': `${team.name} score`,
      })
    // Colors enter only through the canonical config safety boundary.
    name.style.color = team.color
    const decrease = button(document, `−${config.step}`, 'decrease'),
      increase = button(document, `+${config.step}`, 'increase')
    decrease.setAttribute('aria-label', `Decrease ${team.name} score by ${config.step}`)
    increase.setAttribute('aria-label', `Increase ${team.name} score by ${config.step}`)
    const controls = node(document, 'div', undefined, { class: 'ns-game-controls' })
    controls.append(decrease, increase)
    row.append(name, score, controls)
    teams.append(row)
    for (const [control, direction] of [
      [decrease, -1],
      [increase, 1],
    ])
      listen(session, control, 'click', () => {
        try {
          if (team.variableId !== undefined) {
            if (!variables) throw new RangeError('Choose a declared interaction variable.')
            variables.change(team.variableId, direction * config.step)
            render(session.getState())
          } else {
            const before = session.getState(),
              after = session.dispatch({ type: 'change', teamId: team.id, direction })
            if (after === before) render(after)
          }
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : String(error)
        }
      })
    return { team, score, decrease, increase }
  })
  ui.replaceChildren(heading, local, teams, status, scope, replay)
  session.own(() => ui.replaceChildren())
  if (boundIds.length && variables)
    session.own(variables.subscribe(() => render(session.getState())))
  listen(session, replay, 'click', () => {
    try {
      if (config.resetBoundVariables && boundIds.length) {
        if (!variables) throw new RangeError('Choose a declared interaction variable.')
        variables.reset(boundIds)
      }
      reset()
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : String(error)
    }
  })
  function render(state) {
    const summary = [],
      failures = []
    for (const { team, score, decrease, increase } of rows) {
      try {
        const value =
          team.variableId !== undefined ? variables?.read(team.variableId) : state.scores[team.id]
        if (!Number.isFinite(value)) throw new RangeError('Choose a declared interaction variable.')
        score.textContent = String(value)
        decrease.disabled = team.variableId === undefined && value <= config.minScore
        increase.disabled = team.variableId === undefined && value >= config.maxScore
        summary.push(`${team.name}: ${value}`)
      } catch (error) {
        score.textContent = 'Unavailable'
        decrease.disabled = true
        increase.disabled = true
        failures.push(`${team.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const message = failures.length ? failures.join('. ') : summary.join(' · ')
    if (status.textContent !== message) status.textContent = message
  }
  return { render }
}
module.exports = { presentScoreboard }
