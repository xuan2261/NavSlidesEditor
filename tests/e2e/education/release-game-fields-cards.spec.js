import { expect } from '@playwright/test'
import { defineFields, scalar, titleCase, click, label } from './release-game-fields-harness.js'

const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDS8AAAAASUVORK5CYII='
async function matchAll(root, config) {
  const cards = root.locator('[data-ns-memory-card]')
  for (let index = 0; index < config.pairs.length; index++) {
    await cards.nth(index * 2).click()
    await cards.nth(index * 2 + 1).click()
  }
  await expect(root.locator('[data-ns-memory-card][data-ns-card-state="matched"]')).toHaveCount(
    config.pairs.length * 2
  )
  for (let index = 0; index < config.pairs.length * 2; index++)
    await expect(cards.nth(index)).toBeDisabled()
  await expect(root.locator('[data-ns-memory-progress]')).toHaveText(
    `${config.pairs.length} / ${config.pairs.length} pairs matched · ${config.pairs.length} attempts · ${config.pairs.length * config.matchPoints} points`
  )
}
defineFields('memory', [
  titleCase('memory'),
  {
    field: 'pairs',
    setup: () => {},
    change: (config) => {
      config.pairs[0].first = { type: 'image', src: image, alt: 'Edited France picture' }
      config.pairs[0].second = { type: 'text', text: 'Edited Paris answer' }
    },
    author: async (panel) => {
      await label(panel, 'Pair 1 first content type').selectOption('image')
      await label(panel, 'Pair 1 first image URL').fill(image)
      await label(panel, 'Pair 1 first image alt text').fill('Edited France picture')
      await label(panel, 'Pair 1 second text').fill('Edited Paris answer')
    },
    exercise: async (root, config) => {
      await root.locator('[data-ns-memory-card]').nth(0).click()
      const picture = root.getByRole('img', { name: 'Edited France picture', exact: true })
      await expect(picture).toBeVisible()
      await expect(picture).toHaveJSProperty('naturalWidth', 1)
      await root.locator('[data-ns-memory-card]').nth(1).click()
      await expect(root.locator('[data-ns-memory-card]').nth(1)).toContainText(
        'Edited Paris answer'
      )
      await expect(root.locator('[data-ns-memory-progress]')).toContainText(
        `1 / 2 pairs matched · 1 attempts · ${config.matchPoints} points`
      )
      await click(root, 'Reset')
      await expect(root.getByRole('img')).toHaveCount(0)
      await expect(
        root.locator('[data-ns-memory-card][data-ns-card-state="face-down"]')
      ).toHaveCount(4)
    },
  },
  scalar(
    'shuffleOnStart',
    'Shuffle on start',
    false,
    async (root, config) => {
      await matchAll(root, config)
      await expect(root.locator('[data-ns-memory-card]').nth(0)).toContainText('France')
      await expect(root.locator('[data-ns-memory-card]').nth(1)).toContainText('Paris')
      await expect(root.locator('[data-ns-memory-card]').nth(2)).toContainText('Italy')
      await expect(root.locator('[data-ns-memory-card]').nth(3)).toContainText('Rome')
    },
    (config) => {
      config.shuffleOnStart = true
    }
  ),
  scalar('mismatchDelayMs', 'Mismatch delay in milliseconds', 800, async (root) => {
    const cards = root.locator('[data-ns-memory-card]')
    await cards.nth(0).click()
    const began = Date.now()
    await cards.nth(2).click()
    await expect(cards.nth(0)).toHaveAttribute('data-ns-card-state', 'face-up')
    await expect(cards.nth(2)).toHaveAttribute('data-ns-card-state', 'face-up')
    await expect(cards.nth(1)).toBeDisabled()
    await expect(cards.nth(0)).toHaveAttribute('data-ns-card-state', 'face-down', { timeout: 4000 })
    expect(Date.now() - began).toBeGreaterThanOrEqual(600)
    await expect(cards.nth(2)).toHaveAttribute('data-ns-card-state', 'face-down')
    await expect(cards.nth(1)).toBeEnabled()
    await expect(root.locator('[data-ns-memory-progress]')).toContainText(
      '0 / 2 pairs matched · 1 attempts · 0 points'
    )
  }),
  scalar('matchPoints', 'Match points', 15, async (root, config) => {
    await matchAll(root, config)
    await click(root, 'Reset')
    await expect(root.locator('[data-ns-memory-progress]')).toHaveText(
      '0 / 2 pairs matched · 0 attempts · 0 points'
    )
  }),
])
defineFields('flashcards', [
  titleCase('flashcards'),
  {
    field: 'cards',
    setup: () => {},
    change: (config) => {
      config.cards[0].front = { type: 'image', src: image, alt: 'Edited flashcard picture' }
      config.cards[0].back = { type: 'text', text: 'Edited capital answer' }
    },
    author: async (panel) => {
      await label(panel, 'Card 1 front content type').selectOption('image')
      await label(panel, 'Card 1 front image URL').fill(image)
      await label(panel, 'Card 1 front image alt text').fill('Edited flashcard picture')
      await label(panel, 'Card 1 back text').fill('Edited capital answer')
    },
    exercise: async (root) => {
      const picture = root.getByRole('img', { name: 'Edited flashcard picture', exact: true })
      await expect(picture).toBeVisible()
      await expect(picture).toHaveJSProperty('naturalWidth', 1)
      await click(root, 'Show back of card 1')
      await expect(root.getByRole('group', { name: 'Card back', exact: true })).toContainText(
        'Edited capital answer'
      )
      await expect(root.getByRole('img')).toHaveCount(0)
      await click(root, 'Next')
      await expect(root.getByRole('group', { name: 'Card front', exact: true })).toContainText(
        'Capital of Italy?'
      )
      await click(root, 'Previous')
      await click(root, 'Reset')
      await expect(picture).toBeVisible()
      await expect(root.locator('[data-ns-flashcards-progress]')).toHaveText(
        'Card 1 / 2 · 0 / 2 studied'
      )
    },
  },
  scalar(
    'shuffleOnStart',
    'Shuffle on start',
    false,
    async (root) => {
      await expect(root.getByRole('group', { name: 'Card front', exact: true })).toContainText(
        'Capital of France?'
      )
      await click(root, 'Show back of card 1')
      await expect(root.getByRole('group', { name: 'Card back', exact: true })).toContainText(
        'Paris'
      )
      await click(root, 'Next')
      await expect(root.getByRole('group', { name: 'Card front', exact: true })).toContainText(
        'Capital of Italy?'
      )
      await click(root, 'Show back of card 2')
      await expect(root.getByRole('group', { name: 'Card back', exact: true })).toContainText(
        'Rome'
      )
      await click(root, 'Reset')
      await expect(root.getByRole('group', { name: 'Card front', exact: true })).toContainText(
        'Capital of France?'
      )
    },
    (config) => {
      config.shuffleOnStart = true
    }
  ),
])
