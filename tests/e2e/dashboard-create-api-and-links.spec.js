import { test, expect } from '@playwright/test'
import { HomePage } from './pages/home-page.js'

test.describe('Dashboard & Navigation', () => {
  test('can navigate to Explore page', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()
    await home.navigateToExplore()

    await expect(page.locator('h1:has-text("Explore")')).toBeVisible()
  })
})
