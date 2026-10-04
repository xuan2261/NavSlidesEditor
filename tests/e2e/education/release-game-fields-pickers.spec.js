import { expect } from '@playwright/test'
import {
  defineFields,
  scalar,
  select,
  nested,
  titleCase,
  reset,
} from './release-game-fields-harness.js'

async function pick(root, type, config) {
  await root.locator(`[data-ns-command="${type === 'name-picker' ? 'pick' : 'spin'}"]`).click()
  await expect(root.locator('[data-ns-winner]')).toHaveText(config.items[0].label)
}
const wheelSetup = (config) => {
  if (Object.hasOwn(config, 'pickerMode')) config.pickerMode = 'wheel'
}
for (const type of ['name-picker', 'lucky-wheel']) {
  const name = type === 'name-picker'
  const cases = name ? [] : [titleCase(type)]
  cases.push(
    nested(
      'items',
      name ? 'Item 1 label' : 'Prize 1 label',
      'Edited prize',
      (config) => {
        config.items[0].label = 'Edited prize'
      },
      async (root, config) => {
        await expect(root.locator('.ns-picker-wheel svg text').first()).toHaveText('Edited prize')
        await pick(root, type, config)
        await reset(root)
        await expect(root.locator('[data-ns-winner]')).not.toHaveText('Edited prize')
      },
      wheelSetup
    )
  )
  const weighted = scalar(
    'weighted',
    'Weighted selection',
    false,
    async (root, config) => {
      const distribution = root.getByRole('list', { name: 'Selection probabilities', exact: true })
      for (const item of config.items)
        await expect(
          distribution.getByRole('listitem').filter({ hasText: item.label })
        ).toContainText(/50(?:\.0+)?\s*%/)
      await root.locator(`[data-ns-command="${name ? 'pick' : 'spin'}"]`).click()
      await expect
        .poll(async () =>
          config.items
            .map((item) => item.label)
            .includes(await root.locator('[data-ns-winner]').innerText())
        )
        .toBe(true)
      const selectedWinner = await root.locator('[data-ns-winner]').innerText()
      await reset(root)
      await expect(distribution.getByRole('listitem')).toHaveCount(2)
      for (const item of config.items)
        await expect(
          distribution.getByRole('listitem').filter({ hasText: item.label })
        ).toContainText(/50(?:\.0+)?\s*%/)
      return { selectedWinner, probabilities: await distribution.innerText() }
    },
    (config) => {
      wheelSetup(config)
      config.weighted = true
      config[name ? 'excludeAfterPick' : 'removeAfterPick'] = false
      config.items = [
        { id: 'weight-a', label: 'First choice', weight: 1 },
        { id: 'weight-b', label: 'Second choice', weight: 3 },
      ]
    }
  )
  weighted.beforeAuthor = async (page) => {
    await page.getByRole('button', { name: 'Try game', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Try game', exact: true })
    const probabilities = dialog.getByRole('list', { name: 'Selection probabilities', exact: true })
    await expect(
      probabilities.getByRole('listitem').filter({ hasText: 'First choice' })
    ).toContainText(/25(?:\.0+)?\s*%/)
    await expect(
      probabilities.getByRole('listitem').filter({ hasText: 'Second choice' })
    ).toContainText(/75(?:\.0+)?\s*%/)
    const observed = await probabilities.innerText()
    await dialog.getByRole('button', { name: /^Close/ }).click()
    return observed
  }
  cases.push(weighted)
  cases.push(
    scalar(
      name ? 'excludeAfterPick' : 'removeAfterPick',
      name ? 'Exclude after pick' : 'Remove prize after picking',
      true,
      async (root, config) => {
        await pick(root, type, config)
        await expect(root.locator(`[data-ns-command="${name ? 'pick' : 'spin'}"]`)).toBeDisabled()
        await reset(root)
        await expect(root.locator(`[data-ns-command="${name ? 'pick' : 'spin'}"]`)).toBeEnabled()
      },
      (config) => {
        config[name ? 'excludeAfterPick' : 'removeAfterPick'] = false
      }
    )
  )
  cases.push(
    scalar(
      'animationDuration',
      'Animation duration in milliseconds',
      800,
      async (root, config) => {
        await root.locator(`[data-ns-command="${name ? 'pick' : 'spin'}"]`).click()
        await expect(root.locator(`[data-ns-command="${name ? 'pick' : 'spin'}"]`)).toBeDisabled()
        await expect(root.locator('.ns-picker-wheel svg')).toHaveCSS('animation-duration', '0.8s')
        await expect(root.locator('[data-ns-winner]')).toHaveText(config.items[0].label)
      },
      wheelSetup
    )
  )
  cases.push(
    scalar(
      'showConfetti',
      'Confetti animation',
      true,
      async (root, config) => {
        await expect(root.locator('.ns-picker-confetti')).toHaveCount(0)
        await pick(root, type, config)
        await expect(root.locator('.ns-picker-confetti')).toBeVisible()
      },
      (config) => {
        config.showConfetti = false
      }
    )
  )
  if (name)
    cases.push(
      select('pickerMode', 'Picker mode', 'dice', async (root) => {
        await expect(root.getByRole('combobox', { name: 'Picker mode', exact: true })).toHaveValue(
          'dice'
        )
        await expect(root.locator('.ns-picker-dice svg')).toHaveCount(2)
        await expect(root.getByRole('button', { name: 'Roll', exact: true })).toBeEnabled()
      }),
      scalar(
        'wheelSegments',
        'Wheel segments',
        3,
        async (root) => {
          await expect(root.locator('.ns-picker-wheel svg > g')).toHaveCount(3)
          await expect(root.locator('.ns-picker-wheel svg text')).toHaveText([
            'Authored winner',
            'Authored winner',
            'Authored winner',
          ])
        },
        wheelSetup
      ),
      nested(
        'wheelColors',
        'Wheel color 1',
        '#123456',
        (config) => {
          config.wheelColors[0] = '#123456'
        },
        async (root) => {
          await expect(root.locator('.ns-picker-wheel path').first()).toHaveAttribute(
            'fill',
            '#123456'
          )
          await expect(root.locator('.ns-picker-wheel path').first()).toHaveCSS(
            'fill',
            'rgb(18, 52, 86)'
          )
        },
        wheelSetup
      ),
      scalar(
        'diceCount',
        'Dice count',
        3,
        async (root, config) => {
          await expect(root.locator('.ns-picker-dice svg')).toHaveCount(3)
          await pick(root, type, config)
          const names = await root
            .locator('.ns-picker-dice svg')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')))
          expect(names).toEqual([
            expect.stringMatching(/^Die 1: [1-6]$/),
            expect.stringMatching(/^Die 2: [1-6]$/),
            expect.stringMatching(/^Die 3: [1-6]$/),
          ])
        },
        (config) => {
          config.pickerMode = 'dice'
        }
      )
    )
  defineFields(type, cases)
}
