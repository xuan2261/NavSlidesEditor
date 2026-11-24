import { expect } from '@playwright/test'
import {
  defineFields,
  scalar,
  select,
  nested,
  titleCase,
  click,
  label,
} from './release-game-fields-harness.js'

async function answer(root, config, text = 'Apple') {
  await click(root, 'Start round')
  await label(root, `${config.categories[0].label}: ${config.teams[0].name}`).fill(text)
  await click(root, 'Score now')
  await expect(root.locator('[aria-label="Round scores"]')).toContainText(
    `${config.teams[0].name}: 1`
  )
}
defineFields('scattergories', [
  titleCase('scattergories'),
  scalar('timePerRound', 'Time per round in seconds', 2, async (root) => {
    await click(root, 'Start round')
    await expect(root.getByRole('timer')).toContainText(/^[12] seconds remaining$/)
    await expect(root.getByRole('status')).toContainText('Review complete.', { timeout: 5000 })
    await expect(root.getByRole('textbox').first()).toBeDisabled()
  }),
  select(
    'letterMode',
    'Letter mode',
    'manual',
    async (root, config) => {
      await expect(label(root, 'Starting letter')).toBeEnabled()
      await expect(label(root, 'Starting letter')).toHaveValue('A')
      await answer(root, config)
      await expect(root.getByRole('heading', { level: 4 })).toContainText('starts with A')
    },
    (config) => {
      config.letterMode = 'random'
    }
  ),
  scalar('letter', 'Manual letter', 'B', async (root, config) => {
    await expect(label(root, 'Starting letter')).toHaveValue('B')
    await answer(root, config, 'Banana')
    await expect(root.getByRole('heading', { level: 4 })).toContainText('starts with B')
  }),
  nested(
    'categories',
    'Category 1 label',
    'Edited food',
    (config) => {
      config.categories[0].label = 'Edited food'
    },
    async (root, config) => {
      await answer(root, config)
      await expect(root.getByRole('group', { name: 'Edited food', exact: true })).toBeVisible()
      await expect(label(root, 'Edited food: Blue')).toHaveValue('Apple')
    }
  ),
  nested(
    'teams',
    'Team 1 name',
    'Cobalt team',
    (config) => {
      config.teams[0].name = 'Cobalt team'
    },
    async (root, config) => {
      await answer(root, config)
      await expect(label(root, 'Food: Cobalt team')).toHaveValue('Apple')
      await expect(root.locator('[aria-label="Round scores"]')).toContainText('Cobalt team: 1')
    }
  ),
  select('scoring', 'Scoring', 'all', async (root, config) => {
    await click(root, 'Start round')
    for (const team of config.teams) await label(root, `Food: ${team.name}`).fill('Apple')
    await click(root, 'Score now')
    for (const team of config.teams)
      await expect(root.locator('[aria-label="Round scores"]')).toContainText(`${team.name}: 1`)
    await expect(root.getByRole('status')).toContainText('Scoring: all')
  }),
])
