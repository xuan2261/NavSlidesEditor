import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

function shape(id, x, y, width = 100, height = 80, zIndex = 1) {
  return {
    id,
    type: 'shape',
    shape: 'rect',
    x,
    y,
    width,
    height,
    zIndex,
    fill: '#6366f1',
  }
}

function seededSlide(elements = []) {
  return {
    id: 'slide-1',
    elements,
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  }
}

test.describe('Coverage Gaps: Editor controls and UI contracts', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Coverage Gaps')
    presId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    await apiDeletePresentation(request, presId)
  })

  test('covers footer settings, feature modals, responsive layout, keyboard accessibility, and visual smoke', async ({
    page,
    request,
  }) => {
    await apiUpdatePresentation(request, presId, {
      showFooter: true,
      showPageNumbers: true,
      footerMode: 'sequence',
      sequenceSections: ['Intro', 'Results'],
      slides: [seededSlide([shape('a', 120, 120)])],
    })
    await editor.gotoPresentation(presId)

    await expect(page.getByText('Slide Footer')).toBeVisible()
    await expect(page.locator('.slide-canvas')).toContainText('Intro')
    await expect(page.locator('.slide-canvas')).toContainText('1 / 1')

    await editor.openFileMenuItem('Sync to Cloud')
    await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Sync to Cloud' })).toHaveCount(0)

    await editor.openFileMenuItem('Save to GitHub')
    await expect(page.getByText('Push to GitHub')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('tab', { name: 'View' }).click()
    await page.getByRole('button', { name: 'Custom CSS' }).click()
    await expect(page.getByText('Custom CSS')).toBeVisible()
    await page.keyboard.press('Escape')

    await editor.menubar.openAnalytics()
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
    await page.keyboard.press('Escape')

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByText('Tablet or desktop required')).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()

    const screenshot = await page.screenshot()
    expect(screenshot.length).toBeGreaterThan(10_000)

    const exportRes = await request.get(`/api/presentations/${presId}/present`)
    expect(exportRes.ok()).toBeTruthy()
    expect(await exportRes.text()).toContain('Results')
  })
})
