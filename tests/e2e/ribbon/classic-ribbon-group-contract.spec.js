import { test, expect } from '../fixtures/test-fixtures.js'
import {
  expectClassicRibbonRow,
  GROUP_STATE_EXPECTATIONS,
  openRibbonEditor,
  sectionLabels,
} from '../pages/ribbon-layout-helper.js'

let editor

test.beforeEach(async ({ page, testPresentation }) => {
  editor = await openRibbonEditor(page, testPresentation.id)
})

test.describe('Classic Ribbon Group Contract', () => {
  for (const scenario of GROUP_STATE_EXPECTATIONS) {
    test(`${scenario.name} exposes expected groups in order`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const metrics = await editor.getRibbonLayoutMetrics(scenario.tab)

      expect(metrics).not.toBeNull()
      expectClassicRibbonRow(metrics, scenario.name)
      expect(sectionLabels(metrics)).toEqual(scenario.expected)
    })
  }

  test('Home text editing exposes Font and Paragraph groups in order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    await editor.addTextNode()
    await editor.startEditingTextElement()
    await editor.typeInTextEditor('Test text')

    const metrics = await editor.getRibbonLayoutMetrics('Home')
    expect(metrics).not.toBeNull()
    expect(sectionLabels(metrics)).toEqual(['Clipboard', 'Font', 'Paragraph', 'Canvas', 'Arrange'])
  })
})
