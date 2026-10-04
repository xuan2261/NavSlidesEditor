const { validateWordPuzzleConfig, fail, freezePuzzle } = require('./word-puzzle-config.js')
const { segmentGraphemes } = require('./word-graphemes.js')

function validateCrosswordLayout(config) {
  const validated = validateWordPuzzleConfig(config, true)
  const grid = Array.from({ length: config.rows }, () => Array(config.columns).fill(null))
  const occupied = new Map()
  const starts = new Map()
  const placements = validated.entries.map((entry) => {
    const { row, column, direction, tokens } = entry
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(column) ||
      row < 0 ||
      column < 0 ||
      !['across', 'down'].includes(direction)
    )
      fail(
        'UNSATISFIABLE_LAYOUT',
        entry.id,
        'Entry needs nonnegative integer coordinates and across/down direction',
        'Correct the placement'
      )
    const dr = direction === 'down' ? 1 : 0,
      dc = direction === 'across' ? 1 : 0
    if (
      row + dr * (tokens.length - 1) >= config.rows ||
      column + dc * (tokens.length - 1) >= config.columns
    )
      fail(
        'UNSATISFIABLE_LAYOUT',
        entry.id,
        'Entry extends outside the grid',
        'Move the entry or increase the grid'
      )
    const path = tokens.map((letter, i) => {
      const r = row + dr * i,
        c = column + dc * i,
        key = `${r}:${c}`
      const prior = occupied.get(key)
      if (prior?.directions.has(direction))
        fail(
          'UNSATISFIABLE_LAYOUT',
          entry.id,
          'Parallel overlap or duplicate placement',
          'Move this entry'
        )
      if (prior && prior.letter !== letter)
        fail(
          'UNSATISFIABLE_LAYOUT',
          entry.id,
          'Crossing letters contradict',
          'Correct the word or placement'
        )
      if (prior) prior.directions.add(direction)
      else occupied.set(key, { letter, directions: new Set([direction]) })
      grid[r][c] = letter
      return { row: r, column: c }
    })
    starts.set(`${row}:${column}`, { row, column })
    return {
      id: entry.id,
      answer: entry.answer,
      clue: entry.clue,
      tokens: [...tokens],
      row,
      column,
      direction,
      path,
      authoredNumber: entry.number,
    }
  })
  const numbers = new Map(
    [...starts.values()]
      .sort((a, b) => a.row - b.row || a.column - b.column)
      .map((cell, i) => [`${cell.row}:${cell.column}`, i + 1])
  )
  placements.forEach((entry) => {
    entry.number = numbers.get(`${entry.row}:${entry.column}`)
    if (entry.authoredNumber !== undefined && entry.authoredNumber !== entry.number)
      fail(
        'UNSATISFIABLE_LAYOUT',
        entry.id,
        'Authored clue number conflicts with coordinate numbering',
        'Remove the number or use the coordinate-derived number'
      )
    delete entry.authoredNumber
  })
  return freezePuzzle({
    type: 'crossword',
    rows: config.rows,
    columns: config.columns,
    seed: config.seed,
    grid,
    placements,
  })
}
function createCrosswordState() {
  return { values: {}, foundIds: [], awardedIds: [], score: 0, completed: false, lastResult: null }
}
const entryMatches = (entry, values) =>
  entry.path.every((cell, i) => values[`${cell.row}:${cell.column}`] === entry.tokens[i])
function reduceCrossword(puzzle, state, action) {
  if (action?.type === 'reset') return createCrosswordState(puzzle)
  if (state.completed) return state
  if (action?.type === 'cell') {
    if (
      !Number.isInteger(action.row) ||
      !Number.isInteger(action.column) ||
      !puzzle.grid[action.row]?.[action.column] ||
      typeof action.value !== 'string' ||
      action.value.length > 256
    )
      return state
    const tokens = segmentGraphemes(action.value.toLocaleUpperCase('vi-VN'))
    if (tokens.length > 1 || (tokens.length && !/^\p{L}[\p{L}\p{M}]*$/u.test(tokens[0])))
      return state
    const values = { ...state.values, [`${action.row}:${action.column}`]: tokens[0] || '' }
    const foundIds = state.foundIds.filter((id) =>
      entryMatches(
        puzzle.placements.find((entry) => entry.id === id),
        values
      )
    )
    return { ...state, values, foundIds, lastResult: null }
  }
  if (action?.type !== 'submit') return state
  const targets = puzzle.placements.filter(
    (entry) => action.entryId === undefined || entry.id === action.entryId
  )
  if (!targets.length) return state
  const correct = targets.filter((entry) => entryMatches(entry, state.values))
  const checkedIds = new Set([...state.foundIds, ...correct.map((entry) => entry.id)])
  const foundIds = puzzle.placements
    .filter((entry) => checkedIds.has(entry.id) && entryMatches(entry, state.values))
    .map((entry) => entry.id)
  // Earned points survive edits; solved status must still describe the current grid.
  const awardedIds = [...new Set([...state.awardedIds, ...correct.map((entry) => entry.id)])]
  const completed =
    foundIds.length === puzzle.placements.length &&
    puzzle.placements.every((entry) => entryMatches(entry, state.values))
  return {
    ...state,
    foundIds,
    awardedIds,
    score: awardedIds.length,
    completed,
    lastResult: correct.length === targets.length ? 'correct' : 'incorrect',
  }
}
module.exports = { validateCrosswordLayout, createCrosswordState, reduceCrossword }
