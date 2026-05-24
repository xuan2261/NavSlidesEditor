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

const GAME_TYPES = [
  { label: 'Name Picker' },
  { label: 'Hot Potato Quiz' },
  { label: 'Jeopardy' },
  { label: 'Four Corners' },
  { label: 'Relay Race' },
  { label: 'Trivia Championship' },
  { label: 'Scattergories' },
]

// ─── Game Element Insertion ────────────────────────────────────────────────────

test.describe('Game Element — Stability & Coexistence', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Game Stability E2E Test')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('no runtime errors when inserting and rendering game elements', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))

    for (const game of GAME_TYPES) {
      const prevCount = await editorPage.getElementCount()
      await editorPage.clickInsertMenuItem(game.label)
      await editorPage.waitForElementCount(prevCount + 1)
    }

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Warning') &&
        !e.includes('DevTools') &&
        !e.includes('React') &&
        !e.includes('socket') &&
        !e.includes('net::') &&
        !e.includes('Failed to load resource')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('game elements coexist with text elements on same slide', async ({ page }) => {
    await editorPage.addTextNode()
    await page.keyboard.type('My Presentation')
    await page.keyboard.press('Escape')
    const prevCount = await editorPage.getElementCount()
    expect(prevCount).toBeGreaterThanOrEqual(1)
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(prevCount + 1)
    const count = await editorPage.getElementCount()
    expect(count).toBeGreaterThanOrEqual(2)
    await expect(page.getByText(/Name Picker/).first()).toBeVisible({ timeout: 5000 })
  })

  test('game elements coexist with shape elements', async () => {
    const initialCount = await editorPage.getElementCount()
    await editorPage.addShape('Rectangle')
    await editorPage.waitForElementCount(initialCount + 1)
    const shapeCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Hot Potato Quiz')
    await editorPage.waitForElementCount(shapeCount + 1)
    const count = await editorPage.getElementCount()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
