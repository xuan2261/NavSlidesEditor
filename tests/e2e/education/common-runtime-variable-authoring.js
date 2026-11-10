import { expect, apiGetPresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture } from './release-game-fixtures.js'
import { selectContent, inspector, fillControl } from './release-content-fields.js'
export { board, section, score, answer, snapshot, navigate, authorActions }
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

export function variableActions() {
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
  return { target, show, buttons }
}
