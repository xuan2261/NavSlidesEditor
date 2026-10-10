import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { deckWith } from './release-game-fixtures.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import {
  referenceDeck,
  authorActionUI,
  authoredSave,
  typedState,
  detachSlideLayout,
  assertElementClone,
  assertHistoryRoundtrip,
} from './trigger-reference-history-controls.js'

const section = (popup) => popup.locator('[data-ns-effective-slide-id="s1"]')
const target = (popup, id) => section(popup).locator(`[data-ns-element-id="${id}"]`)
const source = (popup) =>
  section(popup)
    .getByRole('button', { name: 'Reveal inherited answer from local source', exact: true })
    .and(section(popup).locator('[data-ns-element-for="local-fixed-trigger"]'))
async function verifyTarget(page, id, testInfo, stage) {
  const { popup } = await launchPresentPopup(page)
  try {
    await popup.waitForFunction(() => window.Reveal?.isReady())
    const inherited = target(popup, id),
      unrelated = target(popup, 's1-ans')
    await expect(inherited).toBeHidden()
    await expect(unrelated).toBeHidden()
    await source(popup).click()
    await expect(inherited).toBeVisible()
    await expect(unrelated).toBeHidden()
    await popup.screenshot({
      path: testInfo.outputPath(`local-fixed-${stage}.png`),
      fullPage: true,
    })
  } finally {
    await popup.close()
  }
}

test('local-to-inherited reference materializes a fresh target through UI detach and exact raw history', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const id = testPresentation.id,
    authored = referenceDeck(),
    effectiveId = 'layout-fixed:master-stem:fixed-answer'
  authored.slides[0].elements.push({
    ...authored.slides[0].elements[0],
    id: 'local-fixed-trigger',
    y: 350,
  })
  await apiUpdatePresentation(request, id, { ...deckWith([]), ...authored })
  await new EditorPage(page).gotoPresentation(id)
  await authoredSave(
    page,
    request,
    id,
    async () => {
      await authorActionUI(page, 's1-ans', null, { initialVisibility: 'hidden' })
      await authorActionUI(page, 'local-fixed-trigger', {
        kind: 'show',
        targetElementId: effectiveId,
        label: 'Reveal inherited answer from local source',
      })
    },
    (deck) =>
      deck.slides[0].elements.find((element) => element.id === 'local-fixed-trigger')?.action
        ?.targetElementId === effectiveId &&
      deck.slides[0].elements.find((element) => element.id === 's1-ans')?.initialVisibility ===
        'hidden'
  )
  await page.reload()
  await new EditorPage(page).waitForReady()
  const before = await typedState(request, id),
    parent = before.slides[0]
  const local = parent.elements.find((element) => element.id === 'local-fixed-trigger')
  expect(local.action).toEqual({
    kind: 'show',
    targetElementId: effectiveId,
    label: 'Reveal inherited answer from local source',
  })
  await verifyTarget(page, effectiveId, testInfo, 'inherited')
  const after = await authoredSave(
    page,
    request,
    id,
    () => detachSlideLayout(page),
    (deck) => !deck.slides[0].layoutId
  )
  const copied = after.slides[0].elements.slice(0, 2)
  const fixed = before.layoutMasters[0].fixedElements.map((element) => ({
    ...element,
    id: `layout-fixed:master-stem:${element.id}`,
    locked: false,
  }))
  assertElementClone(copied, fixed)
  const newTargetId = copied[1].id
  const owned = parent.elements.map((element) => {
    const copy = structuredClone(element)
    if (copy.action === null) delete copy.action
    if (copy.id === local.id) copy.action.targetElementId = newTargetId
    return copy
  })
  const { layoutId, layoutOverrides, ...detached } = parent
  expect(after).toEqual({ ...before, slides: [{ ...detached, elements: [...copied, ...owned] }] })
  expect(after.slides[0].elements.find((element) => element.id === local.id)).toEqual({
    ...local,
    action: { ...local.action, targetElementId: newTargetId },
  })
  await assertHistoryRoundtrip(page, request, id, before, after)
  await page.getByRole('button', { name: 'Select slide 1', exact: true }).click()
  await verifyTarget(page, newTargetId, testInfo, 'materialized')
})
