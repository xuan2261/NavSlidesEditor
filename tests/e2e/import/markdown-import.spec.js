import path from 'node:path'
import { test, expect, apiDeletePresentation } from '../fixtures/test-fixtures.js'

async function importSampleMarkdown(page) {
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByTestId('home-import-markdown-btn').click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(path.resolve('tests/e2e/fixtures/sample.md'))
  await page.waitForURL(/\/editor\/[^/]+$/)
  return page.url().split('/').pop()
}

test.describe('Markdown import', () => {
  test('[cap:import.markdown] uploading sample.md creates three slides', async ({ page, request }) => {
    await page.goto('/')
    const presentationId = await importSampleMarkdown(page)
    try {
      await expect(page.getByTestId('slide-panel-item')).toHaveCount(3)
    } finally {
      await apiDeletePresentation(request, presentationId)
    }
  })

  test('imported slides include heading text', async ({ page, request }) => {
    await page.goto('/')
    const presentationId = await importSampleMarkdown(page)
    try {
      await expect(page.locator('[data-element-type="text"]').first()).toContainText('Slide One')
    } finally {
      await apiDeletePresentation(request, presentationId)
    }
  })
})
