import { expect, apiUpdatePresentation, apiGetPresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { ordinaryFixture } from './release-ordinary-fixtures.js'
import { deckWith } from './release-game-fixtures.js'
import { observe } from './release-observations.js'

export const VISUAL_TYPES = [
  'shape',
  'table',
  'icon',
  'callout',
  'qrcode',
  'drawing',
  'line',
  'svg',
  'timeline',
]
export async function visualSession(page, request, id, type, changes = {}, companions = []) {
  const fixture = {
    ...ordinaryFixture(type),
    x: 100,
    y: 100,
    width: 500,
    height: 260,
    rotation: 0,
    ...changes,
  }
  await apiUpdatePresentation(request, id, deckWith([...companions, fixture]))
  const editor = new EditorPage(page)
  await editor.gotoPresentation(id)
  const root = page.getByTestId(`slide-element-${fixture.id}`)
  const read = async () =>
    (await apiGetPresentation(request, id)).slides[0].elements.find((e) => e.id === fixture.id)
  const select = async () => {
    await root.focus()
    if ((await root.getAttribute('data-selected')) !== 'true') await root.press('Enter')
    await expect(root).toHaveAttribute('data-selected', 'true')
  }
  await select()
  return {
    root,
    read,
    select,
    editor,
    fixture,
    async reload(expected) {
      await expect.poll(read).toMatchObject(expected)
      await page.reload()
      await editor.waitForReady()
      const persisted = await read()
      expect(persisted).toMatchObject(expected)
      await select()
      return persisted
    },
  }
}

export async function fillControl(page, label, value) {
  const control = page
    .getByRole('complementary', { name: 'Properties panel', exact: true })
    .getByLabel(label, { exact: true })
  await control.fill(String(value))
  await control.press('Tab')
}
export async function colorControl(page, label, value) {
  const control = page.getByLabel(label, { exact: true })
  await expect(control).toBeVisible()
  // Chromium's native color chooser is outside the page. Exercise its real
  // input/change boundary, never mutate the deck/store instead of the control.
  await control.evaluate((node, color) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, color)
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}
export async function rangeControl(page, label, value) {
  const control = page.getByRole('slider', { name: label, exact: true })
  await control.press('Home')
  const { min, step } = await control.evaluate((node) => ({
    min: Number(node.min || 0),
    step: Number(node.step || 1),
  }))
  for (let i = min; i < value; i += step) await control.press('ArrowRight')
  await expect(control).toHaveValue(String(value))
}
export async function styleOf(locator, properties) {
  return locator.evaluate(
    (node, keys) => Object.fromEntries(keys.map((key) => [key, getComputedStyle(node)[key]])),
    properties
  )
}
export async function fieldEvidence(testInfo, page, type, fields, expected, observed) {
  for (const field of fields)
    await observe(
      testInfo,
      page,
      { element: type, surface: 'editor' },
      `field:${field}`,
      expected,
      observed
    )
}
export async function dragResize(page, root, dx, dy) {
  const box = await root.boundingBox()
  const width = await root.evaluate((node) => parseFloat(node.style.width))
  const scale = box.width / width
  const handle = await root.getByTestId('resize-handle-se').boundingBox()
  expect(handle).not.toBeNull()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    handle.x + handle.width / 2 + dx * scale,
    handle.y + handle.height / 2 + dy * scale,
    { steps: 8 }
  )
  await page.mouse.up()
}
export async function insideBounds(inner, outer, tolerance = 1) {
  const a = await inner.boundingBox(),
    b = await outer.boundingBox()
  expect(a).not.toBeNull()
  expect(b).not.toBeNull()
  expect(a.x).toBeGreaterThanOrEqual(b.x - tolerance)
  expect(a.y).toBeGreaterThanOrEqual(b.y - tolerance)
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + tolerance)
  expect(a.y + a.height).toBeLessThanOrEqual(b.y + b.height + tolerance)
  return { inner: a, outer: b }
}
