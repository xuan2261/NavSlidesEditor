import { test, expect } from '../fixtures/test-fixtures.js'
import { waitForNextFrame } from '../pages/wait-helpers.js'
import { gameFixture } from './release-game-fixtures.js'
import {
  commonSession,
  selectCommon,
  commonInspector,
  commonTry,
  targetable,
  commonObservation,
  captureCommon,
} from './common-editor.js'

async function scrollMetrics(list) {
  return list.evaluate((node) => ({
    left: node.scrollLeft,
    width: node.clientWidth,
    content: node.scrollWidth,
  }))
}

async function observeWheelFrames(wheel) {
  await wheel.evaluate((node) => {
    const observation = { frames: [], frame: 0 }
    node.__motionObservation = observation
    const sample = () => {
      const style = getComputedStyle(node)
      const matrix =
        style.transform === 'none'
          ? new DOMMatrixReadOnly()
          : new DOMMatrixReadOnly(style.transform)
      const pose = [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]
        .map((value) => Math.round(value * 1e6))
        .join(',')
      observation.frames.push({
        at: performance.now(),
        pose,
        transform: style.transform,
        animationDuration: style.animationDuration,
        animationTimingFunction: style.animationTimingFunction,
        picking: node.closest('[data-ns-game]').querySelector('[aria-label="Picker mode"]')
          .disabled,
      })
      observation.frame = requestAnimationFrame(sample)
    }
    sample()
  })
}

test('common reduced-motion keeps ribbon navigation and native animated picker usable', async ({
  page,
  request,
  testPresentation,
}, info) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const config = {
    ...gameFixture('name-picker')['name-picker'],
    pickerMode: 'wheel',
    animationDuration: 800,
    showConfetti: true,
  }
  const s = await commonSession(page, request, testPresentation.id, { 'name-picker': config })
  const policy = await page.evaluate(() => ({
    reduce: matchMedia('(prefers-reduced-motion: reduce)').matches,
    noPreference: matchMedia('(prefers-reduced-motion: no-preference)').matches,
  }))
  expect(policy).toEqual({ reduce: true, noPreference: false })
  await selectCommon(s.target)
  await page.getByRole('tab', { name: 'Home', exact: true }).click()
  const tabs = page.getByRole('tablist', { name: 'Ribbon tabs', exact: true })
  const before = await scrollMetrics(tabs)
  expect(before.content).toBeGreaterThan(before.width)
  const right = page.getByRole('button', { name: 'Scroll ribbon tabs right', exact: true })
  await expect(right).toBeEnabled()
  const scrollControl = await targetable(right)
  await right.click()
  const immediatelyScrolled = await scrollMetrics(tabs)
  const destination = Math.min(before.content - before.width, before.left + before.width * 0.8)
  expect(immediatelyScrolled.left).toBeCloseTo(destination, 0)
  expect(immediatelyScrolled.left).toBeGreaterThan(before.left)
  await waitForNextFrame(page)
  const settled = await scrollMetrics(tabs)
  expect(settled.left).toBeCloseTo(immediatelyScrolled.left, 0)
  const home = page.getByRole('tab', { name: 'Home', exact: true })
  await home.focus()
  await home.press('End')
  const view = page.getByRole('tab', { name: 'View', exact: true })
  await expect(view).toHaveAttribute('aria-selected', 'true')
  await expect(view).toBeFocused()
  const activeTabBounds = await targetable(view)
  const panel = await commonInspector(page, 768)
  const { dialog, root } = await commonTry(page, panel)
  const wheel = root.locator('.ns-picker-wheel svg')
  const pick = root.locator('[data-ns-command="pick"]')
  const pickBounds = await targetable(pick, 44)
  await expect(root.locator('[data-ns-winner]')).toHaveText('Choose a name')
  await observeWheelFrames(wheel)
  await pick.click()
  await expect(root.locator('[data-ns-winner]')).toHaveText('Picking…')
  await expect(root.locator('[data-ns-winner]')).toHaveText('Authored winner')
  await expect(pick).toBeDisabled()
  await waitForNextFrame(page)
  const wheelFrames = await wheel.evaluate((node) => {
    const observation = node.__motionObservation
    cancelAnimationFrame(observation.frame)
    delete node.__motionObservation
    return observation.frames
  })
  expect(wheelFrames.some((frame) => frame.picking)).toBe(true)
  expect(wheelFrames.at(-1).picking).toBe(false)
  const poses = wheelFrames.map((frame) => frame.pose)
  const poseTransitions = poses.filter(
    (pose, index) => index > 0 && pose !== poses[index - 1]
  ).length
  expect(poseTransitions).toBeLessThanOrEqual(1)
  const completed = await root.innerText()
  const confetti = root.locator('.ns-picker-confetti')
  await expect(confetti).toHaveCount(1)
  const confettiBounds = await confetti.evaluate((node) =>
    [...node.getClientRects()].map((rect) => rect.toJSON())
  )
  expect(confettiBounds).toEqual([])
  const reset = root.getByRole('button', { name: 'Reset', exact: true })
  const resetBounds = await targetable(reset, 44)
  await reset.click()
  await expect(root.locator('[data-ns-winner]')).toHaveText('Choose a name')
  await expect(pick).toBeEnabled()
  const resetText = await root.innerText()
  expect(await s.read()).toEqual(s.original)
  const gameArtifact = await captureCommon(info, page, 'common-reduced-motion-native-reset')
  await dialog.getByRole('button', { name: 'Close Try game', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await panel.getByRole('button', { name: 'Try game', exact: true }).press('Escape')
  await expect(page.getByRole('dialog', { name: 'Inspector', exact: true })).toHaveCount(0)
  await commonObservation(
    info,
    page,
    'reduced-motion',
    {
      media: { reduce: true, noPreference: false },
      scrollDestination: destination,
      visibleWheelPoseTransitionsAtMost: 1,
      winner: 'Authored winner',
      confettiClientRects: [],
      resetWinner: 'Choose a name',
    },
    {
      policy,
      before,
      immediatelyScrolled,
      settled,
      scrollControl,
      activeTabBounds,
      wheelFrames,
      poseTransitions,
      confettiBounds,
      completed,
      resetText,
      pickBounds,
      resetBounds,
      persisted: await s.read(),
    },
    [gameArtifact]
  )
})
