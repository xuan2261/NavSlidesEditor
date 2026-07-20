import { test, expect } from '../fixtures/test-fixtures.js'
import { seedElements, slideElement } from '../pages/canvas-actions-helper.js'
import { createCdpMultiTouchDriver } from '../helpers/cdp-multi-touch-driver.js'
import { EditorPage } from '../pages/editor-page.js'
import { waitForNextFrame } from '../pages/wait-helpers.js'

const imageSource =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="180"%3E%3Crect width="300" height="180" fill="%23c96442"/%3E%3C/svg%3E'

async function geometry(locator) {
  return locator.evaluate((node) => ({
    x: parseFloat(node.style.left),
    y: parseFloat(node.style.top),
    width: parseFloat(node.style.width),
    height: parseFloat(node.style.height),
    rotation: Number(node.dataset.rotation || 0),
  }))
}

async function center(locator) {
  const box = await locator.boundingBox()
  expect(box).toBeTruthy()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function touchDrag(driver, page, from, to, finish = 'end') {
  await driver.start([{ ...from, id: 0 }])
  await waitForNextFrame(page)
  await driver.move([{ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, id: 0 }])
  await waitForNextFrame(page)
  await driver.move([{ ...to, id: 0 }])
  await waitForNextFrame(page)
  await driver[finish]()
}

test.describe('mandatory tablet touch editor interactions', () => {
  test('selects, drags, resizes, rotates, crops, pinches and rolls cancellation back', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [
      {
        id: 'shape-touch',
        type: 'shape',
        shape: 'rectangle',
        x: 160,
        y: 120,
        width: 240,
        height: 140,
        zIndex: 1,
      },
      {
        id: 'image-touch',
        type: 'image',
        x: 520,
        y: 160,
        width: 220,
        height: 140,
        src: imageSource,
        zIndex: 2,
      },
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)
    await expect(slideElement(page, 'shape-touch')).toBeVisible()
    const driver = await createCdpMultiTouchDriver(page)
    const element = slideElement(page, 'shape-touch')

    await element.dispatchEvent('click')
    await expect(page.getByTestId('resize-handle-se')).toBeVisible()

    const beforeMove = await geometry(element)
    const dragStart = await center(element)
    await touchDrag(driver, page, dragStart, { x: dragStart.x + 36, y: dragStart.y + 24 })
    await expect.poll(async () => (await geometry(element)).x).toBeGreaterThan(beforeMove.x + 10)

    const resizeHandle = page.getByTestId('resize-handle-se')
    const resizeStart = await center(resizeHandle)
    const beforeResize = await geometry(element)
    await touchDrag(driver, page, resizeStart, { x: resizeStart.x + 42, y: resizeStart.y + 28 })
    await expect
      .poll(async () => (await geometry(element)).width)
      .toBeGreaterThan(beforeResize.width + 10)

    const rotationHandle = page.getByTestId('rotation-handle')
    const rotationStart = await center(rotationHandle)
    const elementBox = await element.boundingBox()
    await touchDrag(driver, page, rotationStart, {
      x: elementBox.x + elementBox.width + 35,
      y: elementBox.y + elementBox.height / 2,
    })
    await expect
      .poll(async () => {
        const transform = await element.evaluate((node) => node.style.transform)
        return Math.abs(Number(transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0))
      })
      .toBeGreaterThan(10)

    const image = slideElement(page, 'image-touch')
    await image.click()
    const imagePoint = await center(image)
    const imageBeforeCrop = await geometry(image)
    await image.dispatchEvent('contextmenu', { clientX: imagePoint.x, clientY: imagePoint.y })
    await page.getByRole('button', { name: 'Crop', exact: true }).click()
    const cropHandle = page.getByTestId('crop-handle-e')
    const cropStart = await center(cropHandle)
    await touchDrag(driver, page, cropStart, { x: cropStart.x - 35, y: cropStart.y })
    await page.getByText('Apply ↵', { exact: true }).click()
    await expect.poll(async () => (await geometry(image)).width).toBeLessThan(imageBeforeCrop.width)

    const zoom = page.getByTestId('statusbar-zoom-slider')
    const zoomBefore = Number(await zoom.inputValue())
    const canvas = await page.locator('.slide-canvas').boundingBox()
    const pinchCenter = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 }
    await driver.start([
      { x: pinchCenter.x - 30, y: pinchCenter.y, id: 0 },
      { x: pinchCenter.x + 30, y: pinchCenter.y, id: 1 },
    ])
    await driver.move([
      { x: pinchCenter.x - 70, y: pinchCenter.y, id: 0 },
      { x: pinchCenter.x + 70, y: pinchCenter.y, id: 1 },
    ])
    await driver.end()
    await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(zoomBefore)

    const cancelStart = await center(element)
    const beforeCancel = await geometry(element)
    await touchDrag(
      driver,
      page,
      cancelStart,
      { x: cancelStart.x + 80, y: cancelStart.y + 40 },
      'cancel'
    )
    await expect.poll(async () => (await geometry(element)).x).toBeCloseTo(beforeCancel.x, 1)
    await driver.close()
  })

  test('locked elements do not mutate through touch', async ({
    page,
    request,
    testPresentation,
  }) => {
    await seedElements(request, testPresentation.id, [
      {
        id: 'locked-touch',
        type: 'shape',
        shape: 'rectangle',
        x: 180,
        y: 160,
        width: 220,
        height: 120,
        locked: true,
        zIndex: 1,
      },
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)
    const element = slideElement(page, 'locked-touch')
    await expect(element).toBeVisible()
    const before = await geometry(element)
    const start = await center(element)
    const driver = await createCdpMultiTouchDriver(page)
    await touchDrag(driver, page, start, { x: start.x + 80, y: start.y + 40 })
    expect(await geometry(element)).toEqual(before)
    await expect(page.getByTestId('resize-handle-se')).toHaveCount(0)
    await driver.close()
  })

  test('exact 768px tablet boundary exposes the editor and accepts touch selection', async ({
    page,
    request,
    testPresentation,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await seedElements(request, testPresentation.id, [
      {
        id: 'boundary-touch',
        type: 'shape',
        shape: 'rectangle',
        x: 160,
        y: 120,
        width: 180,
        height: 100,
        zIndex: 1,
      },
    ])
    await new EditorPage(page).gotoPresentation(testPresentation.id)
    const element = slideElement(page, 'boundary-touch')
    const point = await center(element)
    await page.touchscreen.tap(point.x, point.y)
    await expect(page.getByTestId('resize-handle-se')).toBeVisible()
    await expect(page.getByText(/best on a larger screen/i)).toHaveCount(0)
    await expect(page.locator('body')).toHaveJSProperty('clientWidth', 768)
  })
})
