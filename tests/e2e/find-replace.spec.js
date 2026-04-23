import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

test.describe('Find & Replace', () => {
  let presId
  let editorPage

  test.beforeEach(async ({ page, request }) => {
    // Create presentation with searchable text content
    const pres = await apiCreatePresentation(request, 'Find Replace Test')
    presId = pres.id

    // Add text elements with known content
    await apiUpdatePresentation(request, presId, {
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'el-1',
              type: 'text',
              x: 80,
              y: 100,
              width: 400,
              height: 100,
              zIndex: 1,
              content: '<p>Hello World</p>',
            },
            {
              id: 'el-2',
              type: 'text',
              x: 80,
              y: 250,
              width: 400,
              height: 100,
              zIndex: 2,
              content: '<p>Hello Universe</p>',
            },
          ],
          notes: '',
          background: { type: 'color', color: '#1e1e2e' },
        },
      ],
    })

    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('can open Find bar with Ctrl+F', async ({ page }) => {
    await editorPage.openFindReplace()
    await expect(page.locator('.find-replace-bar')).toBeVisible()
  })

  // eslint-disable-next-line unused-imports/no-unused-vars
  test('can search text and show match count', async ({ page }) => {
    await editorPage.findText('Hello')
    const count = await editorPage.getMatchCount()
    expect(count).toBe(2)
  })

  test('can navigate between matches', async ({ page }) => {
    await editorPage.findText('Hello')

    // Click Next
    await page.locator('.find-btn[title="Next"]').click()
    const countLabel = await page.locator('.find-count').textContent()
    expect(countLabel).toContain('/2')
  })

  test('can close Find bar with Escape', async ({ page }) => {
    await editorPage.openFindReplace()
    await expect(page.locator('.find-replace-bar')).toBeVisible()
    await editorPage.closeFindReplace()
  })

  test('case-sensitive toggle works', async ({ page }) => {
    await editorPage.findText('hello') // lowercase
    const countLower = await editorPage.getMatchCount()

    // Toggle case-sensitive
    await page.locator('.find-btn[title="Match case"]').click()
    await expect.poll(async () => editorPage.getMatchCount(), { timeout: 5000 }).toBe(0)
    const countSensitive = await editorPage.getMatchCount()

    // "Hello" should not match "hello" in case-sensitive mode
    expect(countSensitive).toBeLessThanOrEqual(countLower)
  })

  test('replace all supports an empty replacement string', async ({ request }) => {
    await editorPage.replaceText('Hello', '')
    await editorPage.replaceAll()

    await expect.poll(async () => editorPage.getMatchCount(), { timeout: 5000 }).toBe(0)
    await editorPage.waitForAutoSave()

    await expect
      .poll(async () => {
        const presentation = await apiGetPresentation(request, presId)
        return presentation.slides[0].elements.every((element) => !element.content?.includes('Hello'))
      })
      .toBe(true)
  })

  test('single replace updates only the current match inside one element', async ({ page, request }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        {
          id: 'slide-1',
          elements: [
            {
              id: 'el-1',
              type: 'text',
              x: 80,
              y: 100,
              width: 400,
              height: 100,
              zIndex: 1,
              content: '<p>Hello Hello</p>',
            },
          ],
          notes: '',
          background: { type: 'color', color: '#1e1e2e' },
        },
      ],
    })

    await editorPage.gotoPresentation(presId)
    await editorPage.replaceText('Hello', 'Hi')
    await page.getByRole('button', { name: 'Replace', exact: true }).click()
    await editorPage.waitForAutoSave()

    await expect
      .poll(async () => {
        const presentation = await apiGetPresentation(request, presId)
        return presentation.slides[0].elements[0].content
      })
      .toBe('<p>Hi Hello</p>')
  })
})
