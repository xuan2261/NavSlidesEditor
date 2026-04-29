import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
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
  const menu = page.locator('.insert-dropdown')
  if (!(await menu.isVisible().catch(() => false))) {
    await page.click('button.insert-trigger:has-text("Insert")')
    await expect(menu).toBeVisible()
  }
}

async function getInsertItem(page, label) {
  await openInsert(page)
  const item = page.locator('.insert-dropdown .insert-item').filter({ hasText: label }).first()
  await item.scrollIntoViewIfNeeded()
  return item
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

  await expect(page.locator('.tour-step-toolbar')).toContainText('Align:', { timeout: 5000 })
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

  test('covers extended insert menu elements: image, video, audio, QR, icon, drawing, SVG', async ({
    page,
    request,
  }) => {
    await editor.gotoPresentation(presId)

    await (await getInsertItem(page, 'Image (URL)')).click()
    await page.locator('input[placeholder="https://..."]').fill('https://example.com/image.png')
    await page.getByRole('button', { name: 'OK' }).click()
    await expect(page.locator('.element-wrapper')).toHaveCount(2)

    await (await getInsertItem(page, 'Video')).click()
    await page.locator('input[placeholder="https://..."]').fill('https://example.com/video.mp4')
    await page.getByRole('button', { name: 'OK' }).click()
    await expect(page.locator('.element-wrapper')).toHaveCount(3)

    await insertItem(page, 'QR Code')
    await insertItem(page, 'Drawing Canvas')

    await (await getInsertItem(page, 'Icon')).click()
    await page.getByPlaceholder('Search icons...').fill('Star')
    await page.locator('button[title="Star"]').first().click()
    await expect(page.locator('.element-wrapper')).toHaveCount(6)

    const svgChooser = page.waitForEvent('filechooser')
    await (await getInsertItem(page, 'SVG')).click()
    await (await svgChooser).setFiles({
      name: 'diagram.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
    })
    await expect(page.locator('.element-wrapper')).toHaveCount(7)

    const audioChooser = page.waitForEvent('filechooser')
    await (await getInsertItem(page, 'Audio / Upload')).click()
    await (await audioChooser).setFiles({
      name: 'sample.mp3',
      mimeType: 'audio/mpeg',
      buffer: Buffer.from('fake audio bytes'),
    })
    await expect(page.locator('.element-wrapper')).toHaveCount(8, { timeout: 10000 })

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides[0].elements.map((el) => el.type).sort().join(',')
      })
      .toContain('audio')

    const saved = await apiGetPresentation(request, presId)
    const types = saved.slides[0].elements.map((el) => el.type)
    expect(types).toEqual(expect.arrayContaining(['image', 'video', 'qrcode', 'drawing', 'icon', 'svg', 'audio']))
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
    await page.locator('button[title="Group selected elements"]').click()
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

  test('covers resize aspect lock, rotation handle snap, rulers, and persistent guides', async ({
    page,
    request,
  }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [seededSlide([shape('a', 120, 120, 120, 80)])],
    })
    await editor.gotoPresentation(presId)
    await page.locator('select').filter({ hasText: '100%' }).first().selectOption('100')
    await expect(page.locator('select').filter({ hasText: '100%' }).first()).toHaveValue('100')
    await page.getByTestId('slide-element-a').click()

    const handle = await page.getByTestId('resize-handle-se').boundingBox()
    expect(handle).toBeTruthy()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.keyboard.down('Shift')
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 + 120, handle.y + handle.height / 2 + 90, { steps: 8 })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await editor.waitForAutoSave()

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        const el = saved.slides[0].elements.find((item) => item.id === 'a')
        return el.width > 120 && el.height > 80
      })
      .toBe(true)

    const rotationHandle = await page.getByTestId('rotation-handle').boundingBox()
    expect(rotationHandle).toBeTruthy()
    await page.keyboard.down('Shift')
    await page.mouse.move(rotationHandle.x + rotationHandle.width / 2, rotationHandle.y + rotationHandle.height / 2)
    await page.mouse.down()
    await page.mouse.move(rotationHandle.x + 80, rotationHandle.y - 40, { steps: 6 })
    await page.mouse.up()
    await page.keyboard.up('Shift')

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        const rotation = saved.slides[0].elements.find((item) => item.id === 'a').rotation || 0
        return rotation % 15
      })
      .toBe(0)

    await page.locator('button[title^="Show rulers"]').click()
    await expect(page.getByTestId('top-ruler')).toBeVisible()
    const topRuler = await page.getByTestId('top-ruler').boundingBox()
    expect(topRuler).toBeTruthy()
    await page.mouse.move(topRuler.x + 140, topRuler.y + 8)
    await page.mouse.down()
    await page.mouse.move(topRuler.x + 180, topRuler.y + 80)
    await page.mouse.up()
    await expect(page.getByTestId('persistent-guide-x')).toBeVisible()
    await page.getByTestId('persistent-guide-x').dblclick()
    await expect(page.getByTestId('persistent-guide-x')).toHaveCount(0)
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

    await page.click('button.menu-trigger:has-text("View")')
    await page.locator('.dropdown-item').filter({ hasText: 'Custom CSS' }).click()
    await expect(page.getByText('Custom CSS')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.click('button.menu-trigger:has-text("Share")')
    await page.locator('.dropdown-item').filter({ hasText: 'View Analytics' }).click()
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
