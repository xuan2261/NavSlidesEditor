import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import {
  CANONICAL_ELEMENTS,
  ordinaryFixture,
  ordinaryMutations,
} from './release-ordinary-fixtures.js'
import { deckWith } from './release-game-fixtures.js'
import { authorHistory, savedElements } from './release-author-history.js'
import { inspectOrdinary } from './release-ordinary-observers.js'
import { visitGeneratedSurfaces } from './release-surfaces.js'
import { observe } from './release-observations.js'
import { registerSimulationJourneys } from './release-simulation-journeys.js'

for (const type of CANONICAL_ELEMENTS) {
  test(`canonical ${type} inspector mutation survives undo clone save reload and actual output surfaces`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    test.setTimeout(180000)
    await apiUpdatePresentation(request, testPresentation.id, deckWith([ordinaryFixture(type)]))
    const original = (await savedElements(request, testPresentation.id))[0]
    const [field, label, value, control] = ordinaryMutations[type]
    const authored = { ...original, [field]: value }
    const history = await authorHistory(
      page,
      request,
      testPresentation.id,
      original,
      async (page) => {
        const panel = page.getByRole('complementary', { name: 'Properties panel', exact: true })
        const input = panel.getByLabel(label, { exact: true })
        if (control === 'select') await input.selectOption(String(value))
        else if (control === 'range') {
          await input.press('Home')
          const { min, step } = await input.evaluate((node) => ({
            min: Number(node.min || 0),
            step: Number(node.step || 1),
          }))
          for (let next = min; next < value; next += step) await input.press('ArrowRight')
          await expect(input).toHaveValue(String(value))
        } else await input.fill(String(value))
        await input.blur()
      },
      authored
    )
    await observe(
      testInfo,
      page,
      { element: type, surface: 'editor' },
      'author-save-reload-undo-duplicate',
      { authoredValue: value, field, undoValue: original[field], cloneHasDistinctIdentity: true },
      history
    )
    const canvas = page.getByTestId(`slide-element-${authored.id}`)
    const canvasObserved = await inspectOrdinary(page, canvas, authored, 'canvas')
    if (type !== 'game')
      await observe(
        testInfo,
        page,
        { element: type, surface: 'editor' },
        `field:${field}`,
        { field, authoredValue: value, renderedAuthoredContent: true },
        { ...history, rendered: canvasObserved }
      )
    await observe(
      testInfo,
      page,
      { element: type, surface: 'canvas' },
      'render',
      { retainedAuthoredContent: authored },
      canvasObserved
    )
    await visitGeneratedSurfaces(
      { page, request, browser, id: testPresentation.id, testInfo },
      async (surfacePage, surface, artifacts, network) => {
        const result = await inspectOrdinary(
          surfacePage,
          surfacePage.locator('.reveal .slides section.present').last(),
          authored,
          surface
        )
        await observe(
          testInfo,
          surfacePage,
          { element: type, surface },
          surface === 'file' ? 'offline-render' : 'render',
          { renderedAuthoredContent: authored, noNetwork: surface === 'file' },
          { rendered: result, ...(network ? { network } : {}) },
          artifacts
        )
      }
    )
  })
}
registerSimulationJourneys()
