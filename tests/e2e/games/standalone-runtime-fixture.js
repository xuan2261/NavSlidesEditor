import shared from 'revealjs-shared'
import { expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
export { local, inherited, hostileLabel, author, readState, waitReady, pick }
const local = '[data-ns-effective-slide-id="parent"] [data-ns-element-id="local"]'
const inherited = 'layout-fixed:lesson:inherited'
const hostileLabel = 'An & Tiếng Việt </ScRiPt> "quote" \\'
const game = (id, x) => ({
  id,
  type: 'game',
  gameType: 'name-picker',
  x,
  y: 20,
  width: 430,
  height: 490,
  'name-picker': {
    ...shared.createDefaultGameConfig('name-picker'),
    animationDuration: 700,
    weighted: true,
    excludeAfterPick: true,
    items: [
      { id: 'a', label: hostileLabel, weight: 1 },
      { id: 'b', label: 'Bình', weight: 3 },
      { id: 'c', label: 'Chi', weight: 2 },
    ],
  },
})

async function author(request, presentation) {
  return apiUpdatePresentation(request, presentation.id, {
    ...presentation,
    theme: 'white',
    layoutMasters: [
      { id: 'lesson', name: 'Lesson', fixedElements: [game('inherited', 510)], placeholders: [] },
    ],
    slides: [
      {
        id: 'parent',
        layoutId: 'lesson',
        elements: [game('local', 20)],
        children: [{ id: 'child', layoutId: 'lesson', elements: [] }],
      },
      { id: 'second', layoutId: 'lesson', elements: [] },
      {
        id: 'hidden',
        layoutId: 'lesson',
        elements: [],
        layoutOverrides: { elementPatches: { inherited: { hidden: true } } },
      },
    ],
  })
}

const readState = (page, slide, element) =>
  page.evaluate(
    ({ slide, element }) => {
      const root = [...document.querySelectorAll('[data-ns-game]')].find(
        (node) =>
          node.dataset.nsElementId === element &&
          node.closest('[data-ns-effective-slide-id]').dataset.nsEffectiveSlideId === slide
      )
      return NavSlidesEducation.mount(root).getState()
    },
    { slide, element }
  )

async function waitReady(page) {
  await page.waitForFunction(() => typeof NavSlidesEducation !== 'undefined' && Reveal.isReady())
}

async function pick(page, selector = local) {
  await page.locator(`${selector} [data-ns-command="pick"]`).click()
  await expect
    .poll(() =>
      page.locator(selector).evaluate((root) => NavSlidesEducation.mount(root).getState().phase)
    )
    .toMatch(/^(result|exhausted)$/)
}
