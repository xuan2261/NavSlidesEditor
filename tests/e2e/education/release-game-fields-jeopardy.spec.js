import { expect } from '@playwright/test'
import {
  defineFields,
  scalar,
  nested,
  titleCase,
  click,
  label,
} from './release-game-fields-harness.js'

async function cell(root, config, index = 0) {
  const category = config.categories[0],
    question = category.questions[index]
  await click(root, `${category.title}: ${question.points} points`)
  return question
}
defineFields('jeopardy', [
  titleCase('jeopardy'),
  nested(
    'teams',
    'Team 1 name',
    'Cobalt team',
    (config) => {
      config.teams[0].name = 'Cobalt team'
    },
    async (root, config) => {
      const group = root.getByRole('group', { name: 'Answering team', exact: true })
      await expect(group.getByRole('button')).toHaveText(config.teams.map((team) => team.name))
      await click(group, config.teams[1].name)
      await expect(
        group.getByRole('button', { name: config.teams[1].name, exact: true })
      ).toHaveAttribute('aria-pressed', 'true')
      await cell(root, config)
      await expect(root).toContainText(`Answering team: ${config.teams[1].name}`)
      await click(root, 'Show answer')
      await click(root, 'Correct')
      await expect(root.locator('[aria-label="Scores"]')).toContainText(
        `${config.teams[1].name}: 100`
      )
    }
  ),
  nested(
    'categories',
    'Category 1 title',
    'Edited geography',
    (config) => {
      config.categories[0].title = 'Edited geography'
    },
    async (root, config) => {
      await expect(
        root.getByRole('heading', { name: 'Edited geography', exact: true })
      ).toBeVisible()
      const question = await cell(root, config)
      await expect(root.getByRole('heading', { name: question.prompt, exact: true })).toBeVisible()
      await click(root, 'Show answer')
      await click(root, 'Correct')
      await expect(root.locator('[aria-label="Scores"]')).toContainText('Blue: 100')
    }
  ),
  {
    field: 'dailyDouble',
    setup: () => {},
    change: (config) => {
      config.dailyDouble = [config.categories[0].questions[0].id]
    },
    author: (panel) => label(panel, 'Category 1 cell 1 daily double').check(),
    exercise: async (root, config) => {
      await cell(root, config)
      await expect(root.getByRole('heading', { name: 'Daily Double', exact: true })).toBeVisible()
      await root.getByRole('spinbutton').fill('50')
      await click(root, 'Start question')
      await click(root, 'Show answer')
      await click(root, 'Correct')
      await expect(root.locator('[aria-label="Scores"]')).toContainText('Blue: 50')
    },
  },
  scalar('showTimer', 'Show timer', false, async (root, config) => {
    await cell(root, config)
    await expect(root.getByRole('timer')).toBeHidden()
    await expect(root.getByRole('button', { name: 'Show answer', exact: true })).toBeEnabled()
  }),
  scalar('timerDuration', 'Timer duration in seconds', 2, async (root, config) => {
    await cell(root, config)
    await expect(root.getByRole('timer')).toContainText(/^[12] seconds remaining$/)
    await expect(root.getByRole('status')).toContainText('Time expired.', { timeout: 5000 })
    await expect(root.getByRole('radio').first()).toBeDisabled()
    await click(root, 'Show answer')
    await expect(root.getByRole('button', { name: 'Correct', exact: true })).toBeEnabled()
  }),
  scalar('negativePoints', 'Allow negative points', true, async (root, config) => {
    await cell(root, config)
    await click(root, 'Show answer')
    await click(root, 'Correct')
    await expect(root.locator('[aria-label="Scores"]')).toContainText('Blue: 100')
    await cell(root, config, 1)
    await click(root, 'Show answer')
    await click(root, 'Incorrect')
    await expect(root.locator('[aria-label="Scores"]')).toContainText('Blue: 0')
  }),
  scalar(
    'wagerLimit',
    'Wager limit',
    50,
    async (root, config) => {
      await cell(root, config)
      await expect(root.getByRole('spinbutton')).toHaveAttribute('max', '50')
      await root.getByRole('spinbutton').fill('51')
      await click(root, 'Start question')
      await expect(root.getByRole('heading', { name: 'Daily Double', exact: true })).toBeVisible()
      await root.getByRole('spinbutton').fill('50')
      await click(root, 'Start question')
      await click(root, 'Show answer')
      await click(root, 'Correct')
      await expect(root.locator('[aria-label="Scores"]')).toContainText('Blue: 50')
    },
    (config) => {
      config.dailyDouble = [config.categories[0].questions[0].id]
    }
  ),
])
