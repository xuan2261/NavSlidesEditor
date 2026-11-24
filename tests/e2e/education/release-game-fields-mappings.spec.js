import { expect } from '@playwright/test'
import {
  defineFields,
  scalar,
  nested,
  titleCase,
  participant,
  click,
  label,
} from './release-game-fields-harness.js'

async function assign(root, source, target) {
  await root
    .getByRole('group', { name: 'Sources', exact: true })
    .getByRole('button', { name: source, exact: true })
    .click()
  await root
    .getByRole('group', { name: 'Targets', exact: true })
    .getByRole('button', { name: target, exact: true })
    .click()
}
async function matchingStart(root) {
  await participant(root)
  await click(root, 'Start')
}
async function sortCorrect(root, config) {
  for (const answer of config.answerKey.assignments)
    await assign(
      root,
      config.items.find((item) => item.id === answer.itemId).text,
      config.buckets.find((bucket) => bucket.id === answer.bucketId).label
    )
  await click(root, 'Check sorting')
  await expect(root.getByRole('status').last()).toHaveText('Correct! All items are sorted.')
  await expect(root.locator('[data-ns-sorting-summary]')).toContainText(`Score: ${config.points}.`)
}
defineFields('matching', [
  titleCase('matching'),
  scalar('prompt', 'Prompt', 'Edited matching prompt', async (root) => {
    await expect(
      root.getByRole('group', { name: 'Edited matching prompt', exact: true })
    ).toBeVisible()
    await matchingStart(root)
    await assign(root, 'France', 'Paris')
    await assign(root, 'Italy', 'Rome')
    await click(root, 'Submit matches')
    await expect(root.locator('.ns-classroom-controls [role="status"]')).toHaveText(
      '2 / 2 pairs correct'
    )
  }),
  {
    field: 'pairs',
    setup: () => {},
    change: (config) => {
      config.pairs[0].target = 'Rome'
      config.pairs[1].target = 'Paris'
    },
    author: async (panel) => {
      await label(panel, 'Pair 1 target').fill('Rome')
      await label(panel, 'Pair 2 target').fill('Paris')
    },
    exercise: async (root) => {
      await matchingStart(root)
      await assign(root, 'France', 'Paris')
      await assign(root, 'Italy', 'Rome')
      await click(root, 'Submit matches')
      await expect(root.locator('.ns-classroom-controls [role="status"]')).toHaveText(
        '0 / 2 pairs correct'
      )
      await click(root, 'Reset')
      await matchingStart(root)
      await assign(root, 'France', 'Rome')
      await assign(root, 'Italy', 'Paris')
      await click(root, 'Submit matches')
      await expect(root.locator('.ns-classroom-controls [role="status"]')).toHaveText(
        '2 / 2 pairs correct'
      )
      await click(root, 'Reveal results')
      await expect(root.locator('[data-ns-results]')).toContainText('France → Rome')
      await expect(root.locator('[data-ns-results]')).toContainText('Italy → Paris')
    },
  },
  scalar('timerDuration', 'Timer duration in seconds', 2, async (root) => {
    await matchingStart(root)
    await expect(label(root, 'Time remaining')).toContainText(/^[12] seconds remaining$/)
    await expect(label(root, 'Time remaining')).toHaveText('Round ended', { timeout: 5000 })
    await expect(root.getByRole('button', { name: 'Submit matches', exact: true })).toBeDisabled()
  }),
])
defineFields('sorting', [
  titleCase('sorting'),
  nested(
    'buckets',
    'Bucket 1 label',
    'Edited fruit',
    (config) => {
      config.buckets[0].label = 'Edited fruit'
    },
    async (root, config) => {
      await expect(
        root
          .getByRole('group', { name: 'Targets', exact: true })
          .getByRole('button', { name: 'Edited fruit', exact: true })
      ).toBeVisible()
      await sortCorrect(root, config)
    }
  ),
  nested(
    'items',
    'Sorting item 1 text',
    'Edited apple',
    (config) => {
      config.items[0].text = 'Edited apple'
    },
    async (root, config) => {
      await expect(
        root
          .getByRole('group', { name: 'Sources', exact: true })
          .getByRole('button', { name: 'Edited apple', exact: true })
      ).toBeVisible()
      await sortCorrect(root, config)
    }
  ),
  {
    field: 'answerKey',
    setup: (config) => {
      config.attemptLimit = 2
    },
    change: (config) => {
      config.answerKey.assignments[0].bucketId = config.buckets[1].id
    },
    author: (panel) => label(panel, 'Sorting item 1 correct bucket').selectOption('vegetable'),
    exercise: async (root, config) => {
      await assign(root, 'Apple', 'Fruit')
      await assign(root, 'Carrot', 'Vegetable')
      await click(root, 'Check sorting')
      await expect(root.getByRole('status').last()).toHaveText(
        'Not yet. Change your assignments and try again.'
      )
      await expect(root.locator('[data-ns-sorting-summary]')).toHaveText('Score: 0. Attempts: 1/2.')
      await sortCorrect(root, config)
      await click(root, 'Reset sorting')
      await expect(root.locator('[data-ns-sorting-summary]')).toHaveText('Score: 0. Attempts: 0/2.')
    },
  },
  scalar('attemptLimit', 'Sorting attempt limit', 2, async (root, config) => {
    await assign(root, 'Apple', 'Vegetable')
    await assign(root, 'Carrot', 'Fruit')
    await click(root, 'Check sorting')
    await expect(root.getByRole('button', { name: 'Check sorting', exact: true })).toBeEnabled()
    await expect(root.locator('[data-ns-sorting-summary]')).toHaveText('Score: 0. Attempts: 1/2.')
    await sortCorrect(root, config)
    await expect(root.getByRole('button', { name: 'Check sorting', exact: true })).toBeDisabled()
  }),
  scalar('points', 'Sorting points', 15, sortCorrect),
])
