import { expect } from '@playwright/test'
import { defineFields, scalar, nested, titleCase, click } from './release-game-fields-harness.js'

async function expired(root, config) {
  await click(root, 'Start')
  await expect(root.locator('div[role="status"][aria-live="polite"]')).toHaveText(
    config.expiryMessage,
    { timeout: 6000 }
  )
  await expect(root.locator('[data-ns-countdown]')).toHaveText('00:00')
  await expect(root.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled()
}
defineFields('countdown', [
  titleCase('countdown'),
  scalar('durationSeconds', 'Duration in seconds', 2, async (root, config) => {
    await expect(root.locator('[data-ns-countdown]')).toHaveText('00:02')
    await expect(
      root.getByRole('spinbutton', { name: 'Duration in seconds', exact: true })
    ).toHaveValue('2')
    await expired(root, config)
    await click(root, 'Reset')
    await expect(root.locator('[data-ns-countdown]')).toHaveText('00:02')
  }),
  scalar(
    'autoStart',
    'Start automatically',
    true,
    async (root) => {
      await expect(root.getByRole('button', { name: 'Start', exact: true })).toBeDisabled()
      await expect(root.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled()
      await click(root, 'Pause')
      await expect(root.getByRole('button', { name: 'Pause', exact: true })).toBeDisabled()
      await expect(root.getByRole('button', { name: 'Resume', exact: true })).toBeEnabled()
    },
    (config) => {
      config.durationSeconds = 3
    }
  ),
  scalar('expiryMessage', 'Expiry message', 'Edited timer expired', expired),
])
const resetVariables = scalar(
  'resetBoundVariables',
  'Reset only variables bound to this scoreboard',
  true,
  async (root, config) => {
    const first = config.teams[0],
      second = config.teams[1]
    await expect(root.locator(`[data-ns-score="${first.id}"]`)).toHaveText('5')
    await click(root, `Increase ${first.name} score by 1`)
    await click(root, `Increase ${second.name} score by 1`)
    await expect(root.locator(`[data-ns-score="${first.id}"]`)).toHaveText('6')
    await expect(root.locator(`[data-ns-score="${second.id}"]`)).toHaveText('1')
    await click(root, 'Reset')
    await expect(root.locator(`[data-ns-score="${first.id}"]`)).toHaveText('5')
    await expect(root.locator(`[data-ns-score="${second.id}"]`)).toHaveText('0')
  },
  (config) => {
    delete config.teams[0].initialScore
    config.teams[0].variableId = 'class-score'
  }
)
resetVariables.deckProperties = {
  interactionVariables: [
    { id: 'class-score', name: 'Class score', initialValue: 5, min: 0, max: 100 },
  ],
}
defineFields('scoreboard', [
  titleCase('scoreboard'),
  nested(
    'teams',
    'Team 1 name',
    'Cobalt team',
    (config) => {
      config.teams[0].name = 'Cobalt team'
    },
    async (root) => {
      await expect(root.getByRole('heading', { name: 'Cobalt team', exact: true })).toBeVisible()
      await click(root, 'Increase Cobalt team score by 1')
      await expect(root.getByLabel('Cobalt team score', { exact: true })).toHaveText('1')
      await click(root, 'Reset')
      await expect(root.getByLabel('Cobalt team score', { exact: true })).toHaveText('0')
    }
  ),
  scalar('step', 'Score step', 3, async (root) => {
    await click(root, 'Increase Blue score by 3')
    await expect(root.getByLabel('Blue score', { exact: true })).toHaveText('3')
    await click(root, 'Decrease Blue score by 3')
    await expect(root.getByLabel('Blue score', { exact: true })).toHaveText('0')
  }),
  scalar('minScore', 'Minimum score', -2, async (root) => {
    await click(root, 'Decrease Blue score by 1')
    await click(root, 'Decrease Blue score by 1')
    await expect(root.getByLabel('Blue score', { exact: true })).toHaveText('-2')
    await expect(
      root.getByRole('button', { name: 'Decrease Blue score by 1', exact: true })
    ).toBeDisabled()
    await click(root, 'Increase Blue score by 1')
    await expect(root.getByLabel('Blue score', { exact: true })).toHaveText('-1')
  }),
  scalar('maxScore', 'Maximum score', 2, async (root) => {
    await click(root, 'Increase Blue score by 1')
    await click(root, 'Increase Blue score by 1')
    await expect(root.getByLabel('Blue score', { exact: true })).toHaveText('2')
    await expect(
      root.getByRole('button', { name: 'Increase Blue score by 1', exact: true })
    ).toBeDisabled()
    await click(root, 'Decrease Blue score by 1')
    await expect(root.getByLabel('Blue score', { exact: true })).toHaveText('1')
  }),
  resetVariables,
])
