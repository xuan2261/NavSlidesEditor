import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { deckWith, gameFixture } from './release-game-fixtures.js'
import { selectContent, fillControl, inspector } from './release-content-fields.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import {
  authorActionUI,
  configureVariable,
  executeCopyPaste,
  duplicateActiveSlide,
  duplicateActiveChildSlide,
  detachSlideLayout,
  typedState,
  referenceDeck,
  assertElementClone,
  assertSlideClone,
  assertHistoryRoundtrip,
  navigatePresent,
  deselectElements,
  authoredSave,
} from './trigger-reference-history-controls.js'

async function prepare(page, request, id, deck = referenceDeck()) {
  await apiUpdatePresentation(request, id, { ...deckWith([]), ...deck })
  await new EditorPage(page).gotoPresentation(id)
}
const section = (popup, id) => popup.locator(`[data-ns-effective-slide-id="${id}"]`)
const target = (popup, slide, id) => section(popup, slide).locator(`[data-ns-element-id="${id}"]`)
const element = (deck, id) => deck.slides[0].elements.find((item) => item.id === id)

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

test('UI fragment/action edits have exact typed Undo/Redo/reload; visibility cannot bypass fragment and Reset rearms it', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const id = testPresentation.id,
    deck = referenceDeck()
  delete deck.slides[0].layoutId
  deck.slides[0].children = []
  deck.slides[0].elements.push({ ...deck.slides[0].elements[0], id: 'reset-frag', y: 320 })
  await prepare(page, request, id, deck)
  let before = await authoredSave(
    page,
    request,
    id,
    async () => {
      await authorActionUI(page, 's1-ans', null, {
        initialVisibility: 'hidden',
        fragment: true,
        fragmentIndex: 1,
      })
      await authorActionUI(page, 's1-btn', {
        kind: 'show',
        targetElementId: 's1-ans',
        label: 'Show fragment answer',
      })
      await authorActionUI(page, 'reset-frag', {
        kind: 'reset-slide',
        resetVariables: false,
        label: 'Reset fragment slide',
      })
    },
    (deck) =>
      element(deck, 'reset-frag')?.action?.label === 'Reset fragment slide' &&
      element(deck, 's1-ans')?.fragmentIndex === 1 &&
      element(deck, 's1-btn')?.action?.label === 'Show fragment answer'
  )
  await page.reload()
  await new EditorPage(page).waitForReady()
  await selectContent(page, 's1-ans')
  let after = await authoredSave(
    page,
    request,
    id,
    () => inspector(page).getByTestId('prop-fragment-index').fill('2'),
    (deck) => element(deck, 's1-ans')?.fragmentIndex === 2
  )
  expect(after).toEqual({
    ...before,
    slides: [
      {
        ...before.slides[0],
        elements: before.slides[0].elements.map((element) =>
          element.id === 's1-ans' ? { ...element, fragmentIndex: 2 } : element
        ),
      },
    ],
  })
  await assertHistoryRoundtrip(page, request, id, before, after)
  before = after
  await selectContent(page, 's1-btn')
  after = await authoredSave(
    page,
    request,
    id,
    () => fillControl(page, 'Action label', 'Show authored fragment answer'),
    (deck) => element(deck, 's1-btn')?.action?.label === 'Show authored fragment answer'
  )
  expect(after).toEqual({
    ...before,
    slides: [
      {
        ...before.slides[0],
        elements: before.slides[0].elements.map((element) =>
          element.id === 's1-btn'
            ? { ...element, action: { ...element.action, label: 'Show authored fragment answer' } }
            : element
        ),
      },
    ],
  })
  await assertHistoryRoundtrip(page, request, id, before, after)
  const { popup } = await launchPresentPopup(page)
  try {
    await popup.waitForFunction(() => window.Reveal?.isReady())
    const answer = target(popup, 's1', 's1-ans'),
      show = section(popup, 's1').getByRole('button', {
        name: 'Show authored fragment answer',
        exact: true,
      })
    await expect(answer).toBeHidden()
    await show.click()
    await expect(answer).toBeHidden()
    await navigatePresent(popup, 'ArrowRight', 's1')
    await expect(answer).toBeVisible()
    await section(popup, 's1')
      .getByRole('button', { name: 'Reset fragment slide', exact: true })
      .click()
    await expect(answer).toBeHidden()
    await show.click()
    await expect(answer).toBeHidden()
    await navigatePresent(popup, 'ArrowRight', 's1')
    await expect(answer).toBeVisible()
    await popup.screenshot({
      path: testInfo.outputPath('fragment-history-precedence.png'),
      fullPage: true,
    })
  } finally {
    await popup.close()
  }
})

