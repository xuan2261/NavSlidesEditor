import {
  test,
  expect,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { downloadArtifact, freshPortable } from './release-surfaces.js'
import { completeMapping } from './mapping-modalities-interactions.js'
import { observe } from './release-observations.js'

for (const type of ['matching', 'sorting', 'ordering']) {
  for (const mode of ['pointer', 'touch', 'click', 'keyboard']) {
    for (const surface of ['present', 'file']) {
      const gameType = type === 'ordering' ? 'quiz' : type
      test(`${type} ${mode} assignment grades and resets without slide navigation on ${surface} [cap:game.${gameType}.${surface}]`, async ({
        page,
        request,
        browser,
        testPresentation,
      }, testInfo) => {
        const fixture = gameFixture(gameType, type === 'ordering' ? 'ordering' : null)
        const config = fixture[gameType]
        if (type === 'ordering') config.questions[0].options.reverse()
        if (type !== 'matching') config.attemptLimit = 2
        const authored = deckWith([fixture])
        authored.slides.push({ id: 'mapping-next-slide', elements: [] })
        await apiUpdatePresentation(request, testPresentation.id, authored)
        await new EditorPage(page).gotoPresentation(testPresentation.id)
        const savedBeforePlay = (await apiGetPresentation(request, testPresentation.id)).slides
        let target, popup, portable, file
        try {
          if (surface === 'present') {
            ;({ popup } = await launchPresentPopup(page))
            target = popup
            await target.waitForFunction(() => window.Reveal?.isReady())
          } else {
            file = await downloadArtifact(
              page,
              testInfo,
              'Export HTML',
              `${type}-${mode}-portable.html`
            )
            portable = await freshPortable(browser, file)
            target = portable.page
          }
          const root = target.locator(`[data-ns-game][data-ns-element-id="${fixture.id}"]`)
          await expect(root).toBeVisible()
          const observed = await completeMapping(root, type, config, mode)
          if (portable) observed.network = await portable.inspectNetwork()
          const savedAfterPlay = (await apiGetPresentation(request, testPresentation.id)).slides
          expect(savedAfterPlay).toEqual(savedBeforePlay)
          observed.savedSlides = savedAfterPlay
          await observe(
            testInfo,
            target,
            {
              element: 'game',
              gameType,
              questionKind: type === 'ordering' ? 'ordering' : null,
              surface,
            },
            surface === 'file' ? 'offline-complete-reset' : 'complete-reset',
            {
              modality: mode,
              assignment:
                type === 'ordering'
                  ? config.questions[0].answerKey.itemIds
                  : type === 'matching'
                    ? config.pairs
                    : config.answerKey.assignments,
              score:
                type === 'matching'
                  ? config.pairs.length
                  : type === 'sorting'
                    ? config.points
                    : config.questions[0].points,
              resetAssignment:
                type === 'ordering'
                  ? config.questions[0].options.map((item) => item.id)
                  : config[type === 'matching' ? 'pairs' : 'items'].map(() => ''),
              revealIndices: { h: 0, v: 0 },
              network:
                surface === 'file'
                  ? 'No HTTP(S), sockets or page errors.'
                  : 'Generated localhost Present.',
            },
            observed,
            file ? [file] : []
          )
        } finally {
          try {
            await popup?.close()
          } finally {
            await portable?.context.close()
          }
        }
      })
    }
  }
}
