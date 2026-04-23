import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js'

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

  test('can use AI Copywriter with mocked API response', async ({ page }) => {
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

    await expect(page.locator('h3:has-text("AI Copywriter")')).toBeHidden()

    const wrapper = page.locator('.element-wrapper').last()
    const textContent = await wrapper.innerText()
    expect(textContent).toContain('MOCKED_AI_GENERATED_CONTENT')
  })

  test('can use AI Slide Generator modal', async ({ page }) => {
    await page.click('button.menu-trigger:has-text("AI")')
    await page.locator('.dropdown-item').filter({ hasText: 'AI Slide Generator' }).click()
    await expect(page.locator('h3:has-text("AI Slide Generator")')).toBeVisible()
    await page.locator('button:has(svg.lucide-x)').click()
    await expect(page.locator('h3:has-text("AI Slide Generator")')).toBeHidden()
  })

  test('can use Translate Presentation modal', async ({ page }) => {
    await page.click('button.menu-trigger:has-text("AI")')
    await page.locator('.dropdown-item').filter({ hasText: 'Translate' }).click()
    await expect(page.locator('h3:has-text("Translate Presentation")')).toBeVisible()
    await page.locator('button:has(svg.lucide-x)').click()
    await expect(page.locator('h3:has-text("Translate Presentation")')).toBeHidden()
  })
})
