import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from './fixtures/test-fixtures.js'

function createTextSlide(id, label) {
  return {
    id,
    elements: [
      {
        id: `${id}-text`,
        type: 'text',
        x: 80,
        y: 100,
        width: 500,
        height: 120,
        zIndex: 1,
        content: `<p>${label}</p>`,
      },
    ],
    notes: `${label} notes`,
    background: { type: 'color', color: '#1e1e2e' },
  }
}

test.describe('Slide Management Advanced', () => {
  let editorPage
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Slide Management Test')
    presId = pres.id
    editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test('multi-select delete clamps the active slide to the remaining tail', async ({ request }) => {
    await apiUpdatePresentation(request, presId, {
      slides: [
        createTextSlide('slide-a', 'Slide A'),
        createTextSlide('slide-b', 'Slide B'),
        createTextSlide('slide-c', 'Slide C'),
        createTextSlide('slide-d', 'Slide D'),
      ],
    })

    await editorPage.gotoPresentation(presId)
    await editorPage.selectSlide(2)
    await editorPage.toggleSlideSelection(3)
    await editorPage.deleteSelectedSlides()

    await editorPage.waitForSlideCount(2)
    await expect(editorPage.thumbnailsLocator.nth(1)).toHaveClass(/border-accent/, { timeout: 5000 })
    await editorPage.waitForAutoSave()

    await expect
      .poll(async () => {
        const presentation = await apiGetPresentation(request, presId)
        return presentation.slides.map((slide) => slide.id).join(',')
      })
      .toBe('slide-a,slide-b')
  })
})
