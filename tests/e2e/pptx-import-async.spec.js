import path from 'node:path'
import { apiDeletePresentation, expect, test } from './fixtures/test-fixtures.js'

test.describe('Async PPTX import', () => {
  test('uploads a PPTX, shows progress, and opens the imported presentation', async ({ page, request }) => {
    test.setTimeout(150000)
    await page.goto('/')

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByTestId('home-import-pptx-btn').click()
    const chooser = await chooserPromise
    await chooser.setFiles(path.resolve('PPTX', 'Bai_2_2.pptx'))

    await expect(page.getByRole('status')).toContainText(/PPTX|slide|Import|Processing/i, { timeout: 15000 })
    await page.waitForURL(/\/editor\/[^/]+$/, { timeout: 120000 })
    const presentationId = page.url().split('/').pop()

    try {
      await expect(page.getByTestId('slide-panel-item').first()).toBeVisible({ timeout: 15000 })
    } finally {
      await apiDeletePresentation(request, presentationId)
    }
  })
})