for (const operation of ['paste', 'parent', 'child', 'detach']) {
  test(`reference ${operation}: complete graph, exact typed history and native Present target isolation`, async ({
    page,
    request,
    testPresentation,
  }, testInfo) => {
    const id = testPresentation.id
    await prepare(page, request, id)
    await authoredSave(
      page,
      request,
      id,
      async () => {
        await configureVariable(page, { name: 'Score Blue', initialValue: 2, min: 0, max: 10 })
        await authorActionUI(page, 's1-ans', null, { initialVisibility: 'hidden' })
        await authorActionUI(page, 's1-btn', {
          kind: 'show',
          targetElementId: 's1-ans',
          label: 'Show parent answer',
        })
      },
      (deck) =>
        deck.interactionVariables?.[0]?.name === 'Score Blue' &&
        element(deck, 's1-ans')?.initialVisibility === 'hidden' &&
        element(deck, 's1-btn')?.action?.label === 'Show parent answer'
    )
    await page.reload()
    await new EditorPage(page).waitForReady()
    const before = await typedState(request, id),
      parent = before.slides[0]
    const after = await authoredSave(
      page,
      request,
      id,
      async () => {
        if (operation === 'paste') await executeCopyPaste(page, ['s1-btn', 's1-ans'])
        if (operation === 'parent') await duplicateActiveSlide(page)
        if (operation === 'child') await duplicateActiveChildSlide(page)
        if (operation === 'detach') await detachSlideLayout(page)
      },
      (deck) =>
        operation === 'paste'
          ? deck.slides[0].elements.length === parent.elements.length + 2
          : operation === 'parent'
            ? deck.slides.length === 2
            : operation === 'child'
              ? deck.slides[0].children.length === 2
              : !deck.slides[0].layoutId
    )
    let copied,
      copiedSlide = 's1'
    if (operation === 'paste') {
      copied = after.slides[0].elements.slice(parent.elements.length)
      assertElementClone(copied, parent.elements, 20)
      expect(after).toEqual({
        ...before,
        slides: [{ ...parent, elements: [...parent.elements, ...copied] }],
      })
    } else if (operation === 'parent') {
      assertSlideClone(after.slides[1], parent)
      copied = after.slides[1].elements
      copiedSlide = after.slides[1].id
      expect(after).toEqual({ ...before, slides: [parent, after.slides[1]] })
    } else if (operation === 'child') {
      assertSlideClone(after.slides[0].children[1], parent.children[0])
      copied = after.slides[0].children[1].elements
      copiedSlide = after.slides[0].children[1].id
      expect(after).toEqual({
        ...before,
        slides: [{ ...parent, children: [parent.children[0], after.slides[0].children[1]] }],
      })
    } else {
      copied = after.slides[0].elements.slice(0, 2)
      const fixed = before.layoutMasters[0].fixedElements.map((element) => ({
        ...element,
        id: `layout-fixed:master-stem:${element.id}`,
        locked: false,
      }))
      assertElementClone(copied, fixed)
      const { layoutId, layoutOverrides, ...detached } = parent
      const owned = parent.elements.map((element) => {
        const copy = structuredClone(element)
        if (copy.action === null) delete copy.action
        return copy
      })
      expect(after).toEqual({
        ...before,
        slides: [{ ...detached, elements: [...copied, ...owned] }],
      })
    }
    await assertHistoryRoundtrip(page, request, id, before, after)
    await page.getByRole('button', { name: 'Select slide 1', exact: true }).click()
    const { popup } = await launchPresentPopup(page)
    try {
      await popup.waitForFunction(() => window.Reveal?.isReady())
      const original = target(popup, 's1', 's1-ans')
      await expect(original).toBeHidden()
      if (operation === 'child') {
        await navigatePresent(popup, 'ArrowDown', parent.children[0].id)
        const originalChild = target(popup, parent.children[0].id, 'c1-ans')
        await section(popup, parent.children[0].id)
          .getByRole('button', { name: 'Toggle child answer', exact: true })
          .press('Enter')
        await expect(originalChild).toBeVisible()
        await navigatePresent(popup, 'ArrowDown', copiedSlide)
        const copiedTarget = target(popup, copiedSlide, copied[1].id)
        await expect(copiedTarget).toBeHidden()
        await section(popup, copiedSlide)
          .getByRole('button', { name: 'Toggle child answer', exact: true })
          .press('Space')
        await expect(copiedTarget).toBeVisible()
        await section(popup, copiedSlide)
          .getByRole('button', { name: 'Toggle child answer', exact: true })
          .press('Enter')
        await expect(copiedTarget).toBeHidden()
        expect(await originalChild.evaluate((node) => node.hidden)).toBe(false)
        await navigatePresent(popup, 'ArrowUp', parent.children[0].id)
        await expect(originalChild).toBeVisible()
      } else {
        if (operation === 'parent') await navigatePresent(popup, 'ArrowRight', copiedSlide)
        const source = copied[0],
          copiedTarget = target(popup, copiedSlide, source.action.targetElementId)
        await expect(copiedTarget).toBeHidden()
        await section(popup, copiedSlide)
          .getByRole('button', { name: source.action.label, exact: true })
          .and(section(popup, copiedSlide).locator(`[data-ns-element-for="${source.id}"]`))
          .click()
        await expect(copiedTarget).toBeVisible()
        expect(await original.evaluate((node) => node.hidden)).toBe(true)
        if (operation === 'parent') await navigatePresent(popup, 'ArrowLeft', 's1')
        const originalSource = section(popup, 's1')
          .getByRole('button', { name: 'Show parent answer', exact: true })
          .and(section(popup, 's1').locator('[data-ns-element-for="s1-btn"]'))
        if (operation === 'paste') {
          await expect(originalSource).toHaveCount(1)
          await expect(originalSource).toBeVisible()
          await expect(originalSource).toBeEnabled()
          await originalSource.focus()
          await expect(originalSource).toBeFocused()
          await originalSource.press('Enter')
        } else await originalSource.click()
        await expect(original).toBeVisible()
        expect(await copiedTarget.evaluate((node) => node.hidden)).toBe(false)
      }
      await popup.screenshot({
        path: testInfo.outputPath(`reference-${operation}-runtime.png`),
        fullPage: true,
      })
    } finally {
      await popup.close()
    }
  })
}
