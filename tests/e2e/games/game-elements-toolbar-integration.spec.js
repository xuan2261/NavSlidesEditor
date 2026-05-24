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

test.describe('Game Element — Toolbar Integration', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Game Toolbar E2E Test')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('Insert menu shows all 7 game types', async ({ page }) => {
    await page.getByRole('tab', { name: 'Insert' }).click()
    const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })
    await expect(insertPanel).toBeVisible({ timeout: 5000 })
    await insertPanel.getByRole('button', { name: 'More advanced insert options' }).click()
    await page.getByRole('menuitem', { name: 'Games...' }).click()
    await expect(page.getByText('Games')).toBeVisible({ timeout: 3000 })
    await expect(page.getByRole('button', { name: 'Name Picker' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hot Potato' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Jeopardy' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Four Corners' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Relay Race' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Trivia' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Scattergories' })).toBeVisible()
  })
})

// ─── Player Join Page ──────────────────────────────────────────────────────────
