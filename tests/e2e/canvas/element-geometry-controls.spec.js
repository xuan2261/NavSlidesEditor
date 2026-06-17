import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'
import { seedElements, slideElement, textElement } from '../pages/canvas-actions-helper.js'

async function setRange(page, testId, value) {
  await page.getByTestId(testId).evaluate((node, nextValue) => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    descriptor.set.call(node, String(nextValue))
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function savedElement(request, presentationId, id) {
  const saved = await apiGetPresentation(request, presentationId)
  return saved.slides[0].elements.find((el) => el.id === id)
}

test.describe('element geometry controls', () => {
  test('single selection updates geometry, opacity, canvas style, and reload state', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [
      textElement('text-a', 100, 110, { width: 180, height: 90, opacity: 1 }),
    ])
    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)

    await slideElement(page, 'text-a').click()
    await page.getByTestId('prop-x').fill('240')
    await page.getByTestId('prop-y').fill('170')
    await page.getByTestId('prop-width').fill('260')
    await page.getByTestId('prop-height').fill('120')
    await page.getByTestId('prop-rotation').fill('45')
    await setRange(page, 'prop-opacity', 55)

    await expect
      .poll(async () => {
        const el = await savedElement(request, testPresentation.id, 'text-a')
        return {
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          opacity: el.opacity,
        }
      })
      .toEqual({ x: 240, y: 170, width: 260, height: 120, rotation: 45, opacity: 0.55 })

    await expect(slideElement(page, 'text-a').locator('[data-element-content]')).toHaveCSS('opacity', '0.55')
    await page.reload()
    await editor.waitForReady()
    await slideElement(page, 'text-a').click()
    await expect(page.getByTestId('prop-x')).toHaveValue('240')
    await expect(page.getByTestId('prop-width')).toHaveValue('260')
    await expect(page.getByTestId('prop-rotation')).toHaveValue('45')
  })

  test('mixed multi-select shows indeterminate X then applies delta fan-out', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [
      textElement('text-a', 100, 100),
      textElement('text-b', 300, 160),
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await slideElement(page, 'text-a').click()
    await slideElement(page, 'text-b').click({ modifiers: ['Shift'] })
    await expect(page.locator('.properties-panel')).toContainText('2 elements selected')
    await expect(page.getByTestId('prop-x')).toHaveAttribute('placeholder', '—')

    await page.getByTestId('prop-x').fill('150')
    await page.getByTestId('prop-x').blur()

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, testPresentation.id)
        const byId = Object.fromEntries(saved.slides[0].elements.map((el) => [el.id, el.x]))
        return { spacing: byId['text-b'] - byId['text-a'], moved: byId['text-a'] !== 100 }
      })
      .toEqual({ spacing: 200, moved: true })
  })
})
