import { test, expect, apiGetPresentation } from './fixtures/test-fixtures.js'
import { EditorPage } from './pages/editor-page.js'

// 1x1 transparent GIF — what the mocked giphy CDN returns for previews + download.
const TINY_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)
const UPLOADED_URL = '/uploads/e2e-giphy.gif'

test.describe('Media library Giphy search and insert', () => {
  test('searches Giphy, inserts a result, and the image persists on the slide', async ({
    page,
    testPresentation,
    request,
  }) => {
    // Keep the giphy CDN off the network (grid preview <img> + the downloadUrl fetch).
    await page.route('https://media.giphy.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/gif', body: TINY_GIF })
    )
    // Remote media is downloaded then re-uploaded to the local server before insert.
    await page.route('**/api/upload', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: UPLOADED_URL, filename: 'e2e-giphy.gif' }),
      })
    )

    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)
    await editor.openMediaLibrary()

    // With no GIPHY key configured the service returns mock results — no real search.
    await page.getByRole('button', { name: /giphy/i }).click()
    const firstResult = page.getByTestId('media-library-item').first()
    await expect(firstResult).toBeVisible({ timeout: 5000 })
    await firstResult.click()

    // The modal closes once the result is downloaded, re-uploaded and inserted.
    await expect(page.getByRole('dialog', { name: 'Media Library' })).toHaveCount(0)

    // The inserted image element persists on the active slide.
    await expect
      .poll(
        async () => {
          const saved = await apiGetPresentation(request, testPresentation.id)
          const els = saved.slides[0].elements || []
          return els.some((e) => e.type === 'image' && e.src === UPLOADED_URL)
        },
        { timeout: 8000 }
      )
      .toBe(true)
  })
})
