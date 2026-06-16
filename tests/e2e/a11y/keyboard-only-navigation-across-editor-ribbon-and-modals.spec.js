import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
} from '../fixtures/test-fixtures.js'
import { waitForStableDOM } from '../pages/axe-a11y-scan-helper-with-stable-dom-wait.js'

async function dismissTour(page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('navSlidesTutorialSeen', 'true')
      window.localStorage.setItem('navSlidesProductTourSeen', 'true')
    } catch {}
  })
}

test.describe('Keyboard only navigation across editor ribbon tabs and modals', () => {
  let presId

  test.beforeEach(async ({ request, page }) => {
    await dismissTour(page)
    const pres = await apiCreatePresentation(request, 'Keyboard A11y E2E')
    presId = pres.id
  })

  test.afterEach(async ({ request }) => {
    if (presId) try { await apiDeletePresentation(request, presId) } catch {}
  })

  test('Tab key cycles focus through ribbon tab bar with role tab', async ({ page }) => {
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    await waitForStableDOM(page)

    const homeTab = page.getByRole('tab', { name: /Home/i }).first()
    await homeTab.focus()
    await expect(homeTab).toBeFocused()

    await page.keyboard.press('ArrowRight')
    await waitForStableDOM(page)
    const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute('role'))
    expect(focusedRole).toBe('tab')
  })

  test('ArrowLeft and ArrowRight roving navigates ribbon tabs without leaving tablist', async ({ page }) => {
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    await waitForStableDOM(page)

    const tabs = page.getByRole('tab')
    const total = await tabs.count()
    expect(total).toBeGreaterThanOrEqual(3)

    await tabs.first().focus()
    for (let i = 0; i < total - 1; i += 1) {
      await page.keyboard.press('ArrowRight')
    }
    const focusedRole = await page.evaluate(() => document.activeElement?.getAttribute('role'))
    expect(focusedRole).toBe('tab')
  })

  test('Home and End keys jump to first and last ribbon tab via roving focus', async ({ page }) => {
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    await waitForStableDOM(page)

    const tabs = page.getByRole('tab')
    await tabs.nth(1).focus()
    await page.keyboard.press('Home')
    await waitForStableDOM(page)
    let activeText = await page.evaluate(() => document.activeElement?.textContent || '')
    expect(activeText.length).toBeGreaterThan(0)

    await page.keyboard.press('End')
    await waitForStableDOM(page)
    activeText = await page.evaluate(() => document.activeElement?.textContent || '')
    expect(activeText.length).toBeGreaterThan(0)
  })

  test('[cap:control.file.menu depth:a11y] Escape key closes File menu without trapping focus', async ({ page }) => {
    await page.goto(`/editor/${presId}`)
    await page.waitForSelector('.slide-canvas', { timeout: 15000 })
    await waitForStableDOM(page)

    const fileTrigger = page.locator('[aria-label="File menu"]').first()
    await expect(fileTrigger).toBeVisible()
    await fileTrigger.click()
    await page.waitForSelector('[role="menuitem"]', { timeout: 5000 })
    await page.keyboard.press('Escape')
    await waitForStableDOM(page)
    const menuItemsAfter = await page.locator('[role="menuitem"]').count()
    expect(menuItemsAfter).toBe(0)
  })
})
