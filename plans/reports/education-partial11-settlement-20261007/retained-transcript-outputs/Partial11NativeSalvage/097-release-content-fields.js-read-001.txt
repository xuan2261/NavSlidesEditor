import { expect, apiUpdatePresentation, apiGetPresentation } from '../fixtures/test-fixtures.js'
import { ELEMENT_DEFAULTS } from '../../../client/src/data/element-defaults.js'
import { EditorPage } from '../pages/editor-page.js'
import { observe } from './release-observations.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { downloadArtifact, freshPortable } from './release-surfaces.js'

export const CONTENT_TYPES = [
  'text',
  'image',
  'code',
  'latex',
  'html',
  'markdown',
  'chart',
  'video',
  'audio',
]
export function contentFixture(type, patch = {}) {
  return {
    ...structuredClone(ELEMENT_DEFAULTS[type]),
    id: `content-${type}`,
    name: `Content ${type}`,
    type,
    x: 80,
    y: 60,
    ...patch,
  }
}
export async function setupContent(page, request, id, element, peers = []) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await apiUpdatePresentation(request, id, {
    resolution: { width: 1280, height: 720 },
    slides: [
      {
        id: 'content-fields',
        background: { type: 'color', color: '#ffffff' },
        elements: [element, ...peers],
      },
    ],
  })
  await new EditorPage(page).gotoPresentation(id)
  return selectContent(page, element.id)
}
export async function selectContent(page, id) {
  const target = page.getByTestId(`slide-element-${id}`)
  await target.focus()
  await target.press('Space')
  await expect(target).toHaveAttribute('data-selected', 'true')
  if (
    !(await page.getByRole('complementary', { name: 'Properties panel', exact: true }).isVisible())
  ) {
    await page.getByRole('button', { name: 'Properties', exact: true }).click()
  }
  return target
}
export function inspector(page) {
  return page.getByRole('complementary', { name: 'Properties panel', exact: true })
}
export async function fillControl(page, label, value) {
  const input = inspector(page).getByLabel(label, { exact: true })
  await input.fill(String(value))
  await input.press('Tab')
}
export async function rangeControl(page, label, value) {
  const input = inspector(page).getByLabel(label, { exact: true })
  await input.focus()
  await input.press('Home')
  const step = Number((await input.getAttribute('step')) || 1)
  const min = Number((await input.getAttribute('min')) || 0)
  const steps = Math.round((value - min) / step)
  for (let i = 0; i < steps; i++) await input.press('ArrowRight')
  await expect(input).toHaveValue(String(value))
}
export async function sourceControl(page, type, content) {
  await inspector(page).getByTestId(`prop-${type}-edit`).click()
  const label = { code: 'Code source', html: 'HTML source', latex: 'LaTeX source' }[type]
  const dialog = page.getByRole('dialog').filter({ has: page.getByLabel(label, { exact: true }) })
  await dialog.getByLabel(label, { exact: true }).fill(content)
  if (type === 'html')
    await dialog
      .getByRole('checkbox', {
        name: 'I declare this embed can run offline with only the listed resources',
        exact: true,
      })
      .check()
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
}
export async function readContent(request, id, elementId) {
  const deck = await apiGetPresentation(request, id)
  const element = deck.slides[0].elements.find((item) => item.id === elementId)
  expect(element, 'Authored element still exists').toBeDefined()
  return element
}
export async function reloadContent(page, request, id, elementId, patch) {
  await expect.poll(() => readContent(request, id, elementId)).toMatchObject(patch)
  await page.reload()
  await new EditorPage(page).waitForReady()
  const target = await selectContent(page, elementId)
  const persisted = await readContent(request, id, elementId)
  expect(persisted).toMatchObject(patch)
  return { target, persisted }
}
export async function fieldEvidence(
  testInfo,
  page,
  type,
  fields,
  expected,
  observed,
  artifacts = []
) {
  for (const field of fields)
    await observe(
      testInfo,
      page,
      { element: type, surface: 'editor' },
      `field:${field}`,
      expected,
      observed,
      artifacts
    )
}
export async function withPresent(page, inspect) {
  const { popup } = await launchPresentPopup(page)
  try {
    await popup.waitForFunction(() => window.Reveal?.isReady())
    return await inspect(popup)
  } finally {
    await popup.close()
  }
}
export async function withPortable(page, browser, testInfo, filename, inspect, options = {}) {
  const file = await downloadArtifact(page, testInfo, 'Export HTML', filename)
  const portable = await freshPortable(browser, file, options)
  try {
    const observed = await inspect(portable.page, file)
    return { file, observed, network: await portable.inspectNetwork() }
  } finally {
    await portable.context.close()
  }
}
export async function renderedStyle(node, properties) {
  return node.evaluate(
    (element, keys) => Object.fromEntries(keys.map((key) => [key, getComputedStyle(element)[key]])),
    properties
  )
}
export async function reachable(node) {
  await expect(node).toBeVisible()
  expect(
    await node.evaluate((element) => {
      const r = element.getBoundingClientRect()
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return hit === element || element.contains(hit)
    })
  ).toBe(true)
}
