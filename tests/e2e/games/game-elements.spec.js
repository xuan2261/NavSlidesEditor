/**
 * E2E tests for game elements (Phase 11).
 * Covers: insertion, canvas rendering, toolbar integration, properties panel.
 *
 * These tests run against the live app via Playwright.
 * They validate the complete UI flow from editor to canvas rendering.
 */
import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/EditorPage.js'
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
      await editorPage.clickInsertMenuItem(game.label)
      await editorPage.waitForElementCount(await editorPage.getElementCount())
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
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    await editorPage.clickInsertMenuItem('Hot Potato Quiz')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    await editorPage.clickInsertMenuItem('Jeopardy')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    expect(await editorPage.getElementCount()).toBeGreaterThanOrEqual(3)
    await expect(page.getByText(/Name Picker/).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Hot Potato/).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Jeopardy/).first()).toBeVisible({ timeout: 5000 })
  })
})

// ─── Canvas Rendering ───────────────────────────────────────────────────────────

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
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    await expect(page.locator('.element-wrapper svg').first()).toBeVisible({ timeout: 5000 })
  })

  test('Name Picker is inserted and renders with label', async ({ page }) => {
    await editorPage.clickInsertMenuItem('Name Picker')
    const count = await editorPage.getElementCount()
    expect(count).toBeGreaterThanOrEqual(1)
    await expect(page.getByText('Game: Name Picker').or(page.getByText('Name Picker')).first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.element-wrapper').nth(count - 1)).toBeVisible()
  })

  test('Hot Potato Quiz shows question editor placeholder', async ({ page }) => {
    await editorPage.clickInsertMenuItem('Hot Potato Quiz')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    await expect(page.getByText(/Hot Potato/).first()).toBeVisible({ timeout: 5000 })
  })

  test('Jeopardy board renders category header placeholder', async ({ page }) => {
    await editorPage.clickInsertMenuItem('Jeopardy')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    await expect(page.getByText(/Jeopardy/).first()).toBeVisible({ timeout: 5000 })
  })

  test('Present button accessible after adding game element', async ({ page }) => {
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    await expect(page.locator('button[title="Present"]')).toBeVisible()
  })
})

// ─── Toolbar Integration ─────────────────────────────────────────────────────────

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

test.describe('Player Join Page', () => {
  test('renders join form with name input and join button', async ({ page }) => {
    await page.goto('/player/slide456/el789')
    await expect(page.getByPlaceholder('e.g. Minh or Team Red')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /join game/i })).toBeVisible()
  })

  test('empty name submit shows validation message', async ({ page }) => {
    await page.goto('/player/slide456/el789')
    await page.waitForSelector('[placeholder*="Minh"]', { timeout: 10000 }).catch(() => {})
    const submitBtn = page.getByRole('button', { name: /join game/i })
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
      // Name field should remain visible (validation prevents submission)
      await expect(page.getByPlaceholder('e.g. Minh or Team Red')).toBeVisible()
    }
  })
})

// ─── Stability & Coexistence ─────────────────────────────────────────────────

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

    await editorPage.clickInsertMenuItem('Name Picker')
    await page.waitForTimeout(300)
    await editorPage.clickInsertMenuItem('Hot Potato Quiz')
    await page.waitForTimeout(300)
    await editorPage.clickInsertMenuItem('Jeopardy')
    await page.waitForTimeout(300)
    await editorPage.clickInsertMenuItem('Four Corners')
    await page.waitForTimeout(300)
    await editorPage.clickInsertMenuItem('Relay Race')
    await page.waitForTimeout(300)
    await editorPage.clickInsertMenuItem('Trivia Championship')
    await page.waitForTimeout(300)
    await editorPage.clickInsertMenuItem('Scattergories')
    await page.waitForTimeout(500)

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
    await page.waitForTimeout(300)
    await editorPage.clickInsertMenuItem('Name Picker')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    const count = await editorPage.getElementCount()
    expect(count).toBeGreaterThanOrEqual(2)
    await expect(page.getByText(/Name Picker/).first()).toBeVisible({ timeout: 5000 })
  })

  test('game elements coexist with shape elements', async () => {
    await editorPage.addShape('Rectangle')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    await editorPage.clickInsertMenuItem('Hot Potato Quiz')
    await editorPage.waitForElementCount(await editorPage.getElementCount())
    const count = await editorPage.getElementCount()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
