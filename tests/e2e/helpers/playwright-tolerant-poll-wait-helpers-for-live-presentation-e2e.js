import { expect } from '@playwright/test'

/**
 * Tolerant poll wrapper that records last sample for debug logging.
 * Used by live presentation specs where multi-page socket events
 * may take 1-3s to converge under CI load. Never use tight ms thresholds.
 */
export async function waitWithLastSample(label, fn, opts = {}) {
  const { timeout = 5000, intervals = [200, 500, 1000, 2000] } = opts
  let last
  await expect
    .poll(
      async () => {
        last = await fn()
        return last
      },
      {
        timeout,
        intervals,
        message: `${label} not converged within ${timeout}ms; last sample: ${JSON.stringify(last)}`,
      }
    )
    .toBeTruthy()
  return last
}
