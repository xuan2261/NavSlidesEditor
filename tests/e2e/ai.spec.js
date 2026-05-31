import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import { apiCreatePresentation, apiDeletePresentation, apiGetPresentation, apiUpdatePresentation } from './fixtures/test-fixtures.js'

test.describe('AI Integrations', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'AI Test Presentation')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('[cap:ai.rewrite] can use AI Copywriter with mocked API response', async ({ page }) => {
    await page.route('**/api/ai/rewrite', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ result: 'MOCKED_AI_GENERATED_CONTENT' }),
      })
    })

    await editorPage.addSlide()
    await editorPage.addTextNode()
    await expect(page.locator('.element-wrapper').last()).toBeVisible()

    await editorPage.openAICopywriter()

    await page.locator('button', { hasText: '🎯 Custom' }).click()
    const customTextarea = page.locator('textarea[placeholder*="e.g. Make it more"]')
    await customTextarea.fill('Mock prompt')

    await page.locator('button', { hasText: 'Generate' }).click()

    await expect(
      page.locator('div', { hasText: 'MOCKED_AI_GENERATED_CONTENT' }).last()
    ).toBeVisible({ timeout: 5000 })
    await page.locator('button', { hasText: 'Apply' }).click()

    await expect(page.getByRole('dialog', { name: 'AI Copywriter' })).toHaveCount(0)

    const wrapper = page.locator('.element-wrapper').last()
    const textContent = await wrapper.innerText()
    expect(textContent).toContain('MOCKED_AI_GENERATED_CONTENT')
  })

  test('[cap:ai.generate] AI Slide Generator builds slides from a mocked outline and appends them', async ({
    page,
    request,
  }) => {
    await page.route('**/api/ai/generate-outline', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          outline: [
            { title: 'Intro', layout: 'title', bulletPoints: ['Welcome'] },
            { title: 'Body', layout: 'default', bulletPoints: ['Point A', 'Point B'] },
            { title: 'Wrap', layout: 'default', bulletPoints: ['Thanks'] },
          ],
        }),
      })
    })

    const before = await page.getByTestId('slide-panel-item').count()

    await editorPage.menubar.openAISlideGenerator()
    const dialog = page.getByRole('dialog', { name: 'AI Slide Generator' })
    await dialog.getByPlaceholder(/IoT Security/).fill('Anything — response is mocked')
    await dialog.getByRole('button', { name: 'Generate Outline' }).click()

    await expect(dialog.getByText('Generated Outline (3 slides)')).toBeVisible({ timeout: 5000 })
    await dialog.getByRole('button', { name: 'Create Presentation' }).click()

    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('slide-panel-item')).toHaveCount(before + 3)
    // Autosave is debounced, so poll the API until the appended slides persist.
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      return saved.slides.length
    }, { timeout: 8000 }).toBe(before + 3)
  })

  test('[cap:ai.translate] Translate Presentation translates every text element including the first', async ({
    page,
    request,
  }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        {
          id: 'slide-1',
          elements: [
            { id: 'tx-0', type: 'text', x: 50, y: 50, width: 400, height: 80, content: '<p>FIRST ORIGINAL</p>' },
            { id: 'tx-1', type: 'text', x: 50, y: 200, width: 400, height: 80, content: '<p>SECOND ORIGINAL</p>' },
          ],
          notes: '',
          background: { type: 'color', color: '#1e1e2e' },
        },
      ],
    })
    await editorPage.gotoPresentation(presId)

    await page.route('**/api/ai/translate', async (route) => {
      const body = route.request().postDataJSON()
      const translations = (body.texts || []).map((t) => ({ id: t.id, html: '<p>TRANSLATED</p>' }))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ translations }),
      })
    })

    await editorPage.menubar.openAITranslate()
    const dialog = page.getByRole('dialog', { name: 'Translate Presentation' })
    await dialog.getByRole('button', { name: 'Translate All' }).click()
    await expect(dialog).toHaveCount(0)

    // Both text elements must be translated — the first element (index 0) is the
    // regression guard: a falsy-zero key bug used to leave element 0 untranslated.
    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, presId)
      const [c0, c1] = saved.slides[0].elements.map((e) => e.content)
      return /TRANSLATED/.test(c0) && /TRANSLATED/.test(c1)
    }, { timeout: 8000 }).toBe(true)
  })
})
