const {
  validateWordPuzzleConfig,
  DIRECTIONS,
  seededRandom,
  shuffle,
  searchBudget,
  WORD_PUZZLE_BOUNDS,
  fail,
  freezePuzzle,
} = require('./word-puzzle-config.js')

function validateWordSearchLayout(config, puzzle) {
  const validated = validateWordPuzzleConfig(config)
  if (
    puzzle.rows !== config.rows ||
    puzzle.columns !== config.columns ||
    !Array.isArray(puzzle.grid) ||
    puzzle.grid.length !== config.rows ||
    puzzle.grid.some((row) => !Array.isArray(row) || row.length !== config.columns)
  )
    fail(
      'UNSATISFIABLE_LAYOUT',
      null,
      'Grid dimensions do not match configuration',
      'Regenerate the grid'
    )
  if (!Array.isArray(puzzle.placements) || puzzle.placements.length !== validated.entries.length)
    fail(
      'UNSATISFIABLE_LAYOUT',
      null,
      'Every authored word must have exactly one placement',
      'Regenerate the complete puzzle'
    )
  const ids = new Set(),
    paths = new Set()
  for (const placement of puzzle.placements) {
    const entry = validated.entries.find((word) => word.id === placement.id)
    const vector = DIRECTIONS[placement.direction]
    if (
      !entry ||
      ids.has(placement.id) ||
      !config.directions.includes(placement.direction) ||
      !vector ||
      !Array.isArray(placement.path) ||
      placement.path.length !== entry.tokens.length
    )
      fail(
        'UNSATISFIABLE_LAYOUT',
        placement.id,
        'Placement ID, length or direction is invalid',
        'Regenerate the puzzle'
      )
    ids.add(placement.id)
    const start = placement.path[0]
    if (
      !start ||
      placement.path.some(
        (cell, i) =>
          !cell ||
          !Number.isInteger(cell.row) ||
          !Number.isInteger(cell.column) ||
          cell.row !== start.row + vector[0] * i ||
          cell.column !== start.column + vector[1] * i ||
          cell.row < 0 ||
          cell.row >= config.rows ||
          cell.column < 0 ||
          cell.column >= config.columns ||
          puzzle.grid[cell.row][cell.column] !== entry.tokens[i]
      )
    )
      fail(
        'UNSATISFIABLE_LAYOUT',
        placement.id,
        'Word path is not continuous or letters conflict',
        'Correct the word placement'
      )
    const key = placement.path
      .map((cell) => `${cell.row}:${cell.column}`)
      .sort()
      .join('|')
    if (paths.has(key))
      fail(
        'UNSATISFIABLE_LAYOUT',
        placement.id,
        'Duplicate placement path',
        'Place words on distinct paths'
      )
    paths.add(key)
  }
  return puzzle
}

function generateWordSearch(config, { budget } = {}) {
  const validated = validateWordPuzzleConfig(config)
  const limit = searchBudget(budget, WORD_PUZZLE_BOUNDS.wordSearchBudget)
  const random = seededRandom(config.seed)
  const entries = shuffle([...validated.entries], random).sort(
    (a, b) => b.tokens.length - a.tokens.length
  )
  const grid = Array.from({ length: config.rows }, () => Array(config.columns).fill(null))
  const placements = [],
    usedPaths = new Set()
  let operations = 0,
    deepest = []
  const candidates = new Map(
    entries.map((entry) => {
      const options = []
      for (const direction of config.directions) {
        const [dr, dc] = DIRECTIONS[direction]
        for (let row = 0; row < config.rows; row++)
          for (let column = 0; column < config.columns; column++) {
            const endRow = row + dr * (entry.tokens.length - 1),
              endColumn = column + dc * (entry.tokens.length - 1)
            if (endRow < 0 || endRow >= config.rows || endColumn < 0 || endColumn >= config.columns)
              continue
            const path = entry.tokens.map((_, i) => ({
              row: row + dr * i,
              column: column + dc * i,
            }))
            options.push({
              direction,
              row,
              column,
              path,
              key: path
                .map((cell) => `${cell.row}:${cell.column}`)
                .sort()
                .join('|'),
            })
          }
      }
      return [entry.id, shuffle(options, random)]
    })
  )
  function search(index) {
    if (index === entries.length) return true
    const entry = entries[index]
    for (const option of candidates.get(entry.id)) {
      if (operations === limit) return false
      operations++
      if (
        usedPaths.has(option.key) ||
        option.path.some(
          (cell, i) =>
            grid[cell.row][cell.column] !== null && grid[cell.row][cell.column] !== entry.tokens[i]
        )
      )
        continue
      const prior = option.path.map((cell) => grid[cell.row][cell.column])
      option.path.forEach((cell, i) => {
        grid[cell.row][cell.column] = entry.tokens[i]
      })
      usedPaths.add(option.key)
      placements.push({
        id: entry.id,
        text: entry.text,
        tokens: [...entry.tokens],
        direction: option.direction,
        row: option.row,
        column: option.column,
        path: option.path,
      })
      if (placements.length > deepest.length) deepest = placements.map((item) => item.id)
      if (search(index + 1)) return true
      placements.pop()
      usedPaths.delete(option.key)
      option.path.forEach((cell, i) => {
        grid[cell.row][cell.column] = prior[i]
      })
      if (operations === limit) return false
    }
    return false
  }
  if (!search(0))
    fail(
      'SEARCH_EXHAUSTED',
      null,
      'No complete word-search found within bounded search',
      'Increase the grid, change the seed or revise words',
      {
        operations,
        unplacedIds: entries
          .filter((entry) => !deepest.includes(entry.id))
          .map((entry) => entry.id),
      }
    )
  for (const row of grid)
    for (let column = 0; column < row.length; column++)
      if (row[column] === null)
        row[column] = validated.alphabet[Math.floor(random() * validated.alphabet.length)]
  const puzzle = {
    type: 'word-search',
    rows: config.rows,
    columns: config.columns,
    seed: config.seed,
    directions: [...config.directions],
    grid,
    placements,
    operations,
  }
  validateWordSearchLayout(config, puzzle)
  return freezePuzzle(puzzle)
}
module.exports = { generateWordSearch, validateWordSearchLayout }
