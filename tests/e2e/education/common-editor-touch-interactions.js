import { expect } from '../fixtures/test-fixtures.js'
import { waitForNextFrame } from '../pages/wait-helpers.js'
import { targetable } from './common-editor.js'
async function center(target) {
  const b = await targetable(target)
  return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }
}

async function touchDrag(driver, page, start, delta, finish = 'end') {
  await driver.start([{ ...start, id: 0 }])
  await waitForNextFrame(page)
  await driver.move([{ x: start.x + delta.x / 2, y: start.y + delta.y / 2, id: 0 }])
  await waitForNextFrame(page)
  await driver.move([{ x: start.x + delta.x, y: start.y + delta.y, id: 0 }])
  await waitForNextFrame(page)
  await driver[finish]()
}

async function tap(page, target, minimum = 44) {
  const b = await targetable(target, minimum)
  await page.touchscreen.tap((b.left + b.right) / 2, (b.top + b.bottom) / 2)
  return b
}

async function tapBackdrop(page, target, inspector) {
  await expect(target).toBeVisible()
  const drawer = await inspector.boundingBox()
  expect(drawer).not.toBeNull()
  const exposed = await target.evaluate((node, drawer) => {
    const b = node.getBoundingClientRect(),
      right = Math.min(b.right, drawer.x)
    const x = (b.left + right) / 2,
      y = (b.top + b.bottom) / 2
    return {
      left: b.left,
      right,
      top: b.top,
      bottom: b.bottom,
      x,
      y,
      width: right - b.left,
      height: b.height,
      hit: node.contains(document.elementFromPoint(x, y)),
      viewport: { width: innerWidth, height: innerHeight },
    }
  }, drawer)
  expect(exposed.width).toBeGreaterThanOrEqual(44)
  expect(exposed.height).toBeGreaterThanOrEqual(44)
  expect(exposed.left).toBeGreaterThanOrEqual(-1)
  expect(exposed.right).toBeLessThanOrEqual(exposed.viewport.width + 1)
  expect(exposed.top).toBeGreaterThanOrEqual(-1)
  expect(exposed.bottom).toBeLessThanOrEqual(exposed.viewport.height + 1)
  expect(exposed.hit).toBe(true)
  await page.touchscreen.tap(exposed.x, exposed.y)
  const input = await page.evaluate(() => window.__commonTouchInput.at(-1))
  expect(input).toMatchObject({ trusted: true, pointerType: 'touch' })
  return { exposed, drawer, input }
}

// React binds model numbers as px; CSSOM serialization is not the original model precision.
async function inlineGeometry(target, model = null) {
  return target.evaluate((node, model) => {
    const fields = ['left', 'top', 'width', 'height', 'transform']
    const actual = Object.fromEntries(fields.map((field) => [field, node.style[field]]))
    if (!model) return { actual }
    const style = node.ownerDocument.createElement('div').style
    style.left = `${model.x}px`
    style.top = `${model.y}px`
    style.width = `${model.width}px`
    style.height = `${model.height}px`
    style.transform = model.rotation ? `rotate(${model.rotation}deg)` : ''
    return {
      model: {
        x: model.x,
        y: model.y,
        width: model.width,
        height: model.height,
        rotation: model.rotation,
      },
      serialized: Object.fromEntries(fields.map((field) => [field, style[field]])),
      actual,
    }
  }, model)
}
export { center, touchDrag, tap, tapBackdrop, inlineGeometry }
