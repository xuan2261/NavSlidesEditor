import {
  test,
  expect,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { visitGeneratedSurfaces } from './release-surfaces.js'
import { observedTouch } from './native-touch-observations.js'
import { observe } from './release-observations.js'

const rootFor = (page, slide, id) =>
  page.locator(`[data-ns-effective-slide-id="${slide}"] [data-ns-game][data-ns-element-id="${id}"]`)
const stateOf = (root) => root.evaluate((node) => window.NavSlidesEducation.mount(node).getState())
const button = (root, name) => root.getByRole('button', { name, exact: true })
async function navigate(page, touch, direction, slide) {
  await touch.tap(page.locator(`.reveal .controls .navigate-${direction}`))
  await expect
    .poll(() => page.evaluate(() => window.Reveal.getCurrentSlide().dataset.nsEffectiveSlideId))
    .toBe(slide)
}
function timer(id) {
  const element = { ...gameFixture('countdown'), id }
  element.countdown = {
    ...element.countdown,
    durationSeconds: 2,
    autoStart: false,
    expiryMessage: `${id} finished`,
  }
  return element
}
async function expire(root) {
  await expect(root.locator('div[role="status"]')).toHaveText(
    `${await root.getAttribute('data-ns-element-id')} finished`
  )
  await expect(root.locator('[data-ns-countdown]')).toHaveText('00:00')
  expect(await stateOf(root)).toMatchObject({
    phase: 'expired',
    remainingMs: 0,
    deadline: null,
    expiries: 1,
  })
}

for (const selectedSurface of ['present', 'share', 'file'])
  test(`countdown retains elapsed remaining on leave/return, respects manual pause and cancels reset deadlines on ${selectedSurface}`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    const authored = {
      ...deckWith([]),
      slides: [
        {
          id: 'parent',
          elements: [timer('local-timer')],
          children: [{ id: 'child', elements: [timer('witness-timer')] }],
        },
      ],
    }
    await apiUpdatePresentation(request, testPresentation.id, authored)
    await new EditorPage(page).gotoPresentation(testPresentation.id)
    const saved = await apiGetPresentation(request, testPresentation.id)
    await visitGeneratedSurfaces(
      { page, request, browser, id: testPresentation.id, testInfo, surfaces: [selectedSurface] },
      async (active, surface, artifacts) => {
        const touch = await observedTouch(active)
        const local = rootFor(active, 'parent', 'local-timer'),
          witness = rootFor(active, 'child', 'witness-timer')
        try {
          await button(local, 'Start').press('Enter')
          await expect.poll(async () => (await stateOf(local)).remainingMs).toBeLessThan(1750)
          await navigate(active, touch, 'down', 'child')
          const paused = await stateOf(local)
          expect(paused).toMatchObject({
            phase: 'paused',
            pauseReason: 'lifecycle',
            deadline: null,
            expiries: 0,
          })
          expect(paused.remainingMs).toBeGreaterThan(0)
          expect(paused.remainingMs).toBeLessThan(2000)
          await button(witness, 'Start').press('Space')
          await expire(witness)
          expect(await stateOf(local)).toEqual(paused)
          await navigate(active, touch, 'up', 'parent')
          const resumed = await stateOf(local)
          expect(resumed).toMatchObject({ phase: 'running', pauseReason: null, expiries: 0 })
          expect(resumed.remainingMs).toBeLessThanOrEqual(paused.remainingMs)
          expect(resumed.remainingMs).toBeGreaterThan(0)
          await expire(local)
          const firstExpiry = await stateOf(local)
          await touch.tap(button(local, 'Reset'))
          await touch.tap(button(local, 'Start'))
          await touch.tap(button(local, 'Pause'))
          const manualPause = await stateOf(local)
          expect(manualPause).toMatchObject({ phase: 'paused', pauseReason: 'user', expiries: 0 })
          await navigate(active, touch, 'down', 'child')
          await touch.tap(button(witness, 'Reset'))
          await touch.tap(button(witness, 'Start'))
          await expire(witness)
          await navigate(active, touch, 'up', 'parent')
          expect(await stateOf(local)).toEqual(manualPause)
          await expect(button(local, 'Resume')).toBeEnabled()
          await touch.tap(button(local, 'Resume'))
          await expire(local)
          await touch.tap(button(local, 'Reset'))
          await touch.tap(button(local, 'Start'))
          await touch.tap(button(local, 'Reset'))
          const reset = await stateOf(local)
          await navigate(active, touch, 'down', 'child')
          await touch.tap(button(witness, 'Reset'))
          await touch.tap(button(witness, 'Start'))
          await expire(witness)
          await navigate(active, touch, 'up', 'parent')
          expect(await stateOf(local)).toEqual(reset)
          expect(reset).toMatchObject({
            phase: 'idle',
            remainingMs: 2000,
            deadline: null,
            expiries: 0,
          })
          await expect(local.locator('[data-ns-countdown]')).toHaveText('00:02')
          await expect(button(local, 'Start')).toBeEnabled()
          await expect(local.locator('[data-ns-countdown]')).toHaveAttribute('aria-live', 'off')
          expect(await apiGetPresentation(request, testPresentation.id)).toEqual(saved)
          await observe(
            testInfo,
            active,
            { element: 'game', gameType: 'countdown', surface },
            surface === 'file' ? 'offline-complete-reset' : 'complete-reset',
            {
              durationSeconds: 2,
              hiddenPause: 'Preserves consumed remaining',
              manualPause: 'Does not auto-resume',
              expiryCount: 1,
              resetRemainingMs: 2000,
            },
            {
              paused,
              resumed,
              firstExpiry,
              manualPause,
              reset,
              touchInputs: await touch.events(),
              savedConfig: saved.slides,
            },
            artifacts
          )
        } finally {
          await touch.close()
        }
      }
    )
  })

