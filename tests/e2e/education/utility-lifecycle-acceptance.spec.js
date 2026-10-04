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

function board(id, name, variableId, x, resetBoundVariables = false, local = false) {
  const element = { ...gameFixture('scoreboard'), id, x, y: 20, width: 300, height: 500 }
  element.scoreboard = {
    ...element.scoreboard,
    title: name,
    step: 3,
    minScore: 0,
    maxScore: 1,
    resetBoundVariables,
    teams: [
      { id: 'bound', name, color: '#2563eb', variableId },
      ...(local ? [{ id: 'local', name: 'Local', color: '#d97706', initialScore: 0 }] : []),
    ],
  }
  return element
}

test('same-variable scoreboard views clamp together, reset local scores without bound scores by default and explicitly reset only their own bindings', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  await apiUpdatePresentation(request, testPresentation.id, {
    ...deckWith([
      board('blue-a', 'Blue A', 'blue', 10, false, true),
      board('blue-b', 'Blue B', 'blue', 330, true),
      board('red', 'Red', 'red', 650),
    ]),
    interactionVariables: [
      { id: 'blue', name: 'Blue', initialValue: 2, min: 0, max: 5 },
      { id: 'red', name: 'Red', initialValue: 7, min: 0, max: 20 },
    ],
  })
  await new EditorPage(page).gotoPresentation(testPresentation.id)
  const saved = await apiGetPresentation(request, testPresentation.id)
  await visitGeneratedSurfaces(
    { page, request, browser, id: testPresentation.id, testInfo },
    async (active, surface, artifacts) => {
      const a = rootFor(active, 'release-slide', 'blue-a'),
        b = rootFor(active, 'release-slide', 'blue-b')
      const red = rootFor(active, 'release-slide', 'red'),
        touch = await observedTouch(active)
      const score = (root) => root.locator('[data-ns-score="bound"]')
      const local = a.locator('[data-ns-score="local"]')
      const values = async () => ({
        a: await score(a).textContent(),
        b: await score(b).textContent(),
        red: await score(red).textContent(),
        local: await local.textContent(),
      })
      const both = async (value) => {
        await expect(score(a)).toHaveText(value)
        await expect(score(b)).toHaveText(value)
      }
      const snapshots = []
      try {
        await both('2')
        await expect(score(red)).toHaveText('7')
        await button(a, 'Increase Blue A score by 3').press('Space')
        await both('5')
        await touch.tap(button(a, 'Increase Blue A score by 3'))
        await both('5')
        snapshots.push(await values())
        await touch.tap(button(b, 'Decrease Blue B score by 3'))
        await both('2')
        await button(b, 'Decrease Blue B score by 3').press('Enter')
        await both('0')
        await touch.tap(button(a, 'Decrease Blue A score by 3'))
        await both('0')
        snapshots.push(await values())
        await touch.tap(button(b, 'Increase Blue B score by 3'))
        await both('3')
        await touch.tap(button(a, 'Increase Local score by 3'))
        await expect(local).toHaveText('1')
        await expect(button(a, 'Increase Local score by 3')).toBeDisabled()
        await touch.tap(button(red, 'Increase Red score by 3'))
        await expect(score(red)).toHaveText('10')
        await touch.tap(button(a, 'Reset'))
        await both('3')
        await expect(local).toHaveText('0')
        snapshots.push(await values())
        await touch.tap(button(b, 'Reset'))
        await both('2')
        await expect(score(red)).toHaveText('10')
        snapshots.push(await values())
        expect(snapshots).toEqual([
          { a: '5', b: '5', red: '7', local: '0' },
          { a: '0', b: '0', red: '7', local: '0' },
          { a: '3', b: '3', red: '10', local: '0' },
          { a: '2', b: '2', red: '10', local: '0' },
        ])
        expect(await apiGetPresentation(request, testPresentation.id)).toEqual(saved)
        expect(await active.evaluate(() => window.Reveal.getIndices())).toMatchObject({
          h: 0,
          v: 0,
        })
        await observe(
          testInfo,
          active,
          { element: 'game', gameType: 'scoreboard', surface },
          surface === 'file' ? 'offline-complete-reset' : 'complete-reset',
          {
            blueBounds: [0, 5],
            sharedBindingViews: true,
            defaultResetBlue: 3,
            explicitResetBlue: 2,
            unaffectedRed: 10,
            localReset: 0,
          },
          { snapshots, touchInputs: await touch.events(), savedConfig: saved.slides },
          artifacts
        )
      } finally {
        await touch.close()
      }
    }
  )
})
