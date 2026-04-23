import { test, expect } from '@playwright/test'
import { SettingsPage } from './pages/SettingsPage.js'

test.describe('Settings Page', () => {
  test('can navigate to Settings and see AI Configuration', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.goto()

    await expect(page.locator('h2:has-text("AI Configuration")')).toBeVisible()
    await expect(page.locator('h2:has-text("Default Preferences")')).toBeVisible()
  })

  test('can change AI provider', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.goto()

    const providerSelect = page.locator('select').first()
    await providerSelect.selectOption('gemini')
    await expect(providerSelect).toHaveValue('gemini')
  })

  test('can save settings successfully', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.goto()

    await settings.saveBtn.click()
    await expect(page.locator('text=Settings saved!')).toBeVisible({ timeout: 5000 })
  })

  test('can change default theme and transition', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.goto()

    // Use label-based selectors for reliability
    // Default Theme select is inside section with "Default Preferences" heading
    const prefsSection = page
      .locator('section')
      .filter({ has: page.locator('h2:has-text("Default Preferences")') })
    await expect(prefsSection).toBeVisible()

    const themeSelect = prefsSection.locator('select').first()
    const transitionSelect = prefsSection.locator('select').last()

    await themeSelect.selectOption('dracula')
    await transitionSelect.selectOption('zoom')

    // Save
    await settings.saveBtn.click()
    await expect(page.locator('text=Settings saved!')).toBeVisible({ timeout: 5000 })
  })

  test('can navigate back to home', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.goto()
    await settings.goBack()

    await expect(page.locator('.bg-panel').first()).toBeVisible()
  })

  test('test connection button is present', async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.goto()

    await expect(page.locator('button:has-text("Test Connection")')).toBeVisible()
  })
})
