import { test, expect } from '../fixtures/test-fixtures.js'
import {
  expectClassicRibbonRow,
  expectNoRowVerticalOverflow,
  openRibbonEditor,
} from '../pages/ribbon-layout-helper.js'

let editor

test.beforeEach(async ({ page, testPresentation }) => {
  editor = await openRibbonEditor(page, testPresentation.id)
})

test.describe('Home Tab Text-Editing State', () => {
  // After compaction: Font + Paragraph compact trigger visible at 1280px
  // Canvas/Arrange may overflow due to side panels (slide panel + properties panel)
  test('Home tab should show Font/Paragraph controls when editing text at 1280px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    await editor.addTextNode()
    await editor.startEditingTextElement()
    await editor.typeInTextEditor('Test text')

    await editor.switchRibbonTab('Home')
    const metrics = await editor.getRibbonLayoutMetrics()

    expect(metrics).not.toBeNull()

    const visibleLabels = metrics.visibleSections
      .filter((s) => s.visible)
      .map((s) => s.label)

    // Core text editing controls must be visible
    expect(visibleLabels).toContain('Font')
    expect(visibleLabels).toContain('Paragraph')
  })

  // At 1024px, overflow is expected - ribbon has horizontal scroll
  test('Home tab text controls should have horizontal scroll at 1024px when editing', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 })

    await editor.addTextNode()
    await editor.startEditingTextElement()

    await editor.switchRibbonTab('Home')
    const metrics = await editor.getRibbonLayoutMetrics()

    expect(metrics).not.toBeNull()
    // Verify core controls exist and ribbon is scrollable
    expect(metrics.buttonCount).toBeGreaterThan(0)
    // No vertical overflow
    expectClassicRibbonRow(metrics, 'Home text editing 1024px')
    expectNoRowVerticalOverflow(metrics, 'Home text editing 1024px')
  })
})
