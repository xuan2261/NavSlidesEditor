import { expect } from '@playwright/test'
import generator from '../../../shared/src/education/crossword-generator.js'
import {
  defineFields,
  scalar,
  nested,
  titleCase,
  click,
  label,
} from './release-game-fields-harness.js'
import {
  crosswordComplete,
  searchComplete,
  searchGrid,
  beforeSearch,
} from './release-game-fields-puzzles.js'
const { generateCrossword } = generator

const crosswordSeed = scalar('seed', 'Puzzle seed', 44, crosswordComplete)
crosswordSeed.change = (config) => {
  config.seed = 44
  const puzzle = generateCrossword(config)
  config.entries = config.entries.map((entry) => {
    const placement = puzzle.placements.find((item) => item.id === entry.id)
    return {
      ...entry,
      row: placement.row,
      column: placement.column,
      direction: placement.direction,
    }
  })
}
crosswordSeed.author = async (panel) => {
  await label(panel, 'Puzzle seed').fill('44')
  await click(panel, 'Generate crossword layout')
}
defineFields('crossword', [
  titleCase('crossword'),
  scalar('rows', 'Grid rows', 6, async (root, config) => {
    await expect(
      root.getByRole('group', { name: 'Crossword grid', exact: true }).locator(':scope > *')
    ).toHaveCount(30)
    await crosswordComplete(root, config)
  }),
  scalar('columns', 'Grid columns', 6, async (root, config) => {
    await expect(
      root.getByRole('group', { name: 'Crossword grid', exact: true }).locator(':scope > *')
    ).toHaveCount(30)
    await crosswordComplete(root, config)
  }),
  {
    field: 'entries',
    setup: () => {},
    change: (config) => {
      config.entries[0].answer = 'COT'
      config.entries[0].clue = 'Edited camping bed'
    },
    author: async (panel) => {
      await label(panel, 'Entry 1 answer').fill('COT')
      await label(panel, 'Entry 1 clue').fill('Edited camping bed')
    },
    exercise: async (root, config) => {
      await expect(root.getByRole('button', { name: /across: Edited camping bed$/ })).toBeVisible()
      await crosswordComplete(root, config)
    },
  },
  crosswordSeed,
])
const searchSeed = scalar('seed', 'Puzzle seed', 44, async (root, config, { baseline }) => {
  const current = await searchGrid(root)
  expect(current).not.toEqual(baseline)
  await searchComplete(root, config)
  await click(root, 'Reset')
  expect(await searchGrid(root)).toEqual(current)
  await expect(root).toContainText('0/2 found')
})
searchSeed.beforeAuthor = beforeSearch
defineFields('word-search', [
  titleCase('word-search'),
  scalar('rows', 'Grid rows', 6, async (root, config) => {
    await expect(
      root.getByRole('group', { name: 'Word search grid', exact: true }).getByRole('button')
    ).toHaveCount(48)
    await searchComplete(root, config)
  }),
  scalar('columns', 'Grid columns', 6, async (root, config) => {
    await expect(
      root.getByRole('group', { name: 'Word search grid', exact: true }).getByRole('button')
    ).toHaveCount(48)
    await searchComplete(root, config)
  }),
  nested(
    'words',
    'Word 1 text',
    'RAT',
    (config) => {
      config.words[0].text = 'RAT'
    },
    async (root, config) => {
      await expect(root.locator('li').filter({ hasText: 'RAT' })).toHaveText('RAT')
      await searchComplete(root, config)
    }
  ),
  searchSeed,
  {
    field: 'directions',
    setup: () => {},
    change: (config) => {
      config.directions = ['E']
    },
    author: async (panel) => {
      await label(panel, 'Direction S').uncheck()
      await label(panel, 'Direction SE').uncheck()
    },
    exercise: async (root, config) => {
      for (const [name, value] of [
        ['Start row', '1'],
        ['Start column', '1'],
        ['End row', '3'],
        ['End column', '3'],
      ])
        await label(root, name).fill(value)
      await click(root, 'Submit coordinates')
      await expect(root).toContainText('Select an allowed straight word path and try again.')
      await searchComplete(root, config)
    },
  },
  scalar('alphabet', 'Fill alphabet', 'X', async (root, config) => {
    const grid = await searchGrid(root)
    expect(new Set(grid.map((cell) => cell.text))).toEqual(
      new Set(['X', 'C', 'A', 'T', 'D', 'O', 'G'])
    )
    expect(grid.filter((cell) => cell.text === 'X').length).toBeGreaterThanOrEqual(
      config.rows * config.columns - 6
    )
    await searchComplete(root, config)
  }),
])
