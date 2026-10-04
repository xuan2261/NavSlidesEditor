const { node, listen, button } = require('./dom.js')
const { validateCrosswordLayout } = require('../crossword-layout.js')
const { bindWordGrid, bindCrosswordInputs } = require('./word-grid-controls.js')

function presentCrossword({
  root,
  config,
  session,
  reset,
  puzzle = validateCrosswordLayout(config),
}) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const grid = node(document, 'div', undefined, {
    role: 'group',
    'aria-label': 'Crossword grid',
    'data-rows': puzzle.rows,
    'data-columns': puzzle.columns,
  })
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${puzzle.columns},2.75rem);gap:3px;overflow:auto;max-width:100%;flex-shrink:0`
  const inputs = new Map(),
    clues = new Map()
  let selected = puzzle.placements[0]
  for (let row = 0; row < puzzle.rows; row++)
    for (let column = 0; column < puzzle.columns; column++) {
      if (puzzle.grid[row][column] === null) {
        grid.append(node(document, 'span', undefined, { 'aria-hidden': 'true' }))
        continue
      }
      const starts = puzzle.placements.filter(
        (entry) => entry.row === row && entry.column === column
      )
      const input = node(document, 'input', undefined, {
        type: 'text',
        'data-row': row,
        'data-column': column,
        'aria-label': `Row ${row + 1}, column ${column + 1}${starts.length ? `, clue ${starts[0].number}` : ''}`,
        autocomplete: 'off',
        spellcheck: 'false',
        tabindex: inputs.size ? '-1' : '0',
      })
      input.style.cssText =
        'width:2.75rem;height:2.75rem;text-align:center;color:inherit;background:transparent;border:1px solid currentColor'
      inputs.set(`${row}:${column}`, input)
      grid.append(input)
    }
  const clueList = node(document, 'div', undefined, { 'aria-label': 'Clues' })
  const active = node(document, 'p'),
    status = node(document, 'output', undefined, { 'aria-live': 'polite' })
  const toggle = button(document, 'Toggle crossing direction', 'toggle-direction')
  const check = button(document, 'Check answers', 'submit'),
    replay = button(document, 'Reset', 'reset')
  ui.replaceChildren(
    node(document, 'h3', config.title || 'Crossword'),
    node(document, 'small', 'Local classroom — one device'),
    active,
    grid,
    clueList,
    toggle,
    check,
    replay,
    status
  )
  session.own(() => ui.replaceChildren())
  const includes = (entry, cell) =>
    entry.path.some(
      (part) => part.row === Number(cell.dataset.row) && part.column === Number(cell.dataset.column)
    )
  function choose(cell, cycle = false) {
    const entries = puzzle.placements.filter((entry) => includes(entry, cell))
    selected = cycle
      ? entries[(entries.indexOf(selected) + 1) % entries.length]
      : entries.find((entry) => entry.id === selected.id) || entries[0]
    mark()
  }
  function mark() {
    active.textContent = `${selected.number} ${selected.direction}: ${selected.clue}`
    inputs.forEach((input) => {
      input.style.outline = includes(selected, input) ? '2px solid var(--ns-accent,#6366f1)' : ''
    })
  }
  const controls = bindWordGrid({
    grid,
    session,
    onActivate: (cell) => choose(cell, true),
    onSubmit: () => session.dispatch({ type: 'submit', entryId: selected.id }),
    onToggle: () => {
      const cell = document.activeElement
      if (grid.contains(cell)) choose(cell, true)
    },
  })
  listen(session, grid, 'focusin', (event) => {
    if (event.target.matches('input[data-row]')) choose(event.target)
  })
  const composition = bindCrosswordInputs({
    grid,
    puzzle,
    session,
    activeEntry: () => selected,
    ...controls,
  })
  for (const entry of puzzle.placements) {
    const clue = button(
      document,
      `${entry.number} ${entry.direction}: ${entry.clue}`,
      `clue-${entry.id}`
    )
    clues.set(entry.id, clue)
    clueList.append(clue)
    listen(session, clue, 'click', () => {
      selected = entry
      controls.focus(controls.find(entry.row, entry.column))
      mark()
    })
  }
  listen(session, toggle, 'click', () => {
    const input = controls.find(selected.row, selected.column)
    choose(input, true)
    controls.focus(input)
  })
  listen(session, check, 'click', () => {
    if (![...inputs.values()].some(composition.isComposing)) session.dispatch({ type: 'submit' })
  })
  listen(session, replay, 'click', reset)
  mark()
  function render(state) {
    inputs.forEach((input, key) => {
      input.readOnly = state.completed
      if (!composition.isComposing(input) && input.value !== (state.values[key] || ''))
        input.value = state.values[key] || ''
    })
    clues.forEach((clue, id) => {
      clue.setAttribute('aria-pressed', String(state.foundIds.includes(id)))
    })
    status.textContent = state.completed
      ? 'Crossword complete!'
      : `${state.foundIds.length}/${puzzle.placements.length} solved${state.lastResult === 'incorrect' ? ' — Check letters and try again.' : ''}`
  }
  return { render }
}
module.exports = { presentCrossword }
