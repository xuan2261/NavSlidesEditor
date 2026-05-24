import { test, expect } from '@playwright/test'
import { ExplorePage } from './pages/explore-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiCreateShareLink,
} from './fixtures/test-fixtures.js'

test.describe('Explore Page', () => {
  test('can navigate to Explore page', async ({ page }) => {
    const explore = new ExplorePage(page)
    await explore.goto()

    await expect(page.locator('h1:has-text("Explore")')).toBeVisible()
  })

  test('shows empty state when no shared presentations', async ({ page }) => {
    const explore = new ExplorePage(page)
    await explore.goto()

    const cardCount = await explore.getCardCount()
    if (cardCount === 0) {
      await expect(page.locator('text=No public presentations yet')).toBeVisible()
    } else {
      await expect(explore.presentationCards).toHaveCount(cardCount)
    }
  })

  test('shows shared presentations after sharing one', async ({ page, request }) => {
    // Create and share a presentation
    const pres = await apiCreatePresentation(request, 'Explore Visible Pres')
    await apiCreateShareLink(request, pres.id)

    const explore = new ExplorePage(page)
    await explore.goto()

    await expect(page.locator('text=Explore Visible Pres')).toBeVisible({ timeout: 10000 })

    // Cleanup
    await apiDeletePresentation(request, pres.id)
  })

  test('can navigate back to home', async ({ page }) => {
    const explore = new ExplorePage(page)
    await explore.goto()
    await explore.goBack()

    await expect(page.locator('.bg-panel').first()).toBeVisible()
  })
})
