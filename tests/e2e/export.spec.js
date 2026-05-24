import { EditorPage } from './pages/editor-page.js'
import { test, expect } from './fixtures/test-fixtures.js'

test.describe('Export & Present', () => {
  let editorPage
  let presentationId

  test.beforeEach(async ({ page, testPresentation }) => {
    presentationId = testPresentation.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presentationId)
  })

  test('export HTML endpoint returns valid HTML', async ({ request }) => {
    const res = await request.get(`/api/presentations/${presentationId}/export`)
    expect(res.ok()).toBeTruthy()
    const contentType = res.headers()['content-type']
    expect(contentType).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('reveal')
  })

  test('present endpoint returns reveal.js HTML', async ({ request }) => {
    const res = await request.get(`/api/presentations/${presentationId}/present`)
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('Reveal')
    expect(html).toContain('<section')
  })

  test('present mode renders reveal.js slides in browser', async ({ page }) => {
    // Navigate to present endpoint
    await page.goto(`/api/presentations/${presentationId}/present`, { timeout: 15000 })
    await page.waitForSelector('.reveal', { timeout: 10000 })
    await expect(page.locator('.reveal')).toBeVisible()
  })
})
