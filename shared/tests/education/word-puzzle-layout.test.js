import { describe, expect, it } from 'vitest'
import { normalizeWord, segmentGraphemes } from '../../src/education/word-graphemes.js'
import { DIRECTIONS } from '../../src/education/word-puzzle-config.js'
import {
  validateCrosswordLayout,
  createCrosswordState,
  reduceCrossword,
} from '../../src/education/crossword-layout.js'
import { generateCrossword } from '../../src/education/crossword-generator.js'
import {
  generateWordSearch,
  validateWordSearchLayout,
} from '../../src/education/word-search-generator.js'
import {
  selectionPath,
  createWordSearchState,
  reduceWordSearch,
} from '../../src/education/word-search-selection.js'

const crossword = () => ({
  rows: 5,
  columns: 5,
  seed: 7,
  entries: [
    { id: 'hoc', answer: 'học', clue: 'Learn', row: 0, column: 0, direction: 'across' },
    { id: 'hat', answer: 'hát', clue: 'Sing', row: 0, column: 0, direction: 'down' },
  ],
})
const wordSearch = () => ({
  rows: 6,
  columns: 6,
  seed: 42,
  directions: ['E', 'S', 'NE'],
  alphabet: 'ABCĐỌ',
  words: [
    { id: 'hoc', text: 'học' },
    { id: 'hat', text: 'hát' },
    { id: 'do', text: 'đỏ' },
  ],
})
function errorFrom(run, code, entryId) {
  let error
  try {
    run()
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(Error)
  expect(error?.name).toBe('WordPuzzleError')
  expect(error.code).toBe(code)
  if (entryId !== undefined) expect(error.entryId).toBe(entryId)
  expect(typeof error.constraint).toBe('string')
  expect(typeof error.action).toBe('string')
  return error
}
function verifyWords(puzzle, words, field) {
  expect(puzzle.placements.map((entry) => entry.id).sort()).toEqual(
    words.map((entry) => entry.id).sort()
  )
  for (const entry of words) {
    const placement = puzzle.placements.find((item) => item.id === entry.id)
    expect(placement.path.map((cell) => puzzle.grid[cell.row][cell.column])).toEqual(
      normalizeWord(entry[field]).tokens
    )
  }
}

describe('Vietnamese grapheme normalization', () => {
  it('equates NFC/decomposed text, retains accents and Vietnamese case', () => {
    expect(normalizeWord('  học  ')).toEqual(normalizeWord('ho\u0323c'))
    expect(normalizeWord('đỏ').tokens).toEqual(['Đ', 'Ỏ'])
    expect(normalizeWord('hoc').tokens).not.toEqual(normalizeWord('học').tokens)
    expect(segmentGraphemes('a\u0306\u0301')).toEqual(['ắ'])
    expect(segmentGraphemes('👩‍👩‍👧‍👦')).toEqual(['👩‍👩‍👧‍👦'])
  })
  it.each(['h ọc', 'học!', 'học-sinh', '1a', ''])('rejects invalid authored word %j', (value) => {
    expect(() => normalizeWord(value)).toThrow()
  })
  it('checks raw cap before normalization and grapheme cap after normalization', () => {
    expect(() => normalizeWord('a'.repeat(257))).toThrow()
    expect(() => normalizeWord('a'.repeat(21))).toThrow()
    expect(normalizeWord('a\u0301'.repeat(20)).tokens).toHaveLength(20)
  })
})

describe('explicit crossword layouts', () => {
  it('validates crossings and numbers shared starts in row-major order without changing IDs/config', () => {
    const config = crossword(),
      before = structuredClone(config)
    config.entries.push({
      id: 'do',
      answer: 'đỏ',
      clue: 'Red',
      row: 3,
      column: 2,
      direction: 'across',
    })
    const puzzle = validateCrosswordLayout(config)
    expect(puzzle.placements.map((entry) => [entry.id, entry.number])).toEqual([
      ['hoc', 1],
      ['hat', 1],
      ['do', 2],
    ])
    verifyWords(puzzle, config.entries, 'answer')
    expect(config.entries.slice(0, 2)).toEqual(before.entries)
    expect(Object.isFrozen(puzzle.grid[0])).toBe(true)
  })
  it.each([
    [
      'contradictory crossing',
      (cfg) => {
        cfg.entries[1].answer = 'đỏ'
      },
      'UNSATISFIABLE_LAYOUT',
      'hat',
    ],
    [
      'outside grid',
      (cfg) => {
        cfg.entries[0].column = 4
      },
      'UNSATISFIABLE_LAYOUT',
      'hoc',
    ],
    [
      'negative coordinate',
      (cfg) => {
        cfg.entries[0].row = -1
      },
      'UNSATISFIABLE_LAYOUT',
      'hoc',
    ],
    [
      'parallel overlap',
      (cfg) => {
        cfg.entries[1].direction = 'across'
      },
      'UNSATISFIABLE_LAYOUT',
      'hat',
    ],
    [
      'duplicate ID',
      (cfg) => {
        cfg.entries[1].id = 'hoc'
      },
      'INVALID_ID',
      'hoc',
    ],
    [
      'duplicate normalized answer',
      (cfg) => {
        cfg.entries[1].answer = 'ho\u0323c'
      },
      'DUPLICATE_WORD',
      'hat',
    ],
    [
      'oversize token',
      (cfg) => {
        cfg.entries[0].answer = 'a'.repeat(21)
      },
      'PUZZLE_OVERSIZE',
      'hoc',
    ],
    [
      'inconsistent numbering',
      (cfg) => {
        cfg.entries[0].number = 2
      },
      'UNSATISFIABLE_LAYOUT',
      'hoc',
    ],
    [
      'oversize grid',
      (cfg) => {
        cfg.rows = 21
      },
      'PUZZLE_OVERSIZE',
      null,
    ],
  ])('rejects %s with an actionable error', (_, change, code, id) => {
    const cfg = crossword()
    change(cfg)
    errorFrom(() => validateCrosswordLayout(cfg), code, id)
  })
})

describe('bounded seeded generators', () => {
  it('generates reproducible complete crosswords accepted by the independent validator', () => {
    const config = crossword(),
      before = structuredClone(config)
    const puzzle = generateCrossword(config)
    expect(generateCrossword(config)).toEqual(puzzle)
    verifyWords(puzzle, config.entries, 'answer')
    const explicit = { ...config, entries: puzzle.placements }
    expect(validateCrosswordLayout(explicit).grid).toEqual(puzzle.grid)
    expect(puzzle.operations).toBeLessThanOrEqual(50000)
    expect(config).toEqual(before)
  })
  it('places every word for a seeded corpus in selected directions and fills deterministically', () => {
    for (let seed = 0; seed < 12; seed++) {
      const config = { ...wordSearch(), seed },
        before = structuredClone(config)
      const puzzle = generateWordSearch(config)
      expect(generateWordSearch(config)).toEqual(puzzle)
      verifyWords(puzzle, config.words, 'text')
      expect(validateWordSearchLayout(config, puzzle)).toBe(puzzle)
      for (const placement of puzzle.placements) {
        expect(config.directions).toContain(placement.direction)
        const [dr, dc] = DIRECTIONS[placement.direction]
        expect(placement.path).toEqual(
          placement.tokens.map((_, i) => ({
            row: placement.row + dr * i,
            column: placement.column + dc * i,
          }))
        )
      }
      expect(
        puzzle.grid
          .flat()
          .every((cell) => typeof cell === 'string' && segmentGraphemes(cell).length === 1)
      ).toBe(true)
      expect(puzzle.operations).toBeLessThanOrEqual(20000)
      expect(config).toEqual(before)
    }
  })
  it.each([
    [generateCrossword, crossword],
    [generateWordSearch, wordSearch],
  ])('never returns partial success on exhausted budgets', (generate, factory) => {
    for (const budget of [0, 1]) {
      const error = errorFrom(() => generate(factory(), { budget }), 'SEARCH_EXHAUSTED')
      expect(error.operations).toBe(budget)
      const authoredIds = factory()[generate === generateCrossword ? 'entries' : 'words'].map(
        (entry) => entry.id
      )
      expect(error.unplacedIds.length).toBeGreaterThanOrEqual(authoredIds.length - budget)
      expect(new Set(error.unplacedIds).size).toBe(error.unplacedIds.length)
      expect(error.unplacedIds.every((id) => authoredIds.includes(id))).toBe(true)
    }
  })
  it('bounds difficult contradictory placements without claiming proven impossibility', () => {
    const cfg = {
      rows: 2,
      columns: 2,
      seed: 1,
      directions: ['E'],
      alphabet: 'AB',
      words: ['AA', 'BB', 'CC'].map((text, i) => ({ id: String(i), text })),
    }
    const error = errorFrom(() => generateWordSearch(cfg, { budget: 20 }), 'SEARCH_EXHAUSTED')
    expect(error.operations).toBeLessThanOrEqual(20)
  })
  it('rejects proven direction/size impossibility before searching', () => {
    errorFrom(() => generateWordSearch({ ...wordSearch(), directions: [] }), 'INVALID_DIRECTIONS')
    errorFrom(
      () => generateWordSearch({ ...wordSearch(), rows: 2, directions: ['S'] }),
      'UNSATISFIABLE_LAYOUT',
      'hoc'
    )
    errorFrom(
      () => generateWordSearch({ ...wordSearch(), directions: ['E', 'E'] }),
      'INVALID_DIRECTIONS'
    )
    errorFrom(() => generateWordSearch(wordSearch(), { budget: 20001 }), 'INVALID_CONFIG')
  })
  it('independently rejects corrupted path letters and missing words', () => {
    const config = wordSearch(),
      puzzle = structuredClone(generateWordSearch(config))
    const cell = puzzle.placements[0].path[0]
    puzzle.grid[cell.row][cell.column] = 'X'
    errorFrom(
      () => validateWordSearchLayout(config, puzzle),
      'UNSATISFIABLE_LAYOUT',
      puzzle.placements[0].id
    )
    puzzle.placements.pop()
    errorFrom(() => validateWordSearchLayout(config, puzzle), 'UNSATISFIABLE_LAYOUT')
  })
})

describe('word-search path completion', () => {
  it('rejects reversed-disabled, zigzag, missing and wrong paths without awarding score', () => {
    const puzzle = generateWordSearch({ ...wordSearch(), directions: ['E'] }),
      state = createWordSearchState(puzzle)
    const path = puzzle.placements.find((entry) => entry.tokens.length === 3).path
    for (const invalid of [
      [...path].reverse(),
      [path[0], path[2]],
      [path[0], { row: 99, column: 0 }],
      [path[0], { row: path[1].row + 1, column: path[1].column }, path[2]],
    ]) {
      expect(reduceWordSearch(puzzle, state, { type: 'submit', path: invalid })).toMatchObject({
        score: 0,
        foundIds: [],
        lastResult: 'incorrect',
      })
    }
    expect(selectionPath(puzzle, path[0], path[2])).toEqual(path)
  })
  it('awards each actual placement once, completes all and resets without altering puzzle', () => {
    const puzzle = generateWordSearch({ ...wordSearch(), directions: ['E', 'W'] }),
      before = structuredClone(puzzle)
    let state = createWordSearchState(puzzle)
    for (const entry of puzzle.placements) {
      state = reduceWordSearch(puzzle, state, { type: 'submit', path: [...entry.path].reverse() })
      expect(reduceWordSearch(puzzle, state, { type: 'submit', path: entry.path })).toBe(state)
    }
    expect(state).toMatchObject({ completed: true, score: 3 })
    expect(reduceWordSearch(puzzle, state, { type: 'reset' })).toEqual(
      createWordSearchState(puzzle)
    )
    expect(puzzle).toEqual(before)
  })
  it('invalidates edited crossword solutions without completing an incorrect grid or awarding a restored entry twice', () => {
    const puzzle = validateCrosswordLayout(crossword()),
      before = structuredClone(puzzle)
    let state = createCrosswordState(puzzle)
    const fill = (entry) => {
      for (const [index, cell] of entry.path.entries())
        state = reduceCrossword(puzzle, state, {
          type: 'cell',
          ...cell,
          value: entry.tokens[index],
        })
    }
    const [across, down] = puzzle.placements
    fill(across)
    state = reduceCrossword(puzzle, state, { type: 'submit', entryId: across.id })
    expect(state).toMatchObject({ foundIds: [across.id], score: 1, completed: false })
    state = reduceCrossword(puzzle, state, { type: 'cell', ...across.path[2], value: 'X' })
    expect(state).toMatchObject({ foundIds: [], score: 1, completed: false })
    state = reduceCrossword(puzzle, state, { type: 'submit', entryId: across.id })
    expect(state).toMatchObject({ foundIds: [], score: 1, lastResult: 'incorrect' })
    fill(across)
    state = reduceCrossword(puzzle, state, { type: 'submit', entryId: across.id })
    expect(state).toMatchObject({ foundIds: [across.id], score: 1, completed: false })
    state = reduceCrossword(puzzle, state, { type: 'cell', ...across.path[2], value: 'X' })
    fill(down)
    state = reduceCrossword(puzzle, state, { type: 'submit' })
    expect(state).toMatchObject({
      foundIds: [down.id],
      score: 2,
      completed: false,
      lastResult: 'incorrect',
    })
    fill(across)
    state = reduceCrossword(puzzle, state, { type: 'submit' })
    expect(state).toMatchObject({ foundIds: [across.id, down.id], score: 2, completed: true })
    expect(reduceCrossword(puzzle, state, { type: 'submit' })).toBe(state)
    state = reduceCrossword(puzzle, state, { type: 'reset' })
    expect(state).toEqual(createCrosswordState(puzzle))
    fill(across)
    fill(down)
    expect(reduceCrossword(puzzle, state, { type: 'submit' })).toMatchObject({
      completed: true,
      score: 2,
    })
    expect(puzzle).toEqual(before)
  })
  it('invalidates both solved entries when their shared crossing is edited', () => {
    const config = crossword()
    config.entries.push({
      id: 'do',
      answer: 'đỏ',
      clue: 'Red',
      row: 3,
      column: 2,
      direction: 'across',
    })
    const puzzle = validateCrosswordLayout(config)
    let state = createCrosswordState(puzzle)
    for (const entry of puzzle.placements.slice(0, 2))
      for (const [index, cell] of entry.path.entries()) {
        state = reduceCrossword(puzzle, state, {
          type: 'cell',
          ...cell,
          value: entry.tokens[index],
        })
      }
    state = reduceCrossword(puzzle, state, { type: 'submit' })
    expect(state).toMatchObject({ foundIds: ['hoc', 'hat'], score: 2, completed: false })
    state = reduceCrossword(puzzle, state, { type: 'cell', row: 0, column: 0, value: 'X' })
    expect(state).toMatchObject({ foundIds: [], score: 2, completed: false })
    state = reduceCrossword(puzzle, state, { type: 'cell', row: 0, column: 0, value: 'H' })
    state = reduceCrossword(puzzle, state, { type: 'submit' })
    expect(state).toMatchObject({ foundIds: ['hoc', 'hat'], score: 2, completed: false })
  })
  it('normalizes crossword edits and records each solved entry only once through correction and replay', () => {
    const puzzle = validateCrosswordLayout(crossword())
    let state = createCrosswordState(puzzle)
    expect(reduceCrossword(puzzle, state, { type: 'submit' })).toMatchObject({
      foundIds: [],
      score: 0,
      lastResult: 'incorrect',
    })
    for (const entry of puzzle.placements)
      for (const [index, cell] of entry.path.entries()) {
        state = reduceCrossword(puzzle, state, {
          type: 'cell',
          ...cell,
          value: entry.tokens[index].normalize('NFD').toLocaleLowerCase('vi-VN'),
        })
      }
    state = reduceCrossword(puzzle, state, { type: 'submit' })
    expect(state).toMatchObject({ completed: true, score: 2, foundIds: ['hoc', 'hat'] })
    expect(reduceCrossword(puzzle, state, { type: 'submit' }).score).toBe(2)
    expect(reduceCrossword(puzzle, state, { type: 'cell', row: 0, column: 0, value: 'AB' })).toBe(
      state
    )
    expect(reduceCrossword(puzzle, state, { type: 'cell', row: 0, column: 0, value: 'X' })).toBe(
      state
    )
    expect(reduceCrossword(puzzle, state, { type: 'submit' })).toBe(state)
    expect(reduceCrossword(puzzle, state, { type: 'reset' })).toEqual(createCrosswordState(puzzle))
  })
})
