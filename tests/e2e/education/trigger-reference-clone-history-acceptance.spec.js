import { test, expect } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import {
  authorActionUI, configureVariable, executeCopyPaste, duplicateActiveSlide,
  duplicateActiveChildSlide, detachSlideLayout, typedState, assertElementClone,
  assertSlideClone, assertHistoryRoundtrip, navigatePresent, authoredSave,
} from './trigger-reference-history-controls.js'
import { prepare, section, target, element } from './trigger-reference-history-fixture.js'
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
