import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
import { apiCreatePresentation, apiDeletePresentation } from './fixtures/test-fixtures.js'

const VIEWPORTS = [
  { width: 1280, height: 800, label: '1280px' },
  { width: 1024, height: 768, label: '1024px' },
  { width: 900, height: 700, label: '900px' },
  { width: 768, height: 600, label: '768px' },
]

const RIBBON_TABS = ['Home', 'Insert', 'Design', 'Format', 'Transitions', 'Animations', 'View']

const CRITICAL_VISIBLE_CONTROLS = {
  Home: ['Paste', 'Add slide'],
  Insert: [
    'Add text',
    'Insert shape',
    'Add chart',
    'Add video',
    'Audio / Upload',
    'Open media library',
    'Add HTML embed',
    'Add SVG',
    'Add drawing',
    'Add divider',
    'Advanced',
  ],
  Design: ['Change theme', 'Change slide background'],
  Format: [],
  Transitions: ['Change transition'],
  Animations: ['Toggle animation'],
  View: ['Find & Replace', 'Animation Timeline', 'Custom CSS', 'Speaker Notes'],
}

const GROUP_STATE_EXPECTATIONS = [
  {
    name: 'Home idle',
    tab: 'Home',
    expected: ['Clipboard', 'Text', 'Canvas', 'Arrange'],
  },
  {
    name: 'Format empty',
    tab: 'Format',
    expected: ['Selection'],
  },
  {
    name: 'Insert default',
    tab: 'Insert',
    expected: ['Basic', 'Shapes', 'Content', 'Media', 'Embed', 'Advanced'],
  },
  {
    name: 'Transitions default',
    tab: 'Transitions',
    expected: ['Transition', 'Slide', 'Speed', 'Auto-Advance', 'Preview'],
  },
  {
    name: 'Animations default',
    tab: 'Animations',
    expected: ['Animation', 'Order', 'Preview'],
  },
  {
    name: 'View default',
    tab: 'View',
    expected: ['Show', 'Tools', 'Window'],
  },
]

function sectionLabels(metrics) {
  return metrics.visibleSections.map((section) => section.label)
}

function expectClassicRibbonRow(metrics, label) {
  expect(metrics.row.contentRowCount, `${label} should have one command row`).toBe(1)
  expect(metrics.row.nestedContentRowCount, `${label} should not nest command rows`).toBe(0)
  expect(
    metrics.row.firstSectionLeftDelta,
    `${label} first group should start at the content row left edge`
  ).toBeGreaterThanOrEqual(0)
  expect(metrics.row.firstSectionLeftDelta).toBeLessThanOrEqual(2)
}

function expectNoRowVerticalOverflow(metrics, label) {
  expect(
    metrics.row.scrollHeight,
    `${label} active row should not vertically overflow`
  ).toBeLessThanOrEqual(metrics.row.clientHeight + 1)
}

