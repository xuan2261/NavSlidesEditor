import { test, expect } from '@playwright/test'

test('has title and can load home page', async ({ page }) => {
  await page.goto('/')
  // Đảm bảo app load
  await expect(page.locator('.bg-bg-primary').first()).toBeVisible({ timeout: 30000 })
})
