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

test.describe('Game Elements — Insert & Render', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Game Elements E2E Test')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  for (const game of GAME_TYPES) {
    test(`inserts ${game.label} via Insert menu`, async () => {
      const prevCount = await editorPage.getElementCount()
      await editorPage.clickInsertMenuItem(game.label)
      await editorPage.waitForElementCount(prevCount + 1)
      expect(await editorPage.getElementCount()).toBe(prevCount + 1)
    })

    test(`renders ${game.label} with Game: label on canvas`, async ({ page }) => {
      const prevCount = await editorPage.getElementCount()
      await editorPage.clickInsertMenuItem(game.label)
      await editorPage.waitForElementCount(prevCount + 1)
      await expect(page.getByText(/Game:/).first()).toBeVisible({ timeout: 5000 })
    })
  }

  test('game element increments canvas element count', async () => {
    const initialCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(initialCount + 1)
    expect(await editorPage.getElementCount()).toBe(initialCount + 1)
    await editorPage.clickInsertMenuItem('Hot Potato Quiz')
    await editorPage.waitForElementCount(initialCount + 2)
    expect(await editorPage.getElementCount()).toBe(initialCount + 2)
  })

  test('multiple game elements coexist on same slide', async ({ page }) => {
    const initialCount = await editorPage.getElementCount()
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(initialCount + 1)
    await editorPage.clickInsertMenuItem('Hot Potato Quiz')
    await editorPage.waitForElementCount(initialCount + 2)
    await editorPage.clickInsertMenuItem('Jeopardy')
    await editorPage.waitForElementCount(initialCount + 3)
    expect(await editorPage.getElementCount()).toBe(initialCount + 3)
    await expect(page.getByText(/Name Picker/).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Hot Potato/).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Jeopardy/).first()).toBeVisible({ timeout: 5000 })
  })
})

// ─── Canvas Rendering ───────────────────────────────────────────────────────────
