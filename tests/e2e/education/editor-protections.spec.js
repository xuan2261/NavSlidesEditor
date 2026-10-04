import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { buildEducationDeckPayload } from './fixtures/interactive-deck.js'
import { slideElement } from '../pages/canvas-actions-helper.js'
import { EditorPage } from '../pages/editor-page.js'

test.describe('Education Baseline — Editor Protections (Shape, TipTap, Alignment)', () => {
  let presId
  let editor

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Education Protections Test Deck')
    presId = pres.id
    await apiUpdatePresentation(
      request,
      presId,
      buildEducationDeckPayload('Education Protections Test Deck')
    )
    editor = new EditorPage(page)
  })

  test.afterEach(async ({ request }) => {
    if (presId) {
      await apiDeletePresentation(request, presId)
    }
  })

  test('Shape label text, font size, and text color persist through real editor controls and reload', async ({
    page,
    request,
  }) => {
    await editor.gotoPresentation(presId)
    const shape = slideElement(page, 'shape-labeled-1')
    await shape.waitFor({ state: 'visible', timeout: 15000 })
    await shape.click()

    // Edit Shape Label via Properties panel
    const labelInput = page.getByTestId('prop-shape-label')
    await expect(labelInput).toBeVisible()
    await labelInput.fill('Updated Protection Shape')
    await labelInput.blur()

    // Edit Font Size
    const sizeInput = page.getByTestId('prop-shape-text-size')
    await sizeInput.fill('32')
    await sizeInput.blur()

    // Edit Text Color — exercise the actual authoring control
    const colorInput = page.getByTestId('prop-shape-text-color')
    await expect(colorInput).toBeVisible()
    await colorInput.fill('#ff6600')
    await colorInput.blur()
    // Wait for autosave response
    await editor.waitForAutoSave()

    // Reload page
    await page.reload()
    await editor.waitForReady()

    // Assert DOM: label text and font size persist in rendered SVG
    const reloadedShape = slideElement(page, 'shape-labeled-1')
    await expect(reloadedShape).toBeVisible()
    const textNode = reloadedShape.locator('text').first()
    await expect(textNode).toHaveText('Updated Protection Shape')
    const fontSizeAttr = await textNode.getAttribute('font-size')
    expect(parseInt(fontSizeAttr, 10)).toBe(32)

    // Assert persisted server JSON (authoritative for all three controls)
    const saved = await apiGetPresentation(request, presId)
    const savedShape = saved.slides[0].elements.find((el) => el.id === 'shape-labeled-1')
    expect(savedShape.text).toBe('Updated Protection Shape')
    expect(savedShape.fontSize).toBe(32)
    expect(savedShape.textColor).toBe('#ff6600')
  })

  test('TipTap rich text styles (fontFamily, lineHeight, strong marks) render and survive reload', async ({
    page,
  }) => {
    await editor.gotoPresentation(presId)
    const textEl = slideElement(page, 'text-tiptap-styled-1')
    await textEl.waitFor({ state: 'visible', timeout: 15000 })

    // Verify rich styles in rendered DOM
    await expect(textEl).toContainText('Styled TipTap Heading')
    const strongEl = textEl.locator('strong').first()
    await expect(strongEl).toBeVisible()

    // Check computed styles on rendered DOM
    const computed = await textEl.evaluate((node) => {
      const headingP = node.querySelector('p')
      const cs = window.getComputedStyle(headingP || node)
      return {
        fontFamily: cs.fontFamily,
        lineHeight: cs.lineHeight,
        fontSize: cs.fontSize,
      }
    })
    expect(computed.fontFamily.toLowerCase()).toContain('georgia')
    expect(parseFloat(computed.lineHeight) / parseFloat(computed.fontSize)).toBeCloseTo(1.8, 2)

    // Reload and re-verify
    await page.reload()
    await editor.waitForReady()

    const reloadedText = slideElement(page, 'text-tiptap-styled-1')
    await expect(reloadedText).toContainText('Styled TipTap Heading')
    await expect(reloadedText.locator('strong').first()).toBeVisible()

    expect(
      await reloadedText.evaluate((node) => {
        const style = getComputedStyle(node.querySelector('p'))
        return {
          fontFamily: style.fontFamily,
          lineHeight: style.lineHeight,
          fontSize: style.fontSize,
        }
      })
    ).toEqual(computed)
  })

  test('Format Align Left uses selection bounds and preserves unselected shape geometry through reload', async ({
    page,
    request,
  }) => {
    // Navigate to slide 3 (Unequal width shapes: s-1: 120px at x=100, s-2: 240px at x=280)
    await editor.gotoPresentation(presId)
    await editor.selectSlide(2)
    const before = (await apiGetPresentation(request, presId)).slides[2].elements

    const s1 = slideElement(page, 'shape-narrow-1')
    const s2 = slideElement(page, 'shape-medium-2')

    await s1.waitFor({ state: 'visible', timeout: 15000 })

    // Multi-select s1 and s2
    await s1.click()
    await s2.click({ modifiers: ['Shift'] })
    await expect(page.locator('.properties-panel')).toContainText('2 elements selected')

    // Switch to Format tab and click "Align left"
    await page.getByRole('tab', { name: 'Shape Format' }).click()
    await page.getByLabel('Align left').first().click()

    await editor.waitForAutoSave()

    // Read final rendered positions
    const afterPositions = await Promise.all([
      s1.evaluate((el) => parseFloat(el.style.left)),
      s2.evaluate((el) => parseFloat(el.style.left)),
    ])

    expect(afterPositions).toEqual([100, 100])
    const expected = before.map((element) =>
      ['shape-narrow-1', 'shape-medium-2'].includes(element.id) ? { ...element, x: 100 } : element
    )
    await expect
      .poll(async () => (await apiGetPresentation(request, presId)).slides[2].elements)
      .toEqual(expected)
    await page.reload()
    await editor.waitForReady()
    await editor.selectSlide(2)
    for (const element of expected) {
      expect(
        await slideElement(page, element.id).evaluate((node) => ({
          x: parseFloat(node.style.left),
          y: parseFloat(node.style.top),
        }))
      ).toEqual({ x: element.x, y: element.y })
    }
  })
})
