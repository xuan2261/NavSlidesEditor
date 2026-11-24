import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { selectContent, fillControl, inspector } from './release-content-fields.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { authorActionUI, referenceDeck, assertHistoryRoundtrip, navigatePresent, authoredSave } from './trigger-reference-history-controls.js'
import { prepare, section, target, element } from './trigger-reference-history-fixture.js'
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
