import { expect } from '../fixtures/test-fixtures.js'
import {
  images, rootFor, cards, command, progress, concealed, decodedImage, observeCardDOM,
  beginMismatch, settledMismatch, finishMemory, exerciseFlashcards,
} from './card-image-lifecycle-interactions.js'
import { pauseMismatch } from './card-image-pause-lifecycle.js'
export { playCards }
const inheritedId = 'layout-fixed:cards:inherited-memory'
async function current(page, slide) {
  await expect
    .poll(() => page.evaluate(() => window.Reveal.getCurrentSlide().dataset.nsEffectiveSlideId))
    .toBe(slide)
}
async function navigate(page, direction, slide) {
  await page.locator(`.reveal .controls .navigate-${direction}`).click()
  await current(page, slide)
}
async function configSnapshot(page) {
  return page.locator('[data-ns-game-config]').evaluateAll((nodes) =>
    nodes.map((node) => ({
      slide: node.closest('[data-ns-effective-slide-id]').dataset.nsEffectiveSlideId,
      element: node.closest('[data-ns-game]').dataset.nsElementId,
      config: JSON.parse(node.textContent),
    }))
  )
}
async function playCards(page) {
  await page.waitForFunction(() => window.Reveal?.isReady())
  await current(page, 'parent')
  const a = rootFor(page, 'parent', 'memory-a'),
    b = rootFor(page, 'parent', 'memory-b')
  const parentInherited = rootFor(page, 'parent', inheritedId)
  const childInherited = rootFor(page, 'child', inheritedId)
  const witness = rootFor(page, 'child', 'child-witness')
  const flash = rootFor(page, 'parent', 'mixed-flash')
  const authored = await configSnapshot(page)
  await observeCardDOM(page)
  const concealedAccessibility = await concealed(a)
  await progress(a, 0, 0, 0)
  await progress(b, 0, 0, 0)
  await progress(parentInherited, 0, 0, 0)
  await command(a, 'Reveal all')
  const revealedImages = [
    await decodedImage(a, images[0], 36, 24),
    await decodedImage(a, images[1], 28, 32),
  ]
  await expect(a.getByText('Amber partner', { exact: true })).toBeVisible()
  await expect(a.getByText('Teal partner', { exact: true })).toBeVisible()
  await progress(a, 0, 0, 0)
  const practiceFeedback = await a.locator('[data-ns-game-ui] > [role="status"]').innerText()
  for (let index = 0; index < 4; index++) await expect(cards(a).nth(index)).toBeDisabled()
  await command(a, 'Reset')
  await concealed(a)
  await beginMismatch(a, true)
  await settledMismatch(a)
  await concealed(a)
  await progress(b, 0, 0, 0)
  await command(a, 'Reset')

  // A second real mismatch is the elapsed-time witness; no fake clock or sleep.
  await cards(a).nth(0).click()
  const firstResetAt = await page.evaluate(() => performance.now())
  await command(a, 'Reset')
  await beginMismatch(b)
  await settledMismatch(b)
  const firstResetElapsed = await page.evaluate((start) => performance.now() - start, firstResetAt)
  expect(firstResetElapsed).toBeGreaterThanOrEqual(800)
  await concealed(a)
  await progress(a, 0, 0, 0)
  await command(b, 'Reset')
  await beginMismatch(a)
  const pendingResetAt = await page.evaluate(() => performance.now())
  await command(a, 'Reset')
  await cards(a).nth(0).click()
  await beginMismatch(b)
  await settledMismatch(b)
  const pendingResetElapsed = await page.evaluate(
    (start) => performance.now() - start,
    pendingResetAt
  )
  expect(pendingResetElapsed).toBeGreaterThanOrEqual(800)
  await expect(cards(a).nth(0)).toHaveAttribute('data-ns-card-state', 'face-up')
  await expect(cards(a).nth(1)).toHaveAttribute('data-ns-card-state', 'face-down')
  await expect(cards(a).nth(2)).toHaveAttribute('data-ns-card-state', 'face-down')
  await progress(a, 0, 0, 0)
  await command(a, 'Reset')
  await command(b, 'Reset')

  const { hiddenElapsed, prePauseActive, expectedRemaining, resumedElapsed } =
    await pauseMismatch(page, a, witness, childInherited, parentInherited, navigate)
  await command(a, 'Reset')
  const memoryComplete = await finishMemory(a)
  await progress(b, 0, 0, 0)
  await progress(parentInherited, 0, 0, 0)
  await progress(childInherited, 2, 2, 20)
  const flashcards = await exerciseFlashcards(flash)
  await progress(a, 2, 2, 20)
  await cards(b).nth(0).click()
  await cards(b).nth(1).click()
  await progress(b, 1, 1, 10)
  await command(a, 'Reset')
  await progress(a, 0, 0, 0)
  await concealed(a)
  await progress(b, 1, 1, 10)
  await command(b, 'Reset')
  await progress(b, 0, 0, 0)
  await progress(parentInherited, 0, 0, 0)
  await navigate(page, 'down', 'child')
  await progress(childInherited, 2, 2, 20)
  await command(childInherited, 'Reset')
  await concealed(childInherited)
  await progress(childInherited, 0, 0, 0)
  await navigate(page, 'up', 'parent')
  await progress(parentInherited, 0, 0, 0)
  await progress(a, 0, 0, 0)
  expect(await configSnapshot(page)).toEqual(authored)
  const events = await page.evaluate(() => window.__cardImageObservations)
  expect(events.filter((event) => event.kind === 'input').every((event) => event.trusted)).toBe(
    true
  )
  const parentEvents = events.filter(
    (event) => event.element === 'memory-a' && event.slide === 'parent'
  )
  const resets = parentEvents.filter((event) => event.kind === 'input' && event.command === 'reset')
  // Every reset has a later actual render at zero, not a fabricated state receipt.
  for (const reset of resets)
    expect(
      parentEvents.some(
        (event) =>
          event.kind === 'render' &&
          event.at >= reset.at &&
          event.progress === '0 / 2 pairs matched · 0 attempts · 0 points'
      )
    ).toBe(true)
  return {
    concealedAccessibility,
    revealedImages,
    practiceFeedback,
    memoryComplete,
    flashcards,
    hiddenElapsed,
    prePauseActive,
    expectedRemaining,
    resumedElapsed,
    firstResetElapsed,
    pendingResetElapsed,
    events,
    savedConfig: await configSnapshot(page),
  }
}
