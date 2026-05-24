import fs from 'fs'
import path from 'path'
import { test, expect } from './fixtures/test-fixtures.js'

const pkg = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
)

test.describe('Regression — smoke test fixes', () => {
  test('I-001: Trash entry is visible in dashboard sidebar', async ({ page }) => {
    await page.goto('/')
    const trashBtn = page.getByRole('button', { name: /trash/i })
    await expect(trashBtn).toBeVisible()
    await expect(trashBtn).toBeInViewport()
  })

  test('I-001 small viewport: Trash entry still visible at 1280×480', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 480 })
    await page.goto('/')
    const trashBtn = page.getByRole('button', { name: /trash/i })
    await expect(trashBtn).toBeVisible()
    await expect(trashBtn).toBeInViewport()
  })

  test('I-003: Ctrl+K opens the command palette in editor', async ({
    page,
    testPresentation,
  }) => {
    await page.goto(`/editor/${testPresentation.id}`)
    // Click the canvas area to ensure no TipTap input is focused.
    await page.locator('body').click()
    await page.keyboard.press('Control+K')
    await expect(page.getByPlaceholder('Type a command...')).toBeVisible({
      timeout: 2000,
    })
  })

  test('I-004: Footer version matches package.json', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('footer')
    await expect(footer).toContainText(`v${pkg.version}`)
  })
})
