/**
 * E2E tests for game elements (Phase 11).
 * Covers: insertion, canvas rendering, toolbar integration, properties panel.
 *
 * These tests run against the live app via Playwright.
 * They validate the complete UI flow from editor to canvas rendering.
 */
import { test, expect } from '@playwright/test'

// ─── Game Element Insertion ────────────────────────────────────────────────────

test.describe('Player Join Page', () => {
  test('renders join form with name input and join button', async ({ page }) => {
    await page.goto('/player/slide456/el789')
    await expect(page.getByPlaceholder('e.g. Minh or Team Red')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /join game/i })).toBeVisible()
  })

  test('empty name submit shows validation message', async ({ page }) => {
    await page.goto('/player/slide456/el789')
    await expect(page.getByPlaceholder('e.g. Minh or Team Red')).toBeVisible({ timeout: 10000 })
    const submitBtn = page.getByRole('button', { name: /join game/i })
    await submitBtn.focus()
    await page.keyboard.press('Enter')
    // Name field should remain visible (validation prevents submission)
    await expect(page.getByPlaceholder('e.g. Minh or Team Red')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(/please enter your name/i)
    await expect(page.getByPlaceholder('e.g. Minh or Team Red')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
  })
})

// ─── Stability & Coexistence ─────────────────────────────────────────────────
