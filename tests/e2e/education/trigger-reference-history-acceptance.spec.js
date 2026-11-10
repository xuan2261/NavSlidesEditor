import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture } from './release-game-fixtures.js'
import { selectContent, fillControl, inspector } from './release-content-fields.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import {
  authorActionUI,
  configureVariable,
  authoredSave,
  assertHistoryRoundtrip,
  deselectElements,
} from './trigger-reference-history-controls.js'
import { prepare, section, element } from './trigger-reference-history-fixture.js'


test('UI variable declaration, score binding and full typed history survive reload and execute authored bounds/reset', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const id = testPresentation.id,
    deck = referenceDeck(),
    board = gameFixture('scoreboard')
  Object.assign(board, { id: 'score-ui', x: 600, y: 20, width: 320, height: 240 })
  board.scoreboard.teams = [{ id: 'blue', name: 'Blue', color: '#2563eb', initialScore: 2 }]
  board.scoreboard.maxScore = 12
  deck.slides[0].elements.push(board, { ...deck.slides[0].elements[0], id: 'reset-ui', y: 320 })
  await prepare(page, request, id, deck)
  const declared = await authoredSave(
    page,
    request,
    id,
    () => configureVariable(page, { name: 'Score Blue', initialValue: 2, min: 0, max: 10 }),
    (deck) =>
      deck.interactionVariables?.[0]?.name === 'Score Blue' &&
      deck.interactionVariables[0].initialValue === 2 &&
      deck.interactionVariables[0].max === 10
  )
  const variableId = declared.interactionVariables[0].id
  expect(declared.interactionVariables).toEqual([
    { id: variableId, name: 'Score Blue', initialValue: 2, min: 0, max: 10 },
  ])
  let before = await authoredSave(
    page,
    request,
    id,
    async () => {
      await selectContent(page, 'score-ui')
      await inspector(page).getByLabel('Team 1 variable', { exact: true }).selectOption(variableId)
      await authorActionUI(page, 's1-btn', {
        kind: 'score-add',
        variableId,
        amount: 3,
        label: 'Award Blue points',
      })
      await authorActionUI(page, 'reset-ui', {
        kind: 'reset-slide',
        resetVariables: true,
        label: 'Reset UI score',
      })
    },
    (deck) =>
      element(deck, 'reset-ui')?.action?.label === 'Reset UI score' &&
      element(deck, 's1-btn')?.action?.amount === 3 &&
      element(deck, 'score-ui')?.scoreboard.teams[0].variableId === variableId
  )
  expect(
    before.slides[0].elements.find((element) => element.id === 'score-ui').scoreboard.teams
  ).toEqual([{ id: 'blue', name: 'Blue', color: '#2563eb', variableId }])
  await page.reload()
  await new EditorPage(page).waitForReady()
  await deselectElements(page)
  let after = await authoredSave(
    page,
    request,
    id,
    () => fillControl(page, 'Variable 1 maximum', 12),
    (deck) => deck.interactionVariables?.[0]?.max === 12
  )
  expect(after).toEqual({
    ...before,
    interactionVariables: [{ ...before.interactionVariables[0], max: 12 }],
  })
  await assertHistoryRoundtrip(page, request, id, before, after)
  before = after
  await selectContent(page, 's1-btn')
  after = await authoredSave(
    page,
    request,
    id,
    () => fillControl(page, 'Score amount', 4),
    (deck) => element(deck, 's1-btn')?.action?.amount === 4
  )
  const elements = before.slides[0].elements.map((element) =>
    element.id === 's1-btn' ? { ...element, action: { ...element.action, amount: 4 } } : element
  )
  expect(after).toEqual({ ...before, slides: [{ ...before.slides[0], elements }] })
  await assertHistoryRoundtrip(page, request, id, before, after)
  const { popup } = await launchPresentPopup(page)
  try {
    await popup.waitForFunction(() => window.Reveal?.isReady())
    const score = section(popup, 's1').locator(
      '[data-ns-element-id="score-ui"] [data-ns-score="blue"]'
    )
    await expect(score).toHaveText('2')
    for (const expected of ['6', '10', '12', '12']) {
      await section(popup, 's1')
        .getByRole('button', { name: 'Award Blue points', exact: true })
        .click()
      await expect(score).toHaveText(expected)
    }
    await section(popup, 's1').getByRole('button', { name: 'Reset UI score', exact: true }).click()
    await expect(score).toHaveText('2')
    await popup.screenshot({ path: testInfo.outputPath('ui-variable-binding.png'), fullPage: true })
  } finally {
    await popup.close()
  }
})


