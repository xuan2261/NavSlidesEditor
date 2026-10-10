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

async function start(root) {
  await participant(root)
  await click(root, 'Start')
}
async function vote(root, text) {
  await root.getByRole('radio', { name: text, exact: true }).check()
  await click(root, 'Submit vote')
}
async function phrase(root, text) {
  await label(root, 'Word or phrase').fill(text)
  await click(root, 'Submit phrase')
}
const timer = scalar('timerDuration', 'Timer duration in seconds', 2, async (root) => {
  await start(root)
  await expect(label(root, 'Time remaining')).toContainText(/^[12] seconds remaining$/)
  await expect(label(root, 'Time remaining')).toHaveText('Round ended', { timeout: 5000 })
  await expect(root.locator('[data-ns-submission-form] button')).toBeDisabled()
})
defineFields('poll', [
  titleCase('poll'),
  scalar('prompt', 'Prompt', 'Edited vote prompt', async (root, config) => {
    await expect(root.getByRole('group', { name: config.prompt, exact: true })).toBeVisible()
    await start(root)
    await vote(root, config.options[0].text)
    await expect(root.locator('[data-ns-results]')).toContainText(`${config.options[0].text}: 1`)
  }),
  nested(
    'options',
    'Poll option 1 text',
    'Edited choice',
    (config) => {
      config.options[0].text = 'Edited choice'
    },
    async (root) => {
      await expect(root.getByRole('radio', { name: 'Edited choice', exact: true })).toBeVisible()
      await start(root)
      await vote(root, 'Edited choice')
      await expect(root.locator('[data-ns-results]')).toContainText('Edited choice: 1')
    }
  ),
  scalar('showResults', 'Show results', false, async (root, config) => {
    await start(root)
    await vote(root, config.options[0].text)
    await expect(root.locator('[data-ns-results]')).toBeHidden()
    await click(root, 'Reveal results')
    await expect(root.locator('[data-ns-results]')).toBeVisible()
    await expect(root.locator('[data-ns-results]')).toContainText(`${config.options[0].text}: 1`)
  }),
  scalar('allowVoteChange', 'Allow vote change', false, async (root, config) => {
    await start(root)
    await vote(root, config.options[0].text)
    await vote(root, config.options[1].text)
    await expect(root.locator('[data-ns-results]')).toContainText(`${config.options[0].text}: 1`)
    await expect(root.locator('[data-ns-results]')).toContainText(`${config.options[1].text}: 0`)
  }),
  timer,
])
defineFields('word-cloud', [
  titleCase('word-cloud'),
  scalar('prompt', 'Prompt', 'Edited phrase prompt', async (root, config) => {
    await expect(root.getByRole('group', { name: config.prompt, exact: true })).toBeVisible()
    await start(root)
    await phrase(root, 'Earth')
    await expect(root.locator('.ns-cloud-word')).toHaveText('earth (1)')
  }),
  scalar('maxPhraseLength', 'Maximum phrase length', 4, async (root) => {
    await start(root)
    await phrase(root, '  ABCDEF  ')
    await expect(root.locator('.ns-cloud-word')).toHaveText('abcd (1)')
    await phrase(root, 'ABCDzz')
    await expect(root.locator('.ns-cloud-word')).toHaveText('abcd (2)')
  }),
  scalar('maxSubmissionsPerPlayer', 'Maximum submissions per player', 1, async (root) => {
    await start(root)
    await phrase(root, 'First')
    await phrase(root, 'Second')
    await expect(root.locator('[data-ns-quota]')).toHaveText('1 / 1 submissions used')
    await expect(root.locator('.ns-cloud-word')).toHaveText('first (1)')
  }),
  scalar('displayLimit', 'Display limit', 1, async (root) => {
    await start(root)
    await phrase(root, 'Zulu')
    await phrase(root, 'Alpha')
    await phrase(root, 'Zulu')
    await expect(root.locator('[data-ns-results]')).toContainText('3 phrases submitted')
    await expect(root.locator('.ns-cloud-word')).toHaveText('zulu (2)')
  }),
  timer,
])
