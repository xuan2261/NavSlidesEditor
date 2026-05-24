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

async function openInsert(page) {
  await page.getByRole('tab', { name: 'Insert' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Insert' })).toBeVisible()
}

async function getInsertItem(page, label) {
  await openInsert(page)
  const aliases = {
    'Image (URL)': 'Add image',
    Video: 'Add video',
    Audio: 'Audio / Upload',
    'Audio / Upload': 'Audio / Upload',
    'QR Code': 'Add QR code',
    Icon: 'Add icon',
    'Drawing Canvas': 'Add drawing',
    SVG: 'Add SVG',
  }
  const panel = page.getByRole('tabpanel', { name: 'Insert' })
  const target = aliases[label] || label
  return panel.getByRole('button', { name: target, exact: true })
}

async function insertItem(page, label) {
  const previousCount = await page.locator('.element-wrapper').count()
  await (await getInsertItem(page, label)).click()
  await expect(page.locator('.element-wrapper')).toHaveCount(previousCount + 1, { timeout: 10000 })
}

async function selectedCanvasElementIds(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-element-id]'))
      .filter((el) => el.style.outline && el.style.outline !== 'none')
      .map((el) => el.getAttribute('data-element-id'))
      .sort()
  )
}

async function selectElements(page, ids) {
  const expected = []
  await page.keyboard.press('Escape')
  await expect.poll(() => selectedCanvasElementIds(page)).toEqual([])

  await page.getByTestId(`slide-element-${ids[0]}`).click({ force: true })
  expected.push(ids[0])
  await expect.poll(() => selectedCanvasElementIds(page)).toEqual([...expected].sort())

  for (const id of ids.slice(1)) {
    await page.keyboard.down('Shift')
    await page.getByTestId(`slide-element-${id}`).click({ force: true })
    await page.keyboard.up('Shift')
    expected.push(id)
    await expect.poll(() => selectedCanvasElementIds(page)).toEqual([...expected].sort())
  }

  await expect(page.locator('.tour-step-ribbon')).toContainText('Arrange', { timeout: 5000 })
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
    await expect(page.locator('.slide-canvas')).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()

    const screenshot = await page.screenshot()
    expect(screenshot.length).toBeGreaterThan(10_000)

    const exportRes = await request.get(`/api/presentations/${presId}/present`)
    expect(exportRes.ok()).toBeTruthy()
    expect(await exportRes.text()).toContain('Results')
  })
})
