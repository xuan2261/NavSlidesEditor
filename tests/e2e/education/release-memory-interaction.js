import { expect } from '@playwright/test'

export async function matchMemory(root, config) {
  const progress = root.locator('[data-ns-memory-progress]')
  await root.getByRole('button', { name: 'Reveal all', exact: true }).click()
  await expect(progress).toContainText(/\b0 points\b/)
  const identities = []
  for (const pair of config.pairs) {
    if (pair.first.type !== 'text' || pair.second.type !== 'text')
      throw new Error('Release memory preset requires visible authored text faces')
    identities.push([
      await root
        .locator('[data-ns-memory-card]')
        .filter({ hasText: pair.first.text })
        .getAttribute('data-ns-memory-card'),
      await root
        .locator('[data-ns-memory-card]')
        .filter({ hasText: pair.second.text })
        .getAttribute('data-ns-memory-card'),
    ])
  }
  await root.getByRole('button', { name: 'Reset', exact: true }).click()
  for (const pair of identities) {
    await root.locator(`[data-ns-memory-card="${pair[0]}"]`).press('Enter')
    await root.locator(`[data-ns-memory-card="${pair[1]}"]`).press('Space')
  }
  await expect(progress).toContainText(`${config.pairs.length} / ${config.pairs.length}`)
  await expect(progress).toContainText(
    new RegExp(`\\b${config.pairs.length * config.matchPoints} points$`)
  )
}
