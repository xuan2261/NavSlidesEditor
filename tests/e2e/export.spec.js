import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js'

test.describe('Export & Present', () => {
  let presId
  let editorPage

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Export Test')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('export HTML endpoint returns valid HTML', async ({ request }) => {
    const res = await request.get(`http://localhost:5173/api/presentations/${presId}/export`)
    expect(res.ok()).toBeTruthy()
    const contentType = res.headers()['content-type']
    expect(contentType).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('reveal')
  })

  test('present endpoint returns reveal.js HTML', async ({ request }) => {
    const res = await request.get(`http://localhost:5173/api/presentations/${presId}/present`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('Reveal')
    expect(html).toContain('<section')
  })

  test('present mode renders reveal.js slides in browser', async ({ page }) => {
    // Navigate to present endpoint
    await page.goto(`http://localhost:5173/api/presentations/${presId}/present`, { timeout: 15000 })
    await page.waitForSelector('.reveal', { timeout: 10000 })
    await expect(page.locator('.reveal')).toBeVisible()
  })
})
