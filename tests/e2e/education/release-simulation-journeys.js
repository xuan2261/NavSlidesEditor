import { test, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import presets from '../../../shared/src/education/presets/simulations.js'
import { deckWith } from './release-game-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { findFrame, visitGeneratedSurfaces } from './release-surfaces.js'
import { interactSimulation, simulationProbe } from './release-simulation-interactions.js'
import { observe } from './release-observations.js'

export function registerSimulationJourneys() {
  for (const preset of presets.SIMULATION_PRESETS) {
    test(`${preset.id} authored physical interaction and control reset survive Share and downloaded file isolation`, async ({
      page,
      request,
      browser,
      testPresentation,
    }, testInfo) => {
      test.setTimeout(180000)
      await apiUpdatePresentation(
        request,
        testPresentation.id,
        deckWith(structuredClone(preset.elements))
      )
      await new EditorPage(page).gotoPresentation(testPresentation.id)
      await visitGeneratedSurfaces(
        { page, request, browser, id: testPresentation.id, testInfo },
        async (surfacePage, surface, artifacts, network) => {
          const frame = await findFrame(surfacePage, simulationProbe[preset.id])
          const observed = await interactSimulation(frame, preset.id)
          if (surface === 'share') return
          await observe(
            testInfo,
            surfacePage,
            { element: 'html', presetId: preset.id, surface },
            surface === 'file' ? 'offline-interact-reset' : 'interact-reset',
            {
              physicalControlInteraction: true,
              restoredAuthoredControls: true,
              externalResources: false,
            },
            { ...observed, ...(network ? { network } : {}) },
            artifacts
          )
        }
      )
    })
  }
}
