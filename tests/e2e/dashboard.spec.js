import { test, expect } from '@playwright/test'
import { HomePage } from './pages/HomePage.js'
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js'

test.describe('Dashboard & Navigation', () => {
  test('sidebar navigation shows correct views', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()

    await expect(page.locator('button').filter({ hasText: 'Recent' })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'All Presentations' })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Built-in' })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'My Templates' })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Marketplace' })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Trash' })).toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Explore' })).toBeVisible()
  })

  test('can switch sidebar views', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()

    await home.switchSidebarView('Recent')
    await expect(page.locator('button.text-primary').filter({ hasText: 'Recent' })).toBeVisible()

    await home.switchSidebarView('Built-in')
    await expect(page.locator('h2')).toContainText('Template Gallery')
  })

  test('can search presentations', async ({ page, request }) => {
    const pres1 = await apiCreatePresentation(request, 'Alpha Unique Name')
    const pres2 = await apiCreatePresentation(request, 'Beta Other Name')

    const home = new HomePage(page)
    await home.goto()

    await home.searchPresentation('Alpha')
    const cards = page.locator('.bg-card.group')
    await expect(cards.filter({ hasText: 'Alpha' }).first()).toBeVisible()

    await home.clearSearch()

    await apiDeletePresentation(request, pres1.id)
    await apiDeletePresentation(request, pres2.id)
  })

  test('view toggle buttons remain fully visible', async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'View Toggle Layout Regression')

    try {
      const home = new HomePage(page)
      await home.goto()
      await home.switchSidebarView('All Presentations')

      const toggle = page.locator('button[title="List view"]').locator('..')
      const gridButton = page.locator('button[title="Grid view"]')
      const listButton = page.locator('button[title="List view"]')

      await expect(gridButton).toBeVisible()
      await expect(listButton).toBeVisible()

      const metrics = await page.evaluate(() => {
        const grid = document.querySelector('button[title="Grid view"]')
        const list = document.querySelector('button[title="List view"]')
        const wrap = list?.parentElement
        const rect = (node) => {
          const box = node.getBoundingClientRect()
          return {
            left: box.left,
            right: box.right,
            width: box.width,
          }
        }

        return {
          wrap: rect(wrap),
          grid: rect(grid),
          list: rect(list),
        }
      })

      expect(metrics.grid.left).toBeGreaterThanOrEqual(metrics.wrap.left)
      expect(metrics.list.right).toBeLessThanOrEqual(metrics.wrap.right)
      expect(metrics.wrap.width).toBeGreaterThanOrEqual(metrics.grid.width + metrics.list.width)
      await expect(toggle).toBeVisible()
    } finally {
      await apiDeletePresentation(request, pres.id)
    }
  })

  test('can open an existing presentation from All Presentations', async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Open From All Regression')

    try {
      const home = new HomePage(page)
      await home.goto()
      await home.switchSidebarView('All Presentations')

      const card = page.locator('.group.bg-card').filter({ hasText: pres.title }).first()
      await expect(card).toBeVisible()
      await card.click()

      await page.waitForURL(new RegExp(`/editor/${pres.id}`), { timeout: 30000 })
      await expect(page.locator('.slide-canvas')).toBeVisible()
      await expect(page.locator('text=Presentation not found')).toHaveCount(0)
    } finally {
      await apiDeletePresentation(request, pres.id)
    }
  })

  test('can create a new presentation from modal', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()
    await home.createNewPresentation('Dashboard E2E Test')

    expect(page.url()).toContain('/editor/')
  })

  test('new presentation modal toggles blank vs template start controls', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()

    await page.locator('button:has-text("New")').first().click()
    await expect(page.locator('h2:has-text("New Presentation")')).toBeVisible()

    await expect(page.locator('label:has-text("Theme")')).toBeVisible()
    await expect(page.locator('label:has-text("Transition")')).toBeVisible()

    await page.locator('.fixed.inset-0 button').filter({ hasText: 'Blank Light' }).first().click()
    await expect(page.locator('label:has-text("Theme")')).toHaveCount(0)
    await expect(page.locator('label:has-text("Transition")')).toHaveCount(0)

    await page.locator('.fixed.inset-0 button').filter({ hasText: 'Blank' }).first().click()
    await expect(page.locator('label:has-text("Theme")')).toBeVisible()
    await expect(page.locator('label:has-text("Transition")')).toBeVisible()
  })

  test('can duplicate a presentation via API', async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Dup Source')

    // Duplicate via API
    const res = await request.post(`/api/presentations/${pres.id}/duplicate`)
    expect(res.ok()).toBeTruthy()
    const copy = await res.json()
    expect(copy.title).toContain('(copy)')

    // Cleanup both
    await apiDeletePresentation(request, pres.id)
    await apiDeletePresentation(request, copy.id)
  })

  test('can delete to trash and restore via API', async ({ request }) => {
    const pres = await apiCreatePresentation(request, 'Trash Flow Test')

    // Soft delete
    const delRes = await request.delete(`/api/presentations/${pres.id}`)
    expect(delRes.ok()).toBeTruthy()

    // Verify in trash
    const trashRes = await request.get('/api/presentations/trash/list')
    const trashData = await trashRes.json()
    const inTrash = trashData.find((t) => t.id === pres.id)
    expect(inTrash).toBeTruthy()

    // Restore
    const restoreRes = await request.post(`/api/presentations/${pres.id}/restore`)
    expect(restoreRes.ok()).toBeTruthy()

    // Cleanup
    await apiDeletePresentation(request, pres.id)
  })

  test('theme toggle switches between dark and light', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()

    const initialTheme = await home.getTheme()
    await home.toggleTheme()
    const newTheme = await home.getTheme()
    expect(newTheme).not.toBe(initialTheme)

    await home.toggleTheme()
    const restoredTheme = await home.getTheme()
    expect(restoredTheme).toBe(initialTheme)
  })

  test('can navigate to Settings page', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()
    await home.navigateToSettings()

    await expect(page.locator('h1:has-text("Settings")')).toBeVisible()
  })

  test('can navigate to Explore page', async ({ page }) => {
    const home = new HomePage(page)
    await home.goto()
    await home.navigateToExplore()

    await expect(page.locator('h1:has-text("Explore")')).toBeVisible()
  })
})
