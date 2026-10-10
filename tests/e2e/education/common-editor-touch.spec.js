import { test, expect } from '../fixtures/test-fixtures.js'
import { createCdpMultiTouchDriver } from '../helpers/cdp-multi-touch-driver.js'
import { waitForNextFrame } from '../pages/wait-helpers.js'
import {
  commonSession,
  geometry,
  targetable,
  commonObservation,
  captureCommon,
} from './common-editor.js'

test.use({ hasTouch: true, viewport: { width: 768, height: 1024 } })

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

test('common trusted touch selects, moves, resizes, cancels and plays a native game', async ({
  page,
  request,
  testPresentation,
}, info) => {
  await page.addInitScript(() => {
    window.__commonTouchInput = []
    document.addEventListener(
      'pointerdown',
      (event) => {
        window.__commonTouchInput.push({
          trusted: event.isTrusted,
          pointerType: event.pointerType,
          elementId:
            event.target.closest('[data-element-id]')?.getAttribute('data-element-id') || null,
          testId: event.target.getAttribute('data-testid'),
          command:
            event.target.closest('[data-ns-command]')?.getAttribute('data-ns-command') || null,
        })
      },
      { capture: true, passive: true }
    )
  })
  const s = await commonSession(page, request, testPresentation.id)
  const before = await geometry(s.target)
  await tap(page, s.target)
  await expect(s.target).toHaveAttribute('data-selected', 'true')
  await expect(page.getByTestId('resize-handle-se')).toBeVisible()
  const driver = await createCdpMultiTouchDriver(page)
  let moved, resized, beforeCancel, afterCancel, committed, afterCancelModel
  let resizeSerialization, cancelSerialization
  try {
    await touchDrag(driver, page, await center(s.target), { x: 36, y: 24 })
    await expect.poll(async () => (await geometry(s.target)).x).toBeGreaterThan(before.x + 10)
    moved = await geometry(s.target)
    expect(moved.y).toBeGreaterThan(before.y + 10)
    expect(moved.width).toBe(before.width)
    expect(moved.height).toBe(before.height)
    await touchDrag(driver, page, await center(page.getByTestId('resize-handle-se')), {
      x: 32,
      y: 24,
    })
    await expect
      .poll(async () => (await geometry(s.target)).width)
      .toBeGreaterThan(moved.width + 10)
    resized = await geometry(s.target)
    expect(resized.height).toBeGreaterThan(moved.height + 10)
    expect(resized.x).toBe(moved.x)
    expect(resized.y).toBe(moved.y)
    beforeCancel = await geometry(s.target)
    const resizedInline = (await inlineGeometry(s.target)).actual
    // Wait for the committed resize model before starting the cancelled gesture.
    await expect
      .poll(async () => {
        const [saved] = await s.read()
        return (await inlineGeometry(s.target, saved)).serialized
      })
      .toEqual(resizedInline)
    committed = await s.read()
    resizeSerialization = await inlineGeometry(s.target, committed[0])
    expect(resizeSerialization.actual).toEqual(resizeSerialization.serialized)
    expect(committed[0]['name-picker']).toEqual(s.original[0]['name-picker'])
    await touchDrag(driver, page, await center(s.target), { x: 48, y: 24 }, 'cancel')
    await expect.poll(() => geometry(s.target)).toEqual(beforeCancel)
    afterCancel = await geometry(s.target)
    afterCancelModel = await s.read()
    expect(afterCancelModel).toEqual(committed)
    cancelSerialization = await inlineGeometry(s.target, afterCancelModel[0])
    expect(cancelSerialization.actual).toEqual(resizeSerialization.actual)
    expect(cancelSerialization.actual).toEqual(cancelSerialization.serialized)
  } finally {
    await driver.close()
  }
  const [persisted] = committed
  const gestureInput = await page.evaluate(() => window.__commonTouchInput)
  await page.reload()
  await s.editor.waitForReady()
  const reloadedModel = await s.read()
  expect(reloadedModel).toEqual(committed)
  const reloadSerialization = await inlineGeometry(s.target, reloadedModel[0])
  expect(reloadSerialization.actual).toEqual(resizeSerialization.actual)
  expect(reloadSerialization.actual).toEqual(reloadSerialization.serialized)
  await tap(page, s.target)
  const inspectorBounds = await tap(
    page,
    page.getByRole('button', { name: 'Open inspector', exact: true })
  )
  const inspector = page.getByRole('dialog', { name: 'Inspector', exact: true })
  await expect(inspector).toBeVisible()
  const launcherBounds = await tap(
    page,
    inspector.getByRole('button', { name: 'Try game', exact: true })
  )
  const dialog = page.getByRole('dialog', { name: 'Try game', exact: true })
  const root = dialog.locator('[data-ns-game]')
  await expect(root.locator('[data-ns-winner]')).toHaveText('Choose a name')
  const pickBounds = await tap(page, root.locator('[data-ns-command="pick"]'))
  await expect(root.locator('[data-ns-winner]')).toHaveText('Authored winner')
  const picked = await root.innerText()
  const resetBounds = await tap(page, root.getByRole('button', { name: 'Reset', exact: true }))
  await expect(root.locator('[data-ns-winner]')).toHaveText('Choose a name')
  const reset = await root.innerText()
  const touchInput = [...gestureInput, ...(await page.evaluate(() => window.__commonTouchInput))]
  expect(touchInput.some((event) => event.elementId === s.fixture.id)).toBe(true)
  expect(touchInput.some((event) => event.testId === 'resize-handle-se')).toBe(true)
  expect(touchInput.some((event) => event.command === 'pick')).toBe(true)
  for (const event of touchInput)
    expect(event).toMatchObject({ trusted: true, pointerType: 'touch' })
  const context = await page.evaluate(() => ({
    maxTouchPoints: navigator.maxTouchPoints,
    width: innerWidth,
    height: innerHeight,
  }))
  expect(context.maxTouchPoints).toBeGreaterThan(0)
  expect(context).toMatchObject({ width: 768, height: 1024 })
  expect(await s.read()).toEqual([persisted])
  const gameArtifact = await captureCommon(info, page, 'common-touch-native-reset')
  await tap(page, dialog.getByRole('button', { name: 'Close Try game', exact: true }))
  await expect(dialog).toHaveCount(0)
  const backdrop = await tapBackdrop(
    page,
    page.getByRole('button', { name: 'Close workspace overlay', exact: true }),
    inspector
  )
  await expect(inspector).toHaveCount(0)
  await expect(s.target).toBeVisible()
  await commonObservation(
    info,
    page,
    'touch',
    {
      movedXMinimum: before.x + 10,
      resizedWidthMinimum: moved.width + 10,
      cancelledGeometry: beforeCancel,
      winner: 'Authored winner',
      resetWinner: 'Choose a name',
    },
    {
      context,
      before,
      moved,
      resized,
      beforeCancel,
      afterCancel,
      persisted,
      committed,
      afterCancelModel,
      reloadedModel,
      resizeSerialization,
      cancelSerialization,
      reloadSerialization,
      touchInput,
      picked,
      reset,
      controlBounds: { inspectorBounds, launcherBounds, pickBounds, resetBounds },
      backdrop,
    },
    [gameArtifact]
  )
})
