import {
  test,
  expect,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { deckWith } from './release-game-fixtures.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { recordCommon } from './common-runtime-evidence.js'
import {
  board, section, score, answer, snapshot, navigate, authorActions, variableActions,
} from './common-runtime-variable-authoring.js'


test('common variables-triggers: authored user actions change bounded scores and scoped visibility without crossing variables or documents', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const { target, show, buttons } = variableActions()
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
