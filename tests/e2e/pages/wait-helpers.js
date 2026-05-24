import { expect } from '@playwright/test'

export async function waitForNextFrame(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })
  )
}

export async function waitForVisibleText(page, pattern, timeout = 5000) {
  await expect
    .poll(() => page.locator('body').innerText(), { timeout, intervals: [100, 250, 500] })
    .toMatch(pattern)
}
