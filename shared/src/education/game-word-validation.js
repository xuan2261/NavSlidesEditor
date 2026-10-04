const segmenter = new Intl.Segmenter('vi-VN', { granularity: 'grapheme' })
const DIRECTIONS = {
  E: [0, 1],
  W: [0, -1],
  N: [-1, 0],
  S: [1, 0],
  NE: [-1, 1],
  NW: [-1, -1],
  SE: [1, 1],
  SW: [1, -1],
}
function tokens(value, path, v, min = 2, max = 20) {
  if (typeof value !== 'string' || value.length > 256) {
    v.add(path, 'Enter a word of at most 256 code units')
    return []
  }
  const normalized = value.trim().normalize('NFC').toLocaleUpperCase('vi-VN')
  const result = Array.from(segmenter.segment(normalized), (part) => part.segment)
  if (
    result.length < min ||
    result.length > max ||
    result.some((token) => !/^\p{L}[\p{L}\p{M}]*$/u.test(token))
  )
    v.add(path, `Use ${min}..${max} letter graphemes without internal spaces or punctuation`)
  return result
}
function validateWords(config, v, crossword) {
  const key = crossword ? 'entries' : 'words'
  const field = crossword ? 'answer' : 'text'
  const rows = v.list(config[key], [key], 1, 40)
  v.unique(rows, [key])
  const seenWords = new Set()
  const occupied = new Map()
  let directions = []
  if (!crossword) {
    directions = v.list(config.directions, ['directions'], 1, 8)
    const seen = new Set()
    directions.forEach((direction, i) => {
      if (!Object.prototype.hasOwnProperty.call(DIRECTIONS, direction))
        v.add(['directions', i], 'Choose E, W, N, S, NE, NW, SE or SW')
      if (seen.has(direction)) v.add(['directions', i], 'Duplicate direction')
      seen.add(direction)
    })
    tokens(config.alphabet, ['alphabet'], v, 1, 256)
  }
  rows.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return
    const path = [key, i]
    const letters = tokens(entry[field], [...path, field], v)
    const identity = letters.join('')
    if (seenWords.has(identity))
      v.add([...path, field], 'Duplicate normalized word; each authored word must be distinct')
    seenWords.add(identity)
    if (!crossword) {
      const fits = directions.some((direction) => {
        const vector = DIRECTIONS[direction]
        return (
          vector &&
          (!vector[0] || letters.length <= config.rows) &&
          (!vector[1] || letters.length <= config.columns)
        )
      })
      if (!fits)
        v.add(
          [...path, field],
          'Word cannot fit the grid in any selected direction; enlarge the grid or change directions'
        )
      return
    }
    v.text(entry.clue, [...path, 'clue'])
    v.number(entry.row, [...path, 'row'], 0, config.rows - 1, true)
    v.number(entry.column, [...path, 'column'], 0, config.columns - 1, true)
    v.choice(entry.direction, [...path, 'direction'], ['across', 'down'])
    if (
      !Number.isInteger(entry.row) ||
      !Number.isInteger(entry.column) ||
      !['across', 'down'].includes(entry.direction)
    )
      return
    const down = entry.direction === 'down'
    if ((down ? entry.row : entry.column) + letters.length > (down ? config.rows : config.columns))
      v.add(
        [...path, down ? 'row' : 'column'],
        'Entry extends outside the grid; move it or increase the grid'
      )
    letters.forEach((letter, j) => {
      const coordinate = `${entry.row + (down ? j : 0)}:${entry.column + (down ? 0 : j)}`
      const prior = occupied.get(coordinate)
      if (prior?.directions.has(entry.direction))
        v.add([...path, 'direction'], 'Parallel overlap or duplicate placement; move this entry')
      if (prior && prior.letter !== letter)
        v.add([...path, 'answer'], 'Crossing letters conflict; correct the word or placement')
      if (prior) prior.directions.add(entry.direction)
      else occupied.set(coordinate, { letter, directions: new Set([entry.direction]) })
    })
  })
}
module.exports = { validateWords }
