import { test, expect } from '../fixtures/test-fixtures.js'
import {
  expectClassicRibbonRow,
  expectNoRowVerticalOverflow,
  expectRibbonPopupGeometry,
  openRibbonEditor,
  VIEWPORTS,
} from '../pages/ribbon-layout-helper.js'

let editor

test.beforeEach(async ({ page, testPresentation }) => {
  editor = await openRibbonEditor(page, testPresentation.id)
})

test.describe('Insert Tab Critical Controls Visibility', () => {
  // Tests compact grouping: Basic, Shapes, Content, Media, Embed visible; fixed Advanced actions direct.
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

    for (const trigger of [
      'Add kinetic text',
      'Add math grid',
      'Add Anime.js',
      'Add Three.js',
      'Add timeline',
      'More advanced insert options',
    ]) {
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

  test('Advanced launcher click target is not covered by the properties panel at 1366px', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await editor.switchRibbonTab('Insert')

    const launcher = page.getByTestId('ribbon-insert-game')
    await expect(launcher).toBeVisible()

    const hitTarget = await launcher.evaluate((button) => {
      const rect = button.getBoundingClientRect()
      const target = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      )
      return target === button || button.contains(target)
    })

    expect(hitTarget).toBe(true)
  })

  test('Insert grouped triggers and games are keyboard reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await editor.switchRibbonTab('Insert')
    const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })

    await insertPanel.getByRole('button', { name: 'More advanced insert options' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Games...' })).toBeVisible()

    await page.getByRole('menuitem', { name: 'Games...' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Name Picker', exact: true })).toBeFocused()

    for (const game of [
      'Name Picker',
      'Hot Potato',
      'Jeopardy',
      'Four Corners',
      'Relay Race',
      'Trivia',
      'Scattergories',
      'Live Poll',
      'Word Cloud',
      'Matching',
    ]) {
      await expect(page.getByRole('button', { name: game, exact: true })).toBeVisible()
    }
  })

  test('Insert popups use clipping-safe overlay geometry', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await editor.switchRibbonTab('Insert')
    const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })

    await insertPanel.getByRole('button', { name: 'Insert shape' }).click()
    await expectRibbonPopupGeometry(page, 'shape-gallery', 'Shape gallery')
    await page.keyboard.press('Escape')
    await expect(insertPanel.getByRole('button', { name: 'Insert shape' })).toBeFocused()

    await insertPanel.getByRole('button', { name: 'Add table' }).click()
    await expectRibbonPopupGeometry(page, 'table-picker', 'Table picker')
    await page.keyboard.press('Escape')
    await expect(insertPanel.getByRole('button', { name: 'Add table' })).toBeFocused()

    await insertPanel.getByRole('button', { name: 'More advanced insert options' }).click()
    await expectRibbonPopupGeometry(page, 'More advanced insert options', 'Advanced launcher')
    await page.getByRole('menuitem', { name: 'Games...' }).click()
    await expectRibbonPopupGeometry(page, 'games-gallery', 'Games gallery')
    await page.keyboard.press('Escape')
    await expect(insertPanel.getByRole('button', { name: 'More advanced insert options' })).toBeFocused()
  })

  test('Insert sibling popups close the previous popup', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await editor.switchRibbonTab('Insert')
    const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })

    await insertPanel.getByRole('button', { name: 'Insert shape' }).click()
    await expect(page.locator('[data-ribbon-popup="shape-gallery"]')).toBeVisible()

    await insertPanel.getByRole('button', { name: 'Add table' }).click()
    await expect(page.locator('[data-ribbon-popup="shape-gallery"]')).toHaveCount(0)
    await expect(page.locator('[data-ribbon-popup="table-picker"]')).toBeVisible()

    await insertPanel.getByRole('button', { name: 'More advanced insert options' }).click()
    await expect(page.locator('[data-ribbon-popup="table-picker"]')).toHaveCount(0)
    await expect(page.locator('[data-ribbon-popup="More advanced insert options"]')).toBeVisible()
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
