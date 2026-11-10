import { test, expect } from '../fixtures/test-fixtures.js'
import { local, author, readState, waitReady } from './standalone-runtime-fixture.js'
for (const width of [320, 768]) {
  test(`native touch and reduced motion preserve gameplay at ${width}px`, async ({
    browser,
    request,
    testPresentation,
  }) => {
    await author(request, testPresentation)
    const mobile = await browser.newContext({
      viewport: { width, height: 768 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: 'reduce',
    })
    try {
      const page = await mobile.newPage()
      await page.goto(
        `${process.env.PLAYWRIGHT_TEST_BASE_URL}/api/presentations/${testPresentation.id}/present`
      )
      await waitReady(page)
      await page.locator(`${local} select`).selectOption('button')
      await page.locator(`${local} [data-ns-command="pick"]`).tap()
      await expect.poll(() => readState(page, 'parent', 'local')).toMatchObject({ picks: 1 })
      const result = await page.evaluate(() => ({
        width: innerWidth,
        touch: navigator.maxTouchPoints,
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        indices: Reveal.getIndices(),
        targetable: [...document.querySelectorAll('[data-ns-element-id="local"] button')].every(
          (button) => {
            const rect = button.getBoundingClientRect()
            return (
              document
                .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
                ?.closest('button') === button
            )
          }
        ),
      }))
      expect(result).toMatchObject({
        width,
        reduced: true,
        indices: { h: 0, v: 0 },
        targetable: true,
      })
      expect(result.touch).toBeGreaterThan(0)
    } finally {
      await mobile.close()
    }
  })
}
