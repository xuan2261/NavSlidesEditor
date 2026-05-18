import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

function seededSlide(id, elements = []) {
  return {
    id,
    elements,
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  }
}

async function seedSlides(request, presentationId, slides) {
  await apiUpdatePresentation(request, presentationId, { slides })
}

async function getSlideElements(request, presentationId, slideIndex = 0) {
  const saved = await apiGetPresentation(request, presentationId)
  return saved.slides[slideIndex].elements || []
}

test.describe('Element Lifecycle And Autosave', () => {
  let editor
  let presentationId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Element Lifecycle And Autosave')
    presentationId = pres.id
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    await apiDeletePresentation(request, presentationId)
  })

  test('keyboard delete removes selected element', async ({ page, request }) => {
    const elementId = 'lifecycle-delete-kbd'
    await seedSlides(request, presentationId, [
      seededSlide('slide-1', [
        {
          id: elementId,
          type: 'shape',
          shape: 'rect',
          x: 120,
          y: 120,
          width: 200,
          height: 120,
          zIndex: 1,
          fill: '#6366f1',
        },
      ]),
    ])

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()
    await page.keyboard.press('Delete')

    await expect.poll(async () => (await getSlideElements(request, presentationId)).length).toBe(0)
  })

  test('context menu cut removes selected element', async ({ page, request }) => {
    const elementId = 'lifecycle-delete-context'
    await seedSlides(request, presentationId, [
      seededSlide('slide-1', [
        {
          id: elementId,
          type: 'shape',
          shape: 'rect',
          x: 120,
          y: 120,
          width: 200,
          height: 120,
          zIndex: 1,
          fill: '#22c55e',
        },
      ]),
    ])

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click({ button: 'right' })
    await page.getByRole('button', { name: '✂ Cut (Ctrl+X)' }).click()

    await expect.poll(async () => (await getSlideElements(request, presentationId)).length).toBe(0)
  })

  test('properties panel delete removes selected element', async ({ page, request }) => {
    const elementId = 'lifecycle-delete-prop'
    await seedSlides(request, presentationId, [
      seededSlide('slide-1', [
        {
          id: elementId,
          type: 'shape',
          shape: 'rect',
          x: 120,
          y: 120,
          width: 200,
          height: 120,
          zIndex: 1,
          fill: '#f97316',
        },
      ]),
    ])

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()
    await page.getByTestId('prop-delete').click()

    await expect.poll(async () => (await getSlideElements(request, presentationId)).length).toBe(0)
  })

  test('locked element blocks keyboard delete and duplicate', async ({ page, request }) => {
    const elementId = 'lifecycle-locked-1'
    await seedSlides(request, presentationId, [
      seededSlide('slide-1', [
        {
          id: elementId,
          type: 'shape',
          shape: 'rect',
          x: 140,
          y: 140,
          width: 210,
          height: 130,
          zIndex: 1,
          fill: '#a855f7',
          locked: true,
        },
      ]),
    ])

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()

    await page.keyboard.press('Delete')
    await page.keyboard.press('Control+d')

    await expect.poll(async () => (await getSlideElements(request, presentationId)).length).toBe(1)
  })

  test('copy and paste on same slide preserves type and key properties', async ({ page, request }) => {
    const elementId = 'lifecycle-copy-same'
    await seedSlides(request, presentationId, [
      seededSlide('slide-1', [
        {
          id: elementId,
          type: 'shape',
          shape: 'rect',
          x: 160,
          y: 150,
          width: 190,
          height: 110,
          zIndex: 1,
          fill: '#0ea5e9',
          stroke: '#1e293b',
        },
      ]),
    ])

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()
    await page.keyboard.press('Control+c')
    await page.keyboard.press('Control+v')

    await expect.poll(async () => (await getSlideElements(request, presentationId)).length).toBe(2)

    const elements = await getSlideElements(request, presentationId)
    const original = elements.find((el) => el.id === elementId)
    const duplicate = elements.find((el) => el.id !== elementId)

    expect(duplicate.type).toBe(original.type)
    expect(duplicate.fill).toBe(original.fill)
    expect(duplicate.stroke).toBe(original.stroke)
    expect(duplicate.width).toBe(original.width)
    expect(duplicate.height).toBe(original.height)
  })

  test('copy from one slide and paste into another slide persists on target', async ({ page, request }) => {
    const sourceId = 'lifecycle-copy-cross'
    await seedSlides(request, presentationId, [
      seededSlide('slide-1', [
        {
          id: sourceId,
          type: 'shape',
          shape: 'rect',
          x: 120,
          y: 100,
          width: 180,
          height: 100,
          zIndex: 1,
          fill: '#14b8a6',
        },
      ]),
      seededSlide('slide-2', []),
    ])

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${sourceId}`).click()
    await page.keyboard.press('Control+c')

    await editor.selectSlide(1)
    await page.locator('.slide-canvas').click({ force: true })
    await page.keyboard.press('Control+v')

    await expect.poll(async () => (await getSlideElements(request, presentationId, 1)).length).toBe(1)

    const targetElements = await getSlideElements(request, presentationId, 1)
    expect(targetElements[0].type).toBe('shape')
    expect(targetElements[0].fill).toBe('#14b8a6')
  })

  test('autosave failure keeps local changes visible and retry persists them', async ({
    page,
    request,
  }) => {
    const elementId = 'lifecycle-autosave-retry'
    await seedSlides(request, presentationId, [
      seededSlide('slide-1', [
        {
          id: elementId,
          type: 'shape',
          shape: 'rect',
          x: 100,
          y: 110,
          width: 200,
          height: 120,
          zIndex: 1,
          fill: '#6366f1',
        },
      ]),
    ])

    let failOnce = true
    await page.route(`**/api/presentations/${presentationId}`, async (route) => {
      const postData = route.request().postData() || ''
      if (route.request().method() === 'PUT' && failOnce && postData.includes('"x":260')) {
        failOnce = false
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Injected autosave failure' }),
        })
        return
      }
      await route.continue()
    })

    await editor.gotoPresentation(presentationId)
    await page.getByTestId(`slide-element-${elementId}`).click()
    await page.getByTestId('prop-x').fill('260')

    await expect(page.getByText('Save failed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    await expect(page.getByTestId(`slide-element-${elementId}`)).toBeVisible()
    await expect(page.getByTestId('prop-x')).toHaveValue('260')

    await page.getByRole('button', { name: 'Retry' }).click()

    await expect
      .poll(async () => {
        const el = (await getSlideElements(request, presentationId)).find((item) => item.id === elementId)
        return el?.x
      })
      .toBe(260)
  })
})
