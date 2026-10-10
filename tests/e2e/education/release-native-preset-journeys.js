import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import catalog from '../../../shared/src/education/presets/catalog.js'
import { EditorPage } from '../pages/editor-page.js'
import { deckWith } from './release-game-fixtures.js'
import { savedElements } from './release-author-history.js'
import { completeGame } from './release-game-interactions.js'
import { visitGeneratedSurfaces } from './release-surfaces.js'
import { observe } from './release-observations.js'

export function registerNativePresetJourneys() {
  for (const preset of catalog.EDUCATION_PRESETS.filter(
    (preset) => preset.category !== 'simulations'
  )) {
    test(`${preset.id} actual cloned preset authoring data completes and resets in Present and downloaded file`, async ({
      page,
      request,
      browser,
      testPresentation,
    }, testInfo) => {
      test.setTimeout(300000)
      const { elements } = catalog.cloneEducationPreset(preset)
      await apiUpdatePresentation(request, testPresentation.id, deckWith(elements))
      await new EditorPage(page).gotoPresentation(testPresentation.id)
      const persisted = await savedElements(request, testPresentation.id)
      expect(persisted.map((element) => element.id)).toEqual(elements.map((element) => element.id))
      for (const element of elements) {
        const saved = persisted.find((saved) => saved.id === element.id)
        expect(
          saved[saved.gameType],
          'Saving a cloned preset must preserve its authored configuration'
        ).toEqual(element[element.gameType])
      }
      await visitGeneratedSurfaces(
        { page, request, browser, id: testPresentation.id, testInfo },
        async (surfacePage, surface, artifacts, network) => {
          if (surface === 'share') return
          const actual = []
          for (const element of persisted) {
            if (element.type !== 'game')
              throw new Error(`Native preset ${preset.id} requires a real native game`)
            const root = surfacePage.locator(`[data-ns-game][data-ns-element-id="${element.id}"]`)
            const config = element[element.gameType]
            expect(
              JSON.parse(await root.locator('script[data-ns-game-config]').textContent()),
              'Generated native play must use the saved authored preset configuration'
            ).toEqual(config)
            const result = await completeGame(root, element.gameType, config)
            actual.push({ id: element.id, gameType: element.gameType, ...result })
          }
          await observe(
            testInfo,
            surfacePage,
            { element: preset.elements[0].type, presetId: preset.id, surface },
            surface === 'file' ? 'offline-interact-reset' : 'interact-reset',
            {
              actualPresetDataUsed: true,
              completedWithAuthoredConfig: true,
              resetRestoresInitialState: true,
            },
            { games: actual, ...(network ? { network } : {}) },
            artifacts
          )
        }
      )
    })
  }
}
