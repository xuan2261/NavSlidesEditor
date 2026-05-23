import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

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

  test('I-003: Ctrl+K opens the command palette in editor', async ({ page, request }) => {
    // Create a minimal presentation via API and navigate directly to its editor.
    // Avoids dependence on the dashboard "New Presentation" modal flow.
    const createRes = await request.post('/api/presentations', {
      data: { title: 'I-003 test', slides: [{ id: 'slide-1', elements: [] }] },
    })
    expect(createRes.ok()).toBeTruthy()
    const presentation = await createRes.json()

    await page.goto(`/editor/${presentation.id}`)
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