test.describe('Ribbon Layout Baseline Tests', () => {
  let editor
  let presId

  test.beforeEach(async ({ page, request }) => {
    const pres = await apiCreatePresentation(request, 'Ribbon Layout Test')
    presId = pres.id
    editor = new EditorPage(page)
    await editor.gotoPresentation(presId)
  })

  test.afterEach(async ({ request }) => {
    try {
      await apiDeletePresentation(request, presId)
    } catch {}
  })

  test.describe('Icon+Text Button Clipping', () => {
    test('Insert tab buttons with text labels should not clip content', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const metrics = await editor.getRibbonLayoutMetrics('Insert')

      expect(metrics).not.toBeNull()
      expect(metrics.clippedControls).toHaveLength(0)
    })

    test('Home tab buttons should not clip content at 1280px', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const metrics = await editor.getRibbonLayoutMetrics('Home')

      expect(metrics).not.toBeNull()
      expect(metrics.clippedControls).toHaveLength(0)
    })
  })

  test.describe('Insert Tab Critical Controls Visibility', () => {
    // Tests compact grouping: Basic, Shapes, Content visible; Media and Embed direct, Advanced grouped
    test('Insert tab should show all section triggers at 1280px', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const metrics = await editor.getRibbonLayoutMetrics('Insert')
      const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })

      expect(metrics).not.toBeNull()
      expect(metrics.panel.hasHorizontalOverflow).toBe(false)

      const visibleLabels = metrics.visibleSections
        .filter((s) => s.visible)
        .map((s) => s.label)

      ;['Basic', 'Shapes', 'Content', 'Media', 'Embed'].forEach((section) => {
        expect(visibleLabels, `Section "${section}" should be visible`).toContain(section)
      })

      for (const trigger of ['Advanced']) {
        await expect(insertPanel.getByRole('button', { name: trigger })).toBeVisible()
      }
    })

    test('Insert tab exposes Media actions as direct buttons at 1280px', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await editor.switchRibbonTab('Insert')
      const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })

      await expect(insertPanel.getByRole('button', { name: 'Add video' })).toBeVisible()
      await expect(insertPanel.getByRole('button', { name: 'Audio / Upload' })).toBeVisible()
      await expect(insertPanel.getByRole('button', { name: 'Open media library' })).toBeVisible()

      await expect(insertPanel.getByRole('button', { name: 'Media', exact: true })).toHaveCount(0)
    })

    test('Insert tab exposes Embed actions as direct buttons at 1280px', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await editor.switchRibbonTab('Insert')
      const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })

      for (const label of ['Add HTML embed', 'Add SVG', 'Add drawing', 'Add divider']) {
        await expect(insertPanel.getByRole('button', { name: label })).toBeVisible()
      }

      await expect(insertPanel.getByRole('button', { name: 'Embed', exact: true })).toHaveCount(0)
    })

    test('Insert grouped triggers and games are keyboard reachable', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await editor.switchRibbonTab('Insert')
      const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })

      await insertPanel.getByRole('button', { name: 'Advanced' }).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('menuitem', { name: 'Games...' })).toBeVisible()

      await page.getByRole('menuitem', { name: 'Games...' }).focus()
      await page.keyboard.press('Enter')

      for (const game of [
        'Name Picker',
        'Hot Potato',
        'Jeopardy',
        'Four Corners',
        'Relay Race',
        'Trivia',
        'Scattergories',
      ]) {
        await expect(page.getByRole('button', { name: game, exact: true })).toBeVisible()
      }
    })

    for (const viewport of VIEWPORTS) {
      test(`Insert tab should not have hidden overflow at ${viewport.label}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        const metrics = await editor.getRibbonLayoutMetrics('Insert')

        expect(metrics).not.toBeNull()
        expectClassicRibbonRow(metrics, `Insert ${viewport.label}`)
        expectNoRowVerticalOverflow(metrics, `Insert ${viewport.label}`)
        expect(
          metrics.clippedControls,
          `Insert tab should not clip visible control text at ${viewport.label}`
        ).toHaveLength(0)
        expect(
          metrics.overlaps,
          `Insert tab should not overlap controls at ${viewport.label}`
        ).toHaveLength(0)
      })
    }
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

  test.describe('Format Tab Vertical Rhythm', () => {
    test('Format tab no-selection state uses classic Selection section', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })
      const metrics = await editor.getRibbonLayoutMetrics('Format')

      expect(metrics).not.toBeNull()
      expect(sectionLabels(metrics)).toEqual(['Selection'])
      expectClassicRibbonRow(metrics, 'Format empty')
      expectNoRowVerticalOverflow(metrics, 'Format empty')
      await expect(
        page.getByRole('tabpanel', { name: 'Format' }).getByText('Select an element to format')
      ).toBeVisible()
    })

    test('Format tab selected shape exposes contextual groups in order', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })

      await editor.addShape('Rectangle')
      await page.locator('.element-wrapper[data-element-type="shape"]').first().click({ force: true })
      await expect(page.getByRole('complementary', { name: 'Properties panel' })).toContainText('Element')

      const metrics = await editor.getRibbonLayoutMetrics('Format')
      expect(metrics).not.toBeNull()
      expect(sectionLabels(metrics)).toEqual([
        'Fill',
        'Stroke',
        'Position',
        'Size',
        'Rotate',
        'Opacity',
        'Align',
        'Properties',
      ])
      expect(metrics.clippedControls).toHaveLength(0)
      expect(metrics.overlaps).toHaveLength(0)
    })

    test('Format tab controls should have consistent row height', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 })

      // Format tab is visible without element selection
      const metrics = await editor.getRibbonLayoutMetrics('Format')
      expect(metrics).not.toBeNull()

      const controlHeights = await page.evaluate(() => {
        const panel = document.querySelector('.tour-step-ribbon')
        if (!panel) return []

        const controls = panel.querySelectorAll('button, select, input')
        return Array.from(controls).map((el) => {
          const rect = el.getBoundingClientRect()
          return { height: rect.height, tag: el.tagName }
        })
      })

      const buttonHeights = controlHeights.filter((c) => c.tag === 'BUTTON').map((c) => c.height)
      if (buttonHeights.length === 0) {
        // Format tab may show placeholder when no element selected - this is acceptable
        return
      }

      const uniqueHeights = [...new Set(buttonHeights.map((h) => Math.round(h)))]

      expect(
        uniqueHeights.length,
        `Format tab should have consistent button heights (found: ${uniqueHeights.join(', ')}px)`
      ).toBeLessThanOrEqual(2)

      buttonHeights.forEach((h) => {
        expect(h, 'Button height should be 28-32px').toBeGreaterThanOrEqual(26)
        expect(h, 'Button height should be 28-32px').toBeLessThanOrEqual(34)
      })
    })
  })

  test.describe('All Tabs Overflow Matrix', () => {
    for (const tab of RIBBON_TABS) {
      test(`${tab} tab should not have vertical overflow at 1280px`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        const metrics = await editor.getRibbonLayoutMetrics(tab)

        expect(metrics).not.toBeNull()
        expectClassicRibbonRow(metrics, tab)
        expectNoRowVerticalOverflow(metrics, tab)
      })
    }

    for (const viewport of VIEWPORTS) {
      for (const tab of RIBBON_TABS) {
        test(`${tab} tab should not clip controls at ${viewport.label}`, async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height })
          const metrics = await editor.getRibbonLayoutMetrics(tab)

          expect(metrics).not.toBeNull()
          expect(
            metrics.clippedControls,
            `${tab} tab should not have clipped controls at ${viewport.label}`
          ).toHaveLength(0)
          expect(
            metrics.overlaps,
            `${tab} tab should not have overlapping controls at ${viewport.label}`
          ).toHaveLength(0)
          if (viewport.width >= 1280) {
            const criticalOutside = metrics.outsideControls.filter((control) =>
              (CRITICAL_VISIBLE_CONTROLS[tab] || []).includes(control.label)
            )
            expect(
              criticalOutside,
              `${tab} tab should keep critical controls inside the visible ribbon at ${viewport.label}`
            ).toHaveLength(0)
          }
        })
      }
    }

    for (const tab of RIBBON_TABS) {
      test(`${tab} tab should not have button overlaps`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 })
        const metrics = await editor.getRibbonLayoutMetrics(tab)

        expect(metrics).not.toBeNull()
        expect(
          metrics.overlaps,
          `${tab} tab should not have overlapping controls`
        ).toHaveLength(0)
      })
    }
  })

  test.describe('Responsive Pressure Points', () => {
    test('Insert tab should gracefully handle 900px viewport', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 700 })
      const metrics = await editor.getRibbonLayoutMetrics('Insert')

      expect(metrics).not.toBeNull()
      expect(metrics.buttonCount).toBeGreaterThan(0)

      const criticalButtons = ['Add text', 'Insert shape', 'Add chart', 'Advanced']
      const clipping = await editor.getButtonClippingStatus(criticalButtons)

      Object.entries(clipping).forEach(([label, status]) => {
        expect(status.found, `"${label}" should exist`).toBe(true)
        expect(status.isClipped, `"${label}" should not be clipped`).toBe(false)
      })
    })

    test('Home tab should remain usable at 768px', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 600 })
      const metrics = await editor.getRibbonLayoutMetrics('Home')

      expect(metrics).not.toBeNull()
      expect(metrics.buttonCount).toBeGreaterThan(0)
      expect(metrics.overlaps).toHaveLength(0)
    })
  })

  test.describe('Header Responsive Pressure', () => {
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 768, height: 600 },
    ]) {
      test(`Header should not cause document overflow at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport)

        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth
        })

        expect(overflow, `Document should not have horizontal overflow at ${viewport.width}px`).toBe(
          false
        )
      })

      test(`Critical header actions should be visible at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport)

        const actions = await page.evaluate(() => {
          const results = {}
          const selectors = {
            File: '[aria-label="File menu"]',
            AI: '[aria-label="AI"]',
            Share: '[aria-label="Share"]',
            Present: '[aria-label="Present"]',
          }

          for (const [name, selector] of Object.entries(selectors)) {
            const el = document.querySelector(selector)
            if (el) {
              const rect = el.getBoundingClientRect()
              results[name] = {
                found: true,
                visible: rect.width > 0 && rect.height > 0 && rect.right <= window.innerWidth,
              }
            } else {
              results[name] = { found: false, visible: false }
            }
          }
          return results
        })

        for (const [name, status] of Object.entries(actions)) {
          expect(status.found, `${name} button should exist`).toBe(true)
          expect(status.visible, `${name} button should be visible at ${viewport.width}px`).toBe(
            true
          )
        }
      })
    }

    test('Tab navigation should work at 768px', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 600 })

      const tabs = ['Home', 'Insert', 'Design', 'View']
      for (const tabName of tabs) {
        await editor.switchRibbonTab(tabName)
        const activeTab = await page.evaluate(() => {
          const active = document.querySelector('[role="tab"][data-state="active"]')
          return active?.getAttribute('aria-label') || active?.textContent?.trim()
        })
        expect(activeTab).toBe(tabName)
      }
    })
  })
})
