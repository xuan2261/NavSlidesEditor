import { expect } from '../fixtures/test-fixtures.js'
import { cards, beginMismatch, settledMismatch, finishMemory, progress } from './card-image-lifecycle-interactions.js'

export async function pauseMismatch(page, a, witness, childInherited, parentInherited, navigate) {
  const pauseSequenceStart = await page.evaluate(() => performance.now())
  await beginMismatch(a)
  const mismatchAt = await page.evaluate(
    (start) =>
      window.__cardImageObservations.find(
        (event) =>
          event.element === 'memory-a' &&
          event.slide === 'parent' &&
          event.kind === 'render' &&
          event.at >= start &&
          !event.paused &&
          event.states[0] === 'face-up' &&
          event.states[2] === 'face-up'
      ).at,
    pauseSequenceStart
  )
  await page.waitForFunction(
    (start) =>
      performance.now() - start >= 300 &&
      document.querySelector('[data-ns-element-id="memory-a"] [data-ns-memory-card]').dataset
        .nsCardState === 'face-up',
    mismatchAt
  )
  await navigate(page, 'down', 'child')
  await expect(a).toHaveClass(/ns-education-paused/)
  const pausedAt = await page.evaluate(
    (start) =>
      window.__cardImageObservations.find(
        (event) =>
          event.element === 'memory-a' &&
          event.slide === 'parent' &&
          event.kind === 'render' &&
          event.at >= start &&
          event.paused
      ).at,
    mismatchAt
  )
  const prePauseActive = pausedAt - mismatchAt
  expect(prePauseActive).toBeGreaterThanOrEqual(300)
  expect(prePauseActive).toBeLessThan(800)
  const leftAt = await page.evaluate(() => performance.now())
  await beginMismatch(witness)
  await settledMismatch(witness)
  const hiddenElapsed = await page.evaluate((start) => performance.now() - start, leftAt)
  expect(hiddenElapsed).toBeGreaterThanOrEqual(800)
  // The old pair must remain revealed while inactive beyond its original deadline.
  await expect(cards(a).nth(0)).toHaveAttribute('data-ns-card-state', 'face-up')
  await expect(cards(a).nth(2)).toHaveAttribute('data-ns-card-state', 'face-up')
  await finishMemory(childInherited)
  await progress(parentInherited, 0, 0, 0)
  await navigate(page, 'up', 'parent')
  const returnedAt = await page.evaluate(
    (start) =>
      window.__cardImageObservations.find(
        (event) =>
          event.element === 'memory-a' &&
          event.slide === 'parent' &&
          event.kind === 'render' &&
          event.at > start &&
          !event.paused
      ).at,
    pausedAt
  )
  await expect(cards(a).nth(0)).toHaveAttribute('data-ns-card-state', 'face-up')
  await expect(cards(a).nth(1)).toBeDisabled()
  await settledMismatch(a)
  const concealedAt = await page.evaluate(
    (start) =>
      window.__cardImageObservations.find(
        (event) =>
          event.element === 'memory-a' &&
          event.slide === 'parent' &&
          event.kind === 'render' &&
          event.at >= start &&
          !event.paused &&
          event.states[0] === 'face-down' &&
          event.states[2] === 'face-down'
      ).at,
    returnedAt
  )
  const resumedElapsed = concealedAt - returnedAt,
    expectedRemaining = 800 - prePauseActive
  // Allow frame/observer scheduling noise, but never a restart of the full 800 ms delay.
  expect(resumedElapsed).toBeGreaterThanOrEqual(expectedRemaining - 25)
  expect(resumedElapsed).toBeLessThanOrEqual(expectedRemaining + 100)
  return { hiddenElapsed, prePauseActive, expectedRemaining, resumedElapsed }
}
