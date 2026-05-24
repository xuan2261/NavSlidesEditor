import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
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

  test('covers align/distribute, group/ungroup, layer, lock, shadow, and rotation controls', async ({
    page,
    request,
  }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [seededSlide([shape('a', 100, 100, 100, 80, 1), shape('b', 260, 180, 100, 80, 2), shape('c', 460, 160, 100, 80, 3)])],
    })
    await editor.gotoPresentation(presId)

    await selectElements(page, ['a', 'b'])
    await page.locator('button[title="Align left"]').click()
    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides[0].elements.filter((el) => ['a', 'b'].includes(el.id)).map((el) => el.x)
      })
      .toEqual([100, 100])

    await selectElements(page, ['a', 'b', 'c'])
    await page.locator('button[title="Distribute H"]').click()
    await page.locator('button[title="Group elements"]').click()
    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return new Set(saved.slides[0].elements.map((el) => el.groupId).filter(Boolean)).size
      })
      .toBe(1)

    await page.locator('button[title="Ungroup elements"]').click()
    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides[0].elements.every((el) => !el.groupId)
      })
      .toBe(true)

    await page.getByTestId('slide-element-a').click()
    const panel = page.locator('.properties-panel')
    await panel.locator('input[title="Rotation angle in degrees"]').fill('45')
    await panel.locator('label').filter({ hasText: 'Lock element' }).locator('input').check()
    await expect(page.getByTestId('resize-handle-se')).toHaveCount(0)
    await panel.locator('label').filter({ hasText: 'Lock element' }).locator('input').uncheck()
    await expect(page.getByTestId('resize-handle-se')).toBeVisible()

    const numberInputs = panel.locator('input[type="number"]')
    await numberInputs.nth(5).fill('6')
    await numberInputs.nth(6).fill('8')
    await numberInputs.nth(7).fill('12')
    await panel.getByRole('button', { name: /Forward/ }).click()

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides[0].elements.find((el) => el.id === 'a')
      })
      .toMatchObject({ rotation: 45, shadowX: 6, shadowY: 8, shadowBlur: 12, zIndex: 2 })
  })

})
