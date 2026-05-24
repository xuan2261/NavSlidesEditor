import { expect, test } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import {
  expectStableScreenshot,
  skipNonLinuxVisualSnapshots,
  suppressTutorialAndOverlays,
} from '../pages/visual-snapshot-deterministic-freeze-and-helper.js'

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'insert', label: 'Insert' },
  { id: 'design', label: 'Design' },
  { id: 'format', label: 'Format' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'animations', label: 'Animations' },
  { id: 'view', label: 'View' },
]

async function seedPresentation(request) {
  const pres = await apiCreatePresentation(request, 'Ribbon Visual Baseline')
  await apiUpdatePresentation(request, pres.id, {
    slides: [
      { id: 'slide-1', elements: [{ id: 't1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h2>Visual Baseline</h2>' }], notes: '', background: { type: 'color', color: '#1e1e2e' } },
    ],
  })
  return pres
}

test.describe('Ribbon tabs visual baseline across all 7 tabs and dark theme', () => {
  skipNonLinuxVisualSnapshots()

  let presId

  test.beforeEach(async ({ page, request }) => {
    await suppressTutorialAndOverlays(page)
    const pres = await seedPresentation(request)
    presId = pres.id
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test.afterEach(async ({ request }) => {
    try { await apiDeletePresentation(request, presId) } catch {}
  })

  for (const tab of TABS) {
    test(`ribbon tab ${tab.id} renders dark theme baseline`, async ({ page }) => {
      await page.goto(`/editor/${presId}`)
      await page.waitForSelector('.slide-canvas', { timeout: 15000 })
      const requiredTabs = page.getByRole('tab')
      await expect(requiredTabs).toHaveText(TABS.map((item) => item.label))
      const tabButton = page.getByRole('tab', { name: tab.label, exact: true })
      await tabButton.click()
      await expect(tabButton).toHaveAttribute('aria-selected', 'true')
      await expectStableScreenshot(page, `ribbon-${tab.id}-dark.png`, {
        clip: { x: 0, y: 0, width: 1280, height: 240 },
      })
    })
  }
})
