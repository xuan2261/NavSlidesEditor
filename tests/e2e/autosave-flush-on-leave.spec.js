import { test, expect } from './fixtures/test-fixtures.js'
import { apiGetPresentation } from './fixtures/test-fixtures.js'
import { EditorPage } from './pages/editor-page.js'
import { seedElements, selectElement, textElement } from './pages/canvas-actions-helper.js'

// Regression net for the autosave flush-on-leave fix (flushPendingSaveNow +
// beforeunload/keepalive). jsdom cannot exercise beforeunload + keepalive, so we
// assert the LANDED server state after navigating away — never the keepalive
// request itself (unreliable to intercept in Playwright, per Stream B note).
test.describe('autosave flush on leave', () => {
  test('an edit made before the debounce window lands after navigating away', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [textElement('text-a', 100, 100)])
    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)

    // Move the element via the properties panel (a real edit that queues a save)
    await selectElement(page, 'text-a')
    const xInput = page.getByTestId('prop-x')
    await xInput.fill('321')
    await xInput.blur()

    // Navigate away to the dashboard BEFORE waiting for the debounce to settle.
    await page.goto('/')
    await expect(page).toHaveURL(/\/$|\/#?$/)

    // The flush-on-leave path must have persisted x=321 server-side.
    await expect
      .poll(
        async () => {
          const saved = await apiGetPresentation(request, testPresentation.id)
          return saved.slides?.[0]?.elements?.[0]?.x
        },
        { timeout: 10000 }
      )
      .toBe(321)
  })
})
