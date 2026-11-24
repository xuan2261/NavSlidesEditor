import { expect } from '@playwright/test'
import touchDriver from '../helpers/cdp-multi-touch-driver.js'

const { createCdpMultiTouchDriver } = touchDriver

export async function observedTouch(page) {
  const driver = await createCdpMultiTouchDriver(page)
  await page.evaluate(() => {
    window.__nativeTouchInputs = []
    window.__nativeTouchListener = (event) =>
      window.__nativeTouchInputs.push({
        pointerType: event.pointerType,
        trusted: event.isTrusted,
        name:
          event.target.closest('button, input')?.getAttribute('aria-label') ||
          event.target.textContent,
        command: event.target.closest('button')?.dataset.nsCommand || null,
        at: performance.now(),
      })
    document.addEventListener('pointerdown', window.__nativeTouchListener, true)
  })
  return {
    async tap(target) {
      await target.scrollIntoViewIfNeeded()
      const box = await target.boundingBox()
      expect(box).not.toBeNull()
      expect(box.width).toBeGreaterThanOrEqual(24)
      expect(box.height).toBeGreaterThanOrEqual(24)
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      expect(
        await target.evaluate(
          (node, point) => node.contains(node.ownerDocument.elementFromPoint(point.x, point.y)),
          point
        )
      ).toBe(true)
      const before = await page.evaluate(() => window.__nativeTouchInputs.length)
      await driver.start([point])
      await driver.end()
      await expect
        .poll(() => page.evaluate((index) => window.__nativeTouchInputs[index], before))
        .toMatchObject({ pointerType: 'touch', trusted: true })
    },
    async events() {
      const inputs = await page.evaluate(() => window.__nativeTouchInputs)
      for (const input of inputs)
        expect(input).toMatchObject({ pointerType: 'touch', trusted: true })
      return inputs
    },
    async close() {
      try {
        await page.evaluate(() => {
          document.removeEventListener('pointerdown', window.__nativeTouchListener, true)
          delete window.__nativeTouchListener
          delete window.__nativeTouchInputs
        })
      } finally {
        await driver.close()
      }
    },
  }
}
