const { listen } = require('./dom.js')
const { segmentGraphemes } = require('../word-graphemes.js')

function bindWordGrid({ grid, session, onActivate, onSubmit, onToggle = () => {} }) {
  const cells = [...grid.querySelectorAll('[data-row][data-column]')]
  const find = (row, column) =>
    cells.find((cell) => Number(cell.dataset.row) === row && Number(cell.dataset.column) === column)
  const focus = (cell) => {
    if (!cell) return
    cells.forEach((item) => {
      item.tabIndex = item === cell ? 0 : -1
    })
    cell.focus()
  }
  listen(session, grid, 'focusin', (event) => {
    if (cells.includes(event.target))
      cells.forEach((item) => {
        item.tabIndex = item === event.target ? 0 : -1
      })
  })
  listen(session, grid, 'click', (event) => {
    const cell = event.target.closest('[data-row][data-column]')
    if (!cell || !grid.contains(cell)) return
    event.stopPropagation()
    focus(cell)
    onActivate(cell)
  })
  listen(session, grid, 'keydown', (event) => {
    const cell = event.target.closest('[data-row][data-column]')
    if (!cell || !grid.contains(cell) || event.isComposing) return
    const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[
      event.key
    ]
    if (delta) {
      event.preventDefault()
      event.stopPropagation()
      let row = Number(cell.dataset.row) + delta[0],
        column = Number(cell.dataset.column) + delta[1]
      while (
        row >= 0 &&
        row < Number(grid.dataset.rows) &&
        column >= 0 &&
        column < Number(grid.dataset.columns)
      ) {
        const next = find(row, column)
        if (next) {
          focus(next)
          break
        }
        row += delta[0]
        column += delta[1]
      }
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === ' ') onActivate(cell)
      else onSubmit()
    } else if (event.key === 'Escape') {
      event.stopPropagation()
      onToggle()
    }
  })
  return { focus, find }
}

function bindCrosswordInputs({ grid, puzzle, session, activeEntry, find, focus }) {
  const composing = new WeakSet()
  const coordinate = (input) => ({
    row: Number(input.dataset.row),
    column: Number(input.dataset.column),
  })
  function commit(input, text) {
    if (typeof text !== 'string' || text.length > 256) return
    const tokens = segmentGraphemes(text.toLocaleUpperCase('vi-VN'))
    if (tokens.some((token) => !/^\p{L}[\p{L}\p{M}]*$/u.test(token))) {
      const cell = coordinate(input)
      input.value = session.getState().values[`${cell.row}:${cell.column}`] || ''
      return
    }
    const entry = activeEntry(),
      cell = coordinate(input)
    const offset =
      entry?.path.findIndex((part) => part.row === cell.row && part.column === cell.column) ?? -1
    const path = offset >= 0 ? entry.path.slice(offset) : [cell]
    if (!tokens.length) {
      session.dispatch({ type: 'cell', ...cell, value: '' })
      return
    }
    tokens
      .slice(0, path.length)
      .forEach((token, i) => session.dispatch({ type: 'cell', ...path[i], value: token }))
    if (tokens.length > 1 && path.length)
      focus(
        find(
          path[Math.min(tokens.length, path.length) - 1].row,
          path[Math.min(tokens.length, path.length) - 1].column
        )
      )
  }
  listen(session, grid, 'compositionstart', (event) => {
    composing.add(event.target)
  })
  listen(session, grid, 'compositionend', (event) => {
    composing.delete(event.target)
    commit(event.target, event.target.value)
  })
  listen(session, grid, 'input', (event) => {
    if (!event.isComposing && !composing.has(event.target)) commit(event.target, event.target.value)
  })
  listen(session, grid, 'paste', (event) => {
    if (!event.target.matches('input[data-row]') || composing.has(event.target)) return
    event.preventDefault()
    event.stopPropagation()
    commit(event.target, event.clipboardData?.getData('text') || '')
  })
  return { isComposing: (input) => composing.has(input) }
}
module.exports = { bindWordGrid, bindCrosswordInputs }
