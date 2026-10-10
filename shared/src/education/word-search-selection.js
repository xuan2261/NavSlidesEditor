const { DIRECTIONS } = require('./word-puzzle-config.js')
function validCell(puzzle, cell) {
  return (
    cell &&
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.column) &&
    cell.row >= 0 &&
    cell.row < puzzle.rows &&
    cell.column >= 0 &&
    cell.column < puzzle.columns
  )
}
function selectionPath(puzzle, start, end) {
  if (!validCell(puzzle, start) || !validCell(puzzle, end)) return null
  const rows = end.row - start.row,
    columns = end.column - start.column
  if ((!rows && !columns) || (rows && columns && Math.abs(rows) !== Math.abs(columns))) return null
  const dr = Math.sign(rows),
    dc = Math.sign(columns)
  if (!puzzle.directions.some((key) => DIRECTIONS[key][0] === dr && DIRECTIONS[key][1] === dc))
    return null
  return Array.from({ length: Math.max(Math.abs(rows), Math.abs(columns)) + 1 }, (_, i) => ({
    row: start.row + dr * i,
    column: start.column + dc * i,
  }))
}
function samePath(a, b) {
  return (
    a.length === b.length &&
    a.every((cell, i) => cell.row === b[i].row && cell.column === b[i].column)
  )
}
function createWordSearchState() {
  return { foundIds: [], completed: false, score: 0, lastResult: null }
}
function reduceWordSearch(puzzle, state, action) {
  if (action?.type === 'reset') return createWordSearchState(puzzle)
  if (action?.type !== 'submit') return state
  const path = action.path
  if (!Array.isArray(path) || path.length < 2 || path.some((cell) => !validCell(puzzle, cell)))
    return { ...state, lastResult: 'incorrect' }
  const continuous = selectionPath(puzzle, path[0], path[path.length - 1])
  if (!continuous || !samePath(path, continuous)) return { ...state, lastResult: 'incorrect' }
  const placement = puzzle.placements.find(
    (entry) =>
      (action.wordId === undefined || entry.id === action.wordId) &&
      (samePath(path, entry.path) || samePath(path, [...entry.path].reverse()))
  )
  if (!placement) return { ...state, lastResult: 'incorrect' }
  if (state.foundIds.includes(placement.id)) return state
  const foundIds = [...state.foundIds, placement.id]
  return {
    foundIds,
    completed: foundIds.length === puzzle.placements.length,
    score: foundIds.length,
    lastResult: 'correct',
  }
}
module.exports = { selectionPath, createWordSearchState, reduceWordSearch }
