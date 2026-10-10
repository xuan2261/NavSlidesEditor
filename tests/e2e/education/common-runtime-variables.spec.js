import {
  test,
  expect,
  apiUpdatePresentation,
  apiGetPresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { recordCommon } from './common-runtime-evidence.js'
import { selectContent, inspector, fillControl } from './release-content-fields.js'

function board(id, variableId, name, x) {
  const element = { ...gameFixture('scoreboard'), id, x, y: 20, width: 440, height: 240 }
  element.scoreboard.teams = [{ id: 'team', name, color: '#2563eb', variableId }]
  element.scoreboard.resetBoundVariables = true
  return element
}
function shape(id, x, action, extra = {}) {
  return {
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
  }
}
const section = (page, id = 'actions') => page.locator(`[data-ns-effective-slide-id="${id}"]`)
const score = (page, id) =>
  section(page).locator(`[data-ns-game][data-ns-element-id="${id}"] [data-ns-score="team"]`)
const answer = (page, id) => section(page, id).locator('[data-ns-element-id="answer"]')
async function snapshot(page) {
  return {
    blue: await score(page, 'blue-board').textContent(),
    red: await score(page, 'red-board').textContent(),
    parentHidden: await answer(page, 'actions').evaluate((node) => node.hidden),
    childHidden: await answer(page, 'child-actions').evaluate((node) => node.hidden),
  }
}
async function navigate(page, v, id) {
  await page.evaluate((v) => window.Reveal.slide(0, v), v)
  await expect
    .poll(() => page.evaluate(() => window.Reveal.getCurrentSlide().dataset.nsEffectiveSlideId))
    .toBe(id)
}

async function authorActions(page, request, id, buttons) {
  const expected = buttons.map(({ id, action }) => ({ id, action }))
  const ids = new Set(buttons.map((button) => button.id))
  const read = async () =>
    (await apiGetPresentation(request, id)).slides[0].elements
      .filter((element) => ids.has(element.id))
      .map(({ id, action }) => ({ id, action }))
  const seeded = await read()
  expect(seeded).toEqual(buttons.map(({ id }) => ({ id, action: null })))
  for (const { id: elementId, action } of buttons) {
    await selectContent(page, elementId)
    const panel = inspector(page)
    const kind = panel.getByRole('combobox', { name: 'Element action', exact: true })
    await expect(kind).toHaveValue('none')
    await kind.selectOption(action.kind)
    if (action.targetElementId) {
      await panel
        .getByRole('combobox', { name: 'Target element', exact: true })
        .selectOption(action.targetElementId)
    }
    if (action.variableId) {
      await panel
        .getByRole('combobox', { name: 'Score variable', exact: true })
        .selectOption(action.variableId)
      await fillControl(page, 'Score amount', action.amount)
    }
    if (action.kind === 'reset-slide') {
      const resetVariables = panel.getByRole('checkbox', {
        name: 'Reset deck variables',
        exact: true,
      })
      await resetVariables.check()
      await resetVariables.uncheck()
      await expect(resetVariables).not.toBeChecked()
    }
    await fillControl(page, 'Action label', action.label)
    await expect(kind).toHaveValue(action.kind)
    await expect(panel.getByRole('textbox', { name: 'Action label', exact: true })).toHaveValue(
      action.label
    )
  }
  await expect.poll(read).toEqual(expected)
  const persisted = await read()
  await page.reload()
  await new EditorPage(page).waitForReady()
  const reloaded = await read()
  expect(reloaded).toEqual(expected)
  return { seeded, persisted, reloaded }
}

test('common variables-triggers: authored user actions change bounded scores and scoped visibility without crossing variables or documents', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
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
    shape('reset', 500, {
      kind: 'reset-slide',
      resetVariables: false,
      label: 'Reset only this slide',
    }),
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
  ]
  await apiUpdatePresentation(request, testPresentation.id, {
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
          ...buttons.map((button) => ({ ...button, action: null })),
        ],
        children: [
          { id: 'child-actions', elements: [structuredClone(target), structuredClone(show)] },
        ],
      },
    ],
  })
  await new EditorPage(page).gotoPresentation(testPresentation.id)
  const authoredActions = await authorActions(page, request, testPresentation.id, buttons)
  const authorScreenshot = testInfo.outputPath('variables-six-actions-authored-editor.png')
  await page.screenshot({ path: authorScreenshot, fullPage: true })
  const { popup } = await launchPresentPopup(page)
  let independent
  try {
    await popup.waitForFunction(() => window.Reveal?.isReady())
    await expect(score(popup, 'blue-board')).toHaveText('2')
    await expect(score(popup, 'red-board')).toHaveText('7')
    await expect(answer(popup, 'actions')).toBeHidden()
    const initial = await snapshot(popup)
    expect(initial).toEqual({ blue: '2', red: '7', parentHidden: true, childHidden: true })
    await section(popup)
      .getByRole('button', { name: 'Award three Blue points', exact: true })
      .click()
    await expect(score(popup, 'blue-board')).toHaveText('5')
    await expect(score(popup, 'red-board')).toHaveText('7')
    await section(popup)
      .getByRole('button', { name: 'Reveal this slide answer', exact: true })
      .click()
    await expect(answer(popup, 'actions')).toBeVisible()
    const afterTrigger = await snapshot(popup)
    expect(afterTrigger).toEqual({ blue: '5', red: '7', parentHidden: false, childHidden: true })
    const visibilityTransitions = [afterTrigger.parentHidden]
    for (const [name, hidden] of [
      ['Hide this slide answer', true],
      ['Toggle this slide answer', false],
      ['Toggle this slide answer', true],
      ['Reveal this slide answer', false],
    ]) {
      await section(popup).getByRole('button', { name, exact: true }).click()
      await expect.poll(() => answer(popup, 'actions').evaluate((node) => node.hidden)).toBe(hidden)
      visibilityTransitions.push(await answer(popup, 'actions').evaluate((node) => node.hidden))
      expect(await answer(popup, 'child-actions').evaluate((node) => node.hidden)).toBe(true)
    }
    expect(visibilityTransitions).toEqual([false, true, false, true, false])
    await section(popup)
      .getByRole('button', { name: 'Increase Red score by 1', exact: true })
      .click()
    await expect(score(popup, 'red-board')).toHaveText('8')
    for (let i = 0; i < 2; i++)
      await section(popup)
        .getByRole('button', { name: 'Award three Blue points', exact: true })
        .click()
    await expect(score(popup, 'blue-board')).toHaveText('10')
    const clamped = await snapshot(popup)
    expect(clamped).toEqual({ blue: '10', red: '8', parentHidden: false, childHidden: true })
    await section(popup)
      .getByRole('button', { name: 'Remove two Blue points', exact: true })
      .click()
    await expect(score(popup, 'blue-board')).toHaveText('8')
    const bounded = await snapshot(popup)
    expect(bounded).toEqual({ blue: '8', red: '8', parentHidden: false, childHidden: true })
    await navigate(popup, 1, 'child-actions')
    await expect(answer(popup, 'child-actions')).toBeHidden()
    await section(popup, 'child-actions')
      .getByRole('button', { name: 'Reveal this slide answer', exact: true })
      .click()
    await expect(answer(popup, 'child-actions')).toBeVisible()
    await navigate(popup, 0, 'actions')
    await section(popup).getByRole('button', { name: 'Reset only this slide', exact: true }).click()
    await expect(answer(popup, 'actions')).toBeHidden()
    const scopedReset = await snapshot(popup)
    expect(scopedReset).toEqual({ blue: '8', red: '8', parentHidden: true, childHidden: false })
    await section(popup)
      .locator('[data-ns-game][data-ns-element-id="blue-board"]')
      .getByRole('button', { name: 'Reset', exact: true })
      .click()
    await expect(score(popup, 'blue-board')).toHaveText('2')
    await expect(score(popup, 'red-board')).toHaveText('8')
    const boundReset = await snapshot(popup)
    expect(boundReset).toEqual({ blue: '2', red: '8', parentHidden: true, childHidden: false })
    const launched = await launchPresentPopup(page)
    independent = launched.popup
    await independent.waitForFunction(() => window.Reveal?.isReady())
    const otherDocument = await snapshot(independent)
    expect(otherDocument).toEqual(initial)
    await section(independent)
      .getByRole('button', { name: 'Award three Blue points', exact: true })
      .click()
    await expect(score(independent, 'blue-board')).toHaveText('5')
    await expect(score(popup, 'blue-board')).toHaveText('2')
    await expect(score(popup, 'red-board')).toHaveText('8')
    const otherChanged = await snapshot(independent)
    expect(otherChanged).toEqual({ blue: '5', red: '7', parentHidden: true, childHidden: true })
    const otherScreenshot = testInfo.outputPath('variables-independent-document.png')
    await independent.screenshot({ path: otherScreenshot, fullPage: true })
    await recordCommon(
      testInfo,
      popup,
      'variables-triggers',
      'present',
      {
        authoredActions: buttons.map(({ id, action }) => ({ id, action })),
        initial,
        afterTrigger: { blue: '5', red: '7', parentHidden: false, childHidden: true },
        visibilityTransitions: [false, true, false, true, false],
        boundedBlue: { clamped: 10, afterSubtract: 8 },
        scopedReset: { blue: '8', red: '8', parentHidden: true, childHidden: false },
        boundReset: { blue: '2', red: '8', parentHidden: true, childHidden: false },
        otherDocument: initial,
      },
      {
        authoredActions,
        initial,
        afterTrigger,
        visibilityTransitions,
        clamped,
        bounded,
        scopedReset,
        boundReset,
        otherDocument,
        otherChanged,
        retainedDocument: await snapshot(popup),
      },
      [authorScreenshot, otherScreenshot]
    )
  } finally {
    if (independent) await independent.close()
    await popup.close()
  }
})
