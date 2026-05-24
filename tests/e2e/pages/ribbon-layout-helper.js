import { expect } from '@playwright/test'
import { EditorPage } from './editor-page.js'

export const VIEWPORTS = [
  { width: 1280, height: 800, label: '1280px' },
  { width: 1024, height: 768, label: '1024px' },
  { width: 900, height: 700, label: '900px' },
  { width: 768, height: 600, label: '768px' },
]

export const RIBBON_TABS = ['Home', 'Insert', 'Design', 'Format', 'Transitions', 'Animations', 'View']

export const CRITICAL_VISIBLE_CONTROLS = {
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
    'Add kinetic text',
    'Add math grid',
    'Add Anime.js',
    'Add Three.js',
    'Add timeline',
    'More advanced insert options',
  ],
  Design: ['Change theme', 'Change slide background'],
  Format: [],
  Transitions: ['Change transition'],
  Animations: ['Toggle animation'],
  View: ['Find & Replace', 'Animation Timeline', 'Custom CSS', 'Speaker Notes'],
}

export const GROUP_STATE_EXPECTATIONS = [
  { name: 'Home idle', tab: 'Home', expected: ['Clipboard', 'Text', 'Canvas', 'Arrange'] },
  { name: 'Format empty', tab: 'Format', expected: ['Selection'] },
  { name: 'Insert default', tab: 'Insert', expected: ['Basic', 'Shapes', 'Content', 'Media', 'Embed', 'Advanced'] },
  { name: 'Transitions default', tab: 'Transitions', expected: ['Transition', 'Slide', 'Speed', 'Auto-Advance', 'Preview'] },
  { name: 'Animations default', tab: 'Animations', expected: ['Animation', 'Order', 'Preview'] },
  { name: 'View default', tab: 'View', expected: ['Show', 'Tools', 'Window'] },
]

export async function openRibbonEditor(page, presentationId) {
  const editor = new EditorPage(page)
  await editor.gotoPresentation(presentationId)
  return editor
}

export function sectionLabels(metrics) {
  return metrics.visibleSections.map((section) => section.label)
}

export function expectClassicRibbonRow(metrics, label) {
  expect(metrics.row.contentRowCount, `${label} should have one command row`).toBe(1)
  expect(metrics.row.nestedContentRowCount, `${label} should not nest command rows`).toBe(0)
  expect(
    metrics.row.firstSectionLeftDelta,
    `${label} first group should start at the content row left edge`
  ).toBeGreaterThanOrEqual(0)
  expect(metrics.row.firstSectionLeftDelta).toBeLessThanOrEqual(2)
}

export function expectNoRowVerticalOverflow(metrics, label) {
  expect(
    metrics.row.scrollHeight,
    `${label} active row should not vertically overflow`
  ).toBeLessThanOrEqual(metrics.row.clientHeight + 1)
}

export async function expectRibbonPopupGeometry(page, popupName, label) {
  await page.waitForFunction((name) => {
    const popup = document.querySelector(`[data-ribbon-popup="${name}"]`)
    return !!popup && Number.parseFloat(getComputedStyle(popup).opacity) === 1
  }, popupName)
  const geometry = await page.evaluate((name) => {
    const popup = document.querySelector(`[data-ribbon-popup="${name}"]`)
    const ribbon = document.querySelector('.tour-step-ribbon')
    if (!popup) return null
    const popupRect = popup.getBoundingClientRect()
    const ribbonRect = ribbon?.getBoundingClientRect()
    const popupStyle = getComputedStyle(popup)
    return {
      popup: {
        top: popupRect.top,
        left: popupRect.left,
        right: popupRect.right,
        bottom: popupRect.bottom,
      },
      backgroundColor: popupStyle.backgroundColor,
      ribbonBottom: ribbonRect?.bottom ?? null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  }, popupName)

  expect(geometry, `${label} popup should render`).not.toBeNull()
  expect(
    geometry.backgroundColor,
    `${label} popup must have a visible background (not transparent)`
  ).not.toBe('rgba(0, 0, 0, 0)')
  expect(
    geometry.backgroundColor,
    `${label} popup must have a visible background (not 'transparent')`
  ).not.toBe('transparent')
  if (geometry.ribbonBottom != null) {
    expect(geometry.popup.top, `${label} popup should escape ribbon clipping`).toBeGreaterThanOrEqual(
      geometry.ribbonBottom - 2
    )
  }
  expect(geometry.popup.left, `${label} popup should clamp left`).toBeGreaterThanOrEqual(0)
  expect(geometry.popup.right, `${label} popup should clamp right`).toBeLessThanOrEqual(
    geometry.viewportWidth
  )
  expect(geometry.popup.bottom, `${label} popup should fit viewport vertically`).toBeLessThanOrEqual(
    geometry.viewportHeight
  )
}
