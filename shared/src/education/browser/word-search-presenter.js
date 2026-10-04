const { node, listen, button } = require('./dom.js')
const { generateWordSearch } = require('../word-search-generator.js')
const { selectionPath } = require('../word-search-selection.js')
const { bindWordGrid } = require('./word-grid-controls.js')

function presentWordSearch({ root, config, session, reset, puzzle = generateWordSearch(config) }) {
  const document = root.ownerDocument,
    ui = root.querySelector('[data-ns-game-ui]')
  const grid = node(document, 'div', undefined, {
    role: 'group',
    'aria-label': 'Word search grid',
    'data-rows': puzzle.rows,
    'data-columns': puzzle.columns,
  })
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${puzzle.columns},2.75rem);gap:3px;overflow:auto;max-width:100%;flex-shrink:0`
  const cells = [],
    words = new Map()
  for (let row = 0; row < puzzle.rows; row++)
    for (let column = 0; column < puzzle.columns; column++) {
      const cell = button(document, puzzle.grid[row][column], 'word-cell')
      cell.dataset.row = row
      cell.dataset.column = column
      cell.tabIndex = cells.length ? -1 : 0
      cell.setAttribute(
        'aria-label',
        `Row ${row + 1}, column ${column + 1}: ${puzzle.grid[row][column]}`
      )
      cell.style.cssText = 'width:2.75rem;height:2.75rem;touch-action:manipulation'
      grid.append(cell)
      cells.push(cell)
    }
  const list = node(document, 'ul'),
    status = node(document, 'output', undefined, { 'aria-live': 'polite' })
  const choice = node(document, 'select', undefined, {
    'aria-label': 'Word for coordinate selection',
  })
  for (const word of config.words) {
    const item = node(document, 'li', word.text)
    words.set(word.id, item)
    list.append(item)
    choice.append(node(document, 'option', word.text, { value: word.id }))
  }
  const form = node(document, 'form'),
    coordinates = []
  for (const [label, max] of [
    ['Start row', puzzle.rows],
    ['Start column', puzzle.columns],
    ['End row', puzzle.rows],
    ['End column', puzzle.columns],
  ]) {
    const input = node(document, 'input', undefined, {
      type: 'number',
      min: 1,
      max,
      required: '',
      'aria-label': label,
    })
    input.value = '1'
    coordinates.push(input)
    const field = node(document, 'label', label)
    field.append(input)
    form.append(field)
  }
  const coordinateSubmit = node(document, 'button', 'Submit coordinates', { type: 'submit' })
  form.prepend(choice)
  form.append(coordinateSubmit)
  const submit = button(document, 'Submit selected path', 'submit'),
    cancel = button(document, 'Clear selection', 'clear'),
    replay = button(document, 'Reset', 'reset')
  ui.replaceChildren(
    node(document, 'h3', config.title || 'Word Search'),
    node(document, 'small', 'Local classroom — one device'),
    node(
      document,
      'p',
      'Click or tap start and end. Keyboard: arrows move, Space selects endpoints, Enter submits. Coordinates are 1-based.'
    ),
    grid,
    list,
    submit,
    cancel,
    form,
    replay,
    status
  )
  session.own(() => ui.replaceChildren())
  let start = null,
    end = null,
    drag = null,
    suppressClick = false,
    clearClick = null
  const coordinate = (cell) => ({
    row: Number(cell.dataset.row),
    column: Number(cell.dataset.column),
  })
  const same = (a, b) => a && b && a.row === b.row && a.column === b.column
  function mark() {
    const path = start && end ? selectionPath(puzzle, start, end) : start ? [start] : []
    cells.forEach((cell) => {
      cell.setAttribute(
        'aria-pressed',
        String((path || []).some((part) => same(part, coordinate(cell))))
      )
    })
  }
  function cancelSelection() {
    start = end = drag = null
    suppressClick = false
    clearClick?.()
    clearClick = null
    mark()
  }
  session.own(cancelSelection)
  function activate(cell) {
    if (suppressClick) {
      suppressClick = false
      return
    }
    if (!start || end) {
      start = coordinate(cell)
      end = null
    } else end = coordinate(cell)
    mark()
  }
  function send() {
    session.dispatch({
      type: 'submit',
      path: start && end ? selectionPath(puzzle, start, end) || [] : [],
    })
    cancelSelection()
  }
  bindWordGrid({ grid, session, onActivate: activate, onSubmit: send, onToggle: cancelSelection })
  listen(session, grid, 'pointerdown', (event) => {
    const cell = event.target.closest('[data-row]')
    if (drag || !cell || !grid.contains(cell) || event.button !== 0) return
    clearClick?.()
    clearClick = null
    suppressClick = false
    drag = { start: coordinate(cell), pointerId: event.pointerId }
  })
  listen(session, document, 'pointerup', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return
    const previous = drag
    drag = null
    const cell = event.target.closest?.('[data-row]')
    if (cell && grid.contains(cell) && !same(previous.start, coordinate(cell))) {
      start = previous.start
      end = coordinate(cell)
      mark()
      send()
      suppressClick = true
      clearClick = session.schedule(() => {
        suppressClick = false
        clearClick = null
      }, 0)
    }
  })
  listen(session, document, 'pointercancel', (event) => {
    if (!drag || event.pointerId === drag.pointerId) cancelSelection()
  })
  listen(session, submit, 'click', send)
  listen(session, cancel, 'click', cancelSelection)
  listen(session, form, 'submit', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const values = coordinates.map((input) => Number(input.value))
    session.dispatch({
      type: 'submit',
      wordId: choice.value,
      path:
        selectionPath(
          puzzle,
          { row: values[0] - 1, column: values[1] - 1 },
          { row: values[2] - 1, column: values[3] - 1 }
        ) || [],
    })
  })
  listen(session, replay, 'click', () => {
    cancelSelection()
    reset()
  })
  function render(state) {
    words.forEach((item, id) => {
      item.style.textDecoration = state.foundIds.includes(id) ? 'line-through' : ''
    })
    cells.forEach((cell) => {
      cell.style.backgroundColor = puzzle.placements.some(
        (entry) =>
          state.foundIds.includes(entry.id) &&
          entry.path.some((part) => same(part, coordinate(cell)))
      )
        ? 'var(--ns-accent,#6366f1)'
        : ''
    })
    status.textContent = state.completed
      ? 'All words found!'
      : `${state.foundIds.length}/${puzzle.placements.length} found${state.lastResult === 'incorrect' ? ' — Select an allowed straight word path and try again.' : ''}`
  }
  return { render, pause: cancelSelection }
}
module.exports = { presentWordSearch }
