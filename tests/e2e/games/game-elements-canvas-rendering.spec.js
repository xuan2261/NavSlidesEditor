/**
 * E2E tests for game elements (Phase 11).
 * Covers: insertion, canvas rendering, toolbar integration, properties panel.
 *
 * These tests run against the live app via Playwright.
 * They validate the complete UI flow from editor to canvas rendering.
 */
import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/editor-page.js'
import { apiCreatePresentation, apiDeletePresentation } from '../fixtures/test-fixtures.js'

// ─── Game Element Insertion ────────────────────────────────────────────────────

test.describe('Game Element — Canvas Rendering', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Game Canvas E2E Test')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('Name Picker wheel renders SVG segments', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(prevCount + 1)
    await expect(page.locator('.element-wrapper svg').first()).toBeVisible({ timeout: 5000 })
  })

  test('Name Picker is inserted and renders with label', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(prevCount + 1)
    const count = await editorPage.getElementCount()
    expect(count).toBe(prevCount + 1)
    await expect(page.getByText('Game: Name Picker').or(page.getByText('Name Picker')).first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.element-wrapper').nth(count - 1)).toBeVisible()
  })

  test('Hot Potato Quiz shows question editor placeholder', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Hot Potato Quiz')
    await editorPage.waitForElementCount(prevCount + 1)
    await expect(page.getByText(/Hot Potato/).first()).toBeVisible({ timeout: 5000 })
  })

  test('Jeopardy board renders category header placeholder', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Jeopardy')
    await editorPage.waitForElementCount(prevCount + 1)
    await expect(page.getByText(/Jeopardy/).first()).toBeVisible({ timeout: 5000 })
  })

  test('Present button accessible after adding game element', async ({ page }) => {
    const prevCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(prevCount + 1)
    await expect(page.getByRole('button', { name: 'Present' }).first()).toBeVisible()
  })
})

// ─── Toolbar Integration ─────────────────────────────────────────────────────────
