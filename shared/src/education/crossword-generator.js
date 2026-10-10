const {
  validateWordPuzzleConfig,
  seededRandom,
  shuffle,
  searchBudget,
  WORD_PUZZLE_BOUNDS,
  fail,
  freezePuzzle,
} = require('./word-puzzle-config.js')
const { validateCrosswordLayout } = require('./crossword-layout.js')

function generateCrossword(config, { budget } = {}) {
  const validated = validateWordPuzzleConfig(config, true)
  const limit = searchBudget(budget, WORD_PUZZLE_BOUNDS.crosswordBudget)
  const random = seededRandom(config.seed)
  const entries = shuffle([...validated.entries], random).sort(
    (a, b) => b.tokens.length - a.tokens.length
  )
  const occupied = new Map(),
    placed = []
  let operations = 0,
    deepest = []
  const candidates = new Map(
    entries.map((entry) => {
      const options = []
      for (const direction of ['across', 'down']) {
        const dr = direction === 'down' ? 1 : 0,
          dc = 1 - dr
        for (let row = 0; row + dr * (entry.tokens.length - 1) < config.rows; row++) {
          for (let column = 0; column + dc * (entry.tokens.length - 1) < config.columns; column++) {
            options.push({
              row,
              column,
              direction,
              keys: entry.tokens.map((_, i) => `${row + dr * i}:${column + dc * i}`),
            })
          }
        }
      }
      return [entry.id, shuffle(options, random)]
    })
  )
  function search(index) {
    if (index === entries.length) return true
    const entry = entries[index]
    // Crossings are attempted first; disconnected placements remain valid explicit layouts.
    const options = candidates
      .get(entry.id)
      .map((option) => ({
        ...option,
        crossings: option.keys.reduce((sum, key) => sum + (occupied.has(key) ? 1 : 0), 0),
      }))
      .sort((a, b) => b.crossings - a.crossings)
    for (const option of options) {
      if (operations === limit) return false
      operations++
      if (
        option.keys.some((key, i) => {
          const cell = occupied.get(key)
          return (
            cell && (cell.letter !== entry.tokens[i] || cell.directions.includes(option.direction))
          )
        })
      )
        continue
      const prior = option.keys.map((key) => occupied.get(key))
      option.keys.forEach((key, i) =>
        occupied.set(key, {
          letter: entry.tokens[i],
          directions: [...(prior[i]?.directions || []), option.direction],
        })
      )
      placed.push({ ...entry, row: option.row, column: option.column, direction: option.direction })
      if (placed.length > deepest.length) deepest = placed.map((item) => item.id)
      if (search(index + 1)) return true
      placed.pop()
      option.keys.forEach((key, i) => {
        if (prior[i]) occupied.set(key, prior[i])
        else occupied.delete(key)
      })
      if (operations === limit) return false
    }
    return false
  }
  if (!search(0))
    fail(
      'SEARCH_EXHAUSTED',
      null,
      'No complete layout found within bounded search',
      'Increase the grid, change the seed or revise words',
      {
        operations,
        unplacedIds: entries
          .filter((entry) => !deepest.includes(entry.id))
          .map((entry) => entry.id),
      }
    )
  const puzzle = validateCrosswordLayout({
    ...config,
    entries: placed.map((entry) => {
      const copy = { ...entry }
      delete copy.number
      return copy
    }),
  })
  return freezePuzzle({ ...puzzle, operations })
}
module.exports = { generateCrossword }
