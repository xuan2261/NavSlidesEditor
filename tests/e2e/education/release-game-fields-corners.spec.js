import { expect } from '@playwright/test'
import {
  defineFields,
  scalar,
  select,
  titleCase,
  questionCase,
  participant,
  click,
  label,
} from './release-game-fields-harness.js'

async function start(root) {
  await participant(root)
  await click(root, 'Start round')
}
async function choose(root, option) {
  await root.locator(`[data-ns-command="corner-${option.id}"]`).click()
}
defineFields('four-corners', [
  titleCase('four-corners'),
  questionCase(async (root, config) => {
    await start(root)
    await expect(root.getByRole('heading', { level: 4 })).toContainText('Edited capital question')
    await choose(root, config.questions[0].options[0])
    await click(root, 'Reveal correct corner')
    await expect(root.locator('[aria-label="Participant scores"]')).toContainText(
      'Field learner: 10'
    )
    await expect(root).toContainText('Correct corner: Paris')
  }),
  {
    field: 'cornerCount',
    setup: (config) => {
      config.cornerCount = 3
      config.questions[0].options = config.questions[0].options.slice(0, 3)
    },
    change: (config) => {
      config.cornerCount = 2
      config.questions[0].options = config.questions[0].options.slice(0, 2)
    },
    author: async (panel, page) => {
      await label(panel, 'Corner count').fill('2')
      await expect(panel.getByRole('alert')).toBeVisible()
      await click(panel, 'Edit question 1')
      const modal = page.getByRole('dialog', { name: 'Edit Question', exact: true })
      await click(modal, 'Delete option 3')
      await click(modal, 'Save')
      await expect(panel.getByRole('alert')).toHaveCount(0)
    },
    exercise: async (root, config) => {
      await start(root)
      await expect(
        root.getByRole('group', { name: 'Choose a corner', exact: true }).getByRole('button')
      ).toHaveCount(2)
      await choose(root, config.questions[0].options[0])
      await click(root, 'Reveal correct corner')
      await expect(root.locator('[aria-label="Participant scores"]')).toContainText(
        'Field learner: 10'
      )
    },
  },
  select('eliminateMode', 'Elimination mode', 'none', async (root, config) => {
    await start(root)
    await choose(root, config.questions[0].options[1])
    await click(root, 'Reveal correct corner')
    await expect(root.locator('[aria-label="Current corner"]')).not.toContainText('eliminated')
    await expect(root.locator('[aria-label="Participant scores"]')).toContainText(
      'Field learner: 0'
    )
    await expect(root.getByRole('status')).toContainText('Try again.')
  }),
  scalar('timerDuration', 'Timer duration in seconds', 2, async (root) => {
    await start(root)
    await expect(root.getByRole('timer')).toContainText(/^[12] seconds remaining$/)
    await expect(root.getByRole('button', { name: 'Finish game', exact: true })).toBeVisible({
      timeout: 5000,
    })
    await expect(
      root.getByRole('group', { name: 'Choose a corner', exact: true }).getByRole('button').first()
    ).toBeDisabled()
    await expect(root).toContainText('Correct corner: Paris')
  }),
  scalar('showTimer', 'Show timer', false, async (root, config) => {
    await start(root)
    await expect(root.getByRole('timer')).toBeHidden()
    await choose(root, config.questions[0].options[0])
    await click(root, 'Reveal correct corner')
    await expect(root.locator('[aria-label="Participant scores"]')).toContainText(
      'Field learner: 10'
    )
  }),
])
