import { test, expect } from './fixtures/test-fixtures.js'
import { createCdpMultiTouchDriver } from './helpers/cdp-multi-touch-driver.js'
import { seedElements, slideElement } from './pages/canvas-actions-helper.js'
import { EditorPage } from './pages/editor-page.js'

const imageSource =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="240" height="140"%3E%3Crect width="240" height="140" fill="%23c96442"/%3E%3C/svg%3E'

async function expectNoPageOverflow(page) {
  const overflow = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }))
  expect(overflow.html).toBeLessThanOrEqual(1)
  expect(overflow.body).toBeLessThanOrEqual(1)
}

async function expectActiveTabVisible(page) {
  const visibility = await page.evaluate(() => {
    const tab = document.querySelector('[role="tab"][aria-selected="true"]')
    const list = document.querySelector('[aria-label="Ribbon tabs"]')
    if (!tab || !list) return null
    const tabRect = tab.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()
    return {
      left: tabRect.left >= listRect.left - 1,
      right: tabRect.right <= listRect.right + 1,
    }
  })
  expect(visibility).toEqual({ left: true, right: true })
}

async function seedAccessibleImage(request, id) {
  await seedElements(request, id, [
    {
      id: 'responsive-image',
      type: 'image',
      x: 240,
      y: 150,
      width: 240,
      height: 140,
      src: imageSource,
      objectFit: 'contain',
      borderWidth: 1,
      borderColor: '#000000',
      zIndex: 1,
    },
  ])
}

test.describe('responsive Ribbon and coarse-pointer controls', () => {
  test('[cap:control.ribbon.responsive] prevents page overflow at 320/768/1024 and reveals keyboard-active tabs', async ({
    page,
    testPresentation,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport)
      await expectNoPageOverflow(page)

      const home = page.getByRole('tab', { name: 'Home' })
      await home.focus()
      await home.press('End')
      await expect(page.getByRole('tab', { name: 'View' })).toHaveAttribute('aria-selected', 'true')
      await expectActiveTabVisible(page)

      await home.click()
      const primaryBounds = await page.locator('[role="tabpanel"][data-state="active"] [data-ribbon-content-row]').evaluate((row) => {
        const action = row.querySelector('[data-ribbon-big-button]')
        if (!action) return null
        const rowRect = row.getBoundingClientRect()
        const actionRect = action.getBoundingClientRect()
        return {
          left: actionRect.left >= rowRect.left - 1,
          right: actionRect.right <= rowRect.right + 1,
        }
      })
      expect(primaryBounds).toEqual({ left: true, right: true })
      if (viewport.width === 768) {
        const tabList = page.getByRole('tablist', { name: 'Ribbon tabs' })
        const beforeWheel = await tabList.evaluate((node) => node.scrollLeft)
        await tabList.hover()
        await page.mouse.wheel(160, 0)
        await expect.poll(() => tabList.evaluate((node) => node.scrollLeft)).toBeGreaterThan(beforeWheel)
      }
    }

    await page.setViewportSize({ width: 320, height: 568 })
    await expect(page.getByTestId('editor-small-screen-guard')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to presentations' })).toBeVisible()
    await expectNoPageOverflow(page)
  })

  test('[cap:control.ribbon.touch-targets] provides 44px targets and native touch tab scrolling', async ({
    page,
    request,
    testPresentation,
  }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch, 'requires the coarse-pointer Playwright project')
    await page.setViewportSize({ width: 768, height: 1024 })
    await seedAccessibleImage(request, testPresentation.id)
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    const image = slideElement(page, 'responsive-image')
    const imageBox = await image.boundingBox()
    expect(imageBox).toBeTruthy()
    await page.touchscreen.tap(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2)
    await expect(page.getByRole('tab', { name: 'Picture Format' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expectActiveTabVisible(page)

    const inspectorTrigger = page.getByRole('button', { name: 'Open inspector' })
    const inspectorBox = await inspectorTrigger.boundingBox()
    expect(inspectorBox).toBeTruthy()
    await page.touchscreen.tap(
      inspectorBox.x + inspectorBox.width / 2,
      inspectorBox.y + inspectorBox.height / 2
    )

    for (const [name, locator] of [
      ['File menu', page.getByRole('button', { name: 'File menu' })],
      ['Picture Format tab', page.getByRole('tab', { name: 'Picture Format' })],
      ['Image border width', page.getByTestId('prop-image-border-width')],
      ['Image object fit', page.getByTestId('prop-image-object-fit')],
      ['Image border color', page.getByTestId('prop-image-border-color')],
    ]) {
      const box = await locator.boundingBox()
      expect(box, `${name} must be visible`).toBeTruthy()
      expect(box.width, `${name} width`).toBeGreaterThanOrEqual(44)
      expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44)
    }

    const tabList = page.getByRole('tablist', { name: 'Ribbon tabs' })
    const before = await tabList.evaluate((node) => node.scrollLeft)
    const tabBox = await tabList.boundingBox()
    expect(tabBox).toBeTruthy()
    const driver = await createCdpMultiTouchDriver(page)
    await driver.start([{ x: tabBox.x + tabBox.width - 52, y: tabBox.y + tabBox.height / 2, id: 0 }])
    await driver.move([{ x: tabBox.x + 52, y: tabBox.y + tabBox.height / 2, id: 0 }])
    await driver.end()
    await expect.poll(() => tabList.evaluate((node) => node.scrollLeft)).toBeGreaterThan(before)
    await driver.close()

    const viewTab = page.getByRole('tab', { name: 'View' })
    await viewTab.scrollIntoViewIfNeeded()
    await viewTab.tap()
    await expect(viewTab).toHaveAttribute('aria-selected', 'true')
  })

  test('[cap:control.ribbon.reduced-motion] disables animated overflow scrolling', async ({
    page,
    testPresentation,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      window.__ribbonScrollBehaviors = []
      const original = HTMLElement.prototype.scrollBy
      HTMLElement.prototype.scrollBy = function (options) {
        if (this.id === 'ribbon-tab-list') window.__ribbonScrollBehaviors.push(options.behavior)
        return original.call(this, options)
      }
    })
    await page.setViewportSize({ width: 768, height: 1024 })
    await new EditorPage(page).gotoPresentation(testPresentation.id)

    await page.getByRole('button', { name: 'Scroll ribbon tabs right' }).click()
    await expect.poll(() => page.evaluate(() => window.__ribbonScrollBehaviors.at(-1))).toBe('auto')
  })
})
