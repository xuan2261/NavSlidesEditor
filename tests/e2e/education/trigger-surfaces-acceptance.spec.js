import {
  test,
  expect,
  apiUpdatePresentation,
  apiCreateShareLink,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { downloadArtifact, freshPortable } from './release-surfaces.js'

function board(id, variableId, name, x) {
  const element = { ...gameFixture('scoreboard'), id, x, y: 20, width: 440, height: 240 }
  element.scoreboard.teams = [{ id: 'team', name, color: '#2563eb', variableId }]
  element.scoreboard.resetBoundVariables = true
  return element
}
const shape = (id, x, action, extra = {}) => ({
  id,
  type: 'shape',
  x,
  y: 300,
  width: 140,
  height: 60,
  shape: 'rect',
  fill: '#6366f1',
  action,
  ...extra,
})
const section = (page, id = 'actions') => page.locator(`[data-ns-effective-slide-id="${id}"]`)
const score = (page, id) =>
  section(page).locator(`[data-ns-game][data-ns-element-id="${id}"] [data-ns-score="team"]`)
const answer = (page, id = 'actions') => section(page, id).locator('[data-ns-element-id="answer"]')
const activate = (page, label) =>
  section(page)
    .getByRole('button', { name: label, exact: true })
    .and(section(page).locator('button[data-ns-action]'))
    .click()
async function snapshot(page) {
  return {
    blue: await score(page, 'blue-board').textContent(),
    red: await score(page, 'red-board').textContent(),
    parentHidden: await answer(page, 'actions').evaluate((node) => node.hidden),
    childHidden: await answer(page, 'child-actions').evaluate((node) => node.hidden),
  }
}
async function navigate(page, key, id) {
  await page.locator('.reveal').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press(key)
  await expect
    .poll(() => page.evaluate(() => window.Reveal.getCurrentSlide().dataset.nsEffectiveSlideId))
    .toBe(id)
}
function triggerDeck() {
  const target = shape('answer', 680, null, {
    y: 410,
    initialVisibility: 'hidden',
    fill: '#22c55e',
  })
  const show = shape('show', 20, {
    kind: 'show',
    targetElementId: 'answer',
    label: 'Reveal this slide answer',
  })
  const buttons = [
    show,
    shape('add', 180, {
      kind: 'score-add',
      variableId: 'blue',
      amount: 3,
      label: 'Award three Blue points',
    }),
    shape('subtract', 340, {
      kind: 'score-subtract',
      variableId: 'blue',
      amount: 2,
      label: 'Remove two Blue points',
    }),
    shape('reset-default', 500, {
      kind: 'reset-slide',
      resetVariables: false,
      label: 'Reset only slide',
    }),
    shape(
      'reset-optin',
      500,
      { kind: 'reset-slide', resetVariables: true, label: 'Reset slide and variables' },
      { y: 390 }
    ),
    shape(
      'hide',
      20,
      { kind: 'hide', targetElementId: 'answer', label: 'Hide this slide answer' },
      { y: 390 }
    ),
    shape(
      'toggle',
      180,
      { kind: 'toggle', targetElementId: 'answer', label: 'Toggle this slide answer' },
      { y: 390 }
    ),
    shape(
      'add-red',
      340,
      { kind: 'score-add', variableId: 'red', amount: 1, label: 'Increase Red score by 1' },
      { y: 470 }
    ),
  ]
  return {
    ...deckWith([]),
    interactionVariables: [
      { id: 'blue', name: 'Blue score', initialValue: 2, min: 0, max: 10 },
      { id: 'red', name: 'Red score', initialValue: 7, min: 0, max: 20 },
    ],
    slides: [
      {
        id: 'actions',
        elements: [
          board('blue-board', 'blue', 'Blue', 20),
          board('red-board', 'red', 'Red', 500),
          target,
          ...buttons,
        ],
        children: [
          { id: 'child-actions', elements: [structuredClone(target), structuredClone(show)] },
        ],
      },
    ],
  }
}
async function verifyActions(page, testInfo, surface) {
  await page.waitForFunction(() => window.Reveal?.isReady())
  expect(await snapshot(page)).toEqual({
    blue: '2',
    red: '7',
    parentHidden: true,
    childHidden: true,
  })
  await activate(page, 'Award three Blue points')
  await expect(score(page, 'blue-board')).toHaveText('5')
  await activate(page, 'Increase Red score by 1')
  await expect(score(page, 'red-board')).toHaveText('8')
  for (let i = 0; i < 2; i++) await activate(page, 'Award three Blue points')
  await expect(score(page, 'blue-board')).toHaveText('10')
  await activate(page, 'Remove two Blue points')
  await expect(score(page, 'blue-board')).toHaveText('8')
  for (let i = 0; i < 5; i++) await activate(page, 'Remove two Blue points')
  await expect(score(page, 'blue-board')).toHaveText('0')
  for (let i = 0; i < 4; i++) await activate(page, 'Award three Blue points')
  await activate(page, 'Remove two Blue points')
  await expect(score(page, 'blue-board')).toHaveText('8')
  await activate(page, 'Reveal this slide answer')
  await expect(answer(page)).toBeVisible()
  await activate(page, 'Hide this slide answer')
  await expect(answer(page)).toBeHidden()
  await activate(page, 'Toggle this slide answer')
  await expect(answer(page)).toBeVisible()
  await navigate(page, 'ArrowDown', 'child-actions')
  await expect(answer(page, 'child-actions')).toBeHidden()
  await section(page, 'child-actions')
    .getByRole('button', { name: 'Reveal this slide answer', exact: true })
    .click()
  await expect(answer(page, 'child-actions')).toBeVisible()
  await navigate(page, 'ArrowUp', 'actions')
  await activate(page, 'Reset only slide')
  expect(await snapshot(page)).toEqual({
    blue: '8',
    red: '8',
    parentHidden: true,
    childHidden: false,
  })
  await activate(page, 'Reset slide and variables')
  expect(await snapshot(page)).toEqual({
    blue: '2',
    red: '7',
    parentHidden: true,
    childHidden: false,
  })
  await page.screenshot({
    path: testInfo.outputPath(`trigger-parity-${surface}.png`),
    fullPage: true,
  })
}
async function prepare(page, request, id) {
  await apiUpdatePresentation(request, id, triggerDeck())
  await new EditorPage(page).gotoPresentation(id)
}
async function openShare(browser, page, url) {
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const document = await context.newPage()
    await document.goto(url)
    await document.waitForFunction(() => window.Reveal?.isReady())
    return { context, page: document }
  } catch (error) {
    await context.close()
    throw error
  }
}
async function inspectOffline(document) {
  const network = await document.inspectNetwork()
  expect(network).toEqual({ protocol: 'file:', httpAttempts: [], socketAttempts: [], errors: [] })
}
for (const surface of ['share', 'file']) {
  test(`trigger parity ${surface}: six actions, lower/upper bounds, child scope and reset authority`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    await prepare(page, request, testPresentation.id)
    const source =
      surface === 'share'
        ? `/share/${(await apiCreateShareLink(request, testPresentation.id)).token}`
        : await downloadArtifact(page, testInfo, 'Export HTML', 'trigger-actions-portable.html')
    const document =
      surface === 'share'
        ? await openShare(browser, page, source)
        : await freshPortable(browser, source)
    try {
      await verifyActions(document.page, testInfo, surface)
      if (surface === 'file') await inspectOffline(document)
    } finally {
      await document.context.close()
    }
  })
  test(`trigger ${surface}: two fresh documents retain independently divergent runtime state`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    await prepare(page, request, testPresentation.id)
    const source =
      surface === 'share'
        ? `/share/${(await apiCreateShareLink(request, testPresentation.id)).token}`
        : await downloadArtifact(page, testInfo, 'Export HTML', 'trigger-isolation-portable.html')
    const open = () =>
      surface === 'share' ? openShare(browser, page, source) : freshPortable(browser, source)
    const first = await open()
    try {
      await activate(first.page, 'Award three Blue points')
      await activate(first.page, 'Reveal this slide answer')
      const divergent = { blue: '5', red: '7', parentHidden: false, childHidden: true }
      expect(await snapshot(first.page)).toEqual(divergent)
      const second = await open()
      try {
        expect(await snapshot(second.page)).toEqual({
          blue: '2',
          red: '7',
          parentHidden: true,
          childHidden: true,
        })
        await activate(second.page, 'Remove two Blue points')
        await activate(second.page, 'Increase Red score by 1')
        expect(await snapshot(second.page)).toEqual({
          blue: '0',
          red: '8',
          parentHidden: true,
          childHidden: true,
        })
        expect(await snapshot(first.page)).toEqual(divergent)
        await first.page.screenshot({
          path: testInfo.outputPath(`trigger-isolation-A-${surface}.png`),
          fullPage: true,
        })
        await second.page.screenshot({
          path: testInfo.outputPath(`trigger-isolation-B-${surface}.png`),
          fullPage: true,
        })
        if (surface === 'file') {
          await inspectOffline(first)
          await inspectOffline(second)
        }
      } finally {
        await second.context.close()
      }
    } finally {
      await first.context.close()
    }
  })
}
