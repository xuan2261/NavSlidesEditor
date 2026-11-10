import { test, expect } from '../fixtures/test-fixtures.js'
import { createCdpMultiTouchDriver } from '../helpers/cdp-multi-touch-driver.js'
import {
  commonSession,
  geometry,
  commonObservation,
  captureCommon,
} from './common-editor.js'
import { center, touchDrag, tap, tapBackdrop, inlineGeometry } from './common-editor-touch-interactions.js'

test.use({ hasTouch: true, viewport: { width: 768, height: 1024 } })


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
