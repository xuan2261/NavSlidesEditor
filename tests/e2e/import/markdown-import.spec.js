import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect, apiDeletePresentation, apiGetPresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'

async function importSampleMarkdown(page) {
  await page.evaluate(() => {
    window.__E2E__ = true
    window.localStorage.setItem('navSlidesTutorialSeen', 'true')
  })
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

  test('[cap:import.markdown depth:persistence] [cap:export.html depth:export] imported markdown can be edited and exported', async ({
    page,
    request,
  }) => {
    const marker = `Slide edited marker ${Date.now()}`
    await page.goto('/')
    const presentationId = await importSampleMarkdown(page)

    try {
      const editor = new EditorPage(page)
      await editor.waitForReady()
      await editor.startEditingTextElement(0)
      await editor.selectAllText()
      await editor.typeInTextEditor(marker)
      await page.keyboard.press('Escape')

      await expect
        .poll(async () => {
          const saved = await apiGetPresentation(request, presentationId)
          return saved.slides[0].elements.some((el) => el.type === 'text' && el.content.includes(marker))
        }, { timeout: 10000 })
        .toBe(true)

      await page.reload()
      await editor.waitForReady()
      await expect(page.locator('[data-element-type="text"]').first()).toContainText(marker)

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
      await editor.menubar.openFileMenuItem('Export HTML')
      const download = await downloadPromise
      const downloadPath = await download.path()
      expect(downloadPath).toBeTruthy()
      const html = await fs.readFile(downloadPath, 'utf8')
      expect(html).toContain(marker)
      expect(html).toContain('<section')
    } finally {
      await apiDeletePresentation(request, presentationId)
    }
  })
})
