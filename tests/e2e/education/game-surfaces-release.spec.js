import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'
import { gameCases, gameFixture, deckWith } from './release-game-fixtures.js'
import { authorHistory, mutateGameTitle, savedElements } from './release-author-history.js'
import { completeGame } from './release-game-interactions.js'
import { visitGeneratedSurfaces } from './release-surfaces.js'
import { observe } from './release-observations.js'
import { registerNativePresetJourneys } from './release-native-preset-journeys.js'

for (const { type, kind } of gameCases()) {
  test(`native ${type}${kind ? ` ${kind}` : ''} author history and Try Present Share downloaded-file complete/reset`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    test.setTimeout(180000)
    const fixture = gameFixture(type, kind)
    if (type === 'name-picker') fixture[type].items[0].label = 'Initial choice'
    await apiUpdatePresentation(request, testPresentation.id, deckWith([fixture]))
    const original = (await savedElements(request, testPresentation.id))[0]
    const authored = structuredClone(original)
    if (type === 'name-picker') authored[type].items[0].label = 'Authored winner'
    else authored[type].title = 'Release authored title'
    const history = await authorHistory(
      page,
      request,
      testPresentation.id,
      original,
      (page) => mutateGameTitle(page, type),
      authored
    )
    const identity = { element: 'game', gameType: type, questionKind: kind }
    await observe(
      testInfo,
      page,
      { ...identity, surface: 'editor' },
      'author-save-reload-undo-duplicate',
      { original, authored, distinctCloneIdentity: true },
      history
    )
    await page.getByTestId(`slide-element-${fixture.id}`).click({ position: { x: 5, y: 5 } })
    await expect(page.locator('[data-ns-editor-canvas] [data-ns-game-ui] button')).toHaveCount(0)
    await page.getByRole('button', { name: 'Try game', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Try game', exact: true })
    const tried = await completeGame(dialog.locator('[data-ns-game]'), type, authored[type])
    await observe(
      testInfo,
      page,
      { ...identity, surface: 'try' },
      'complete-reset',
      { completedWithAuthoredContent: true, resetRestoresInitialState: true },
      tried
    )
    if (type === 'quiz' && kind === 'single-choice')
      await observe(
        testInfo,
        page,
        { element: 'game', surface: 'try' },
        'lifecycle-score-reset',
        {
          authoredHistoryRestored: true,
          answerEvaluated: true,
          earnedPoints: 10,
          resetRestoresInitialState: true,
        },
        { history, tried }
      )
    await dialog.getByRole('button', { name: /^Close/ }).click()
    await visitGeneratedSurfaces(
      { page, request, browser, id: testPresentation.id, testInfo },
      async (surfacePage, surface, artifacts, network) => {
        const root = surfacePage.locator(`[data-ns-game][data-ns-element-id="${fixture.id}"]`)
        const result = await completeGame(root, type, authored[type])
        await observe(
          testInfo,
          surfacePage,
          { ...identity, surface },
          surface === 'file' ? 'offline-complete-reset' : 'complete-reset',
          {
            completedWithAuthoredContent: true,
            resetRestoresInitialState: true,
            noNetwork: surface === 'file',
          },
          { ...result, ...(network ? { network } : {}) },
          artifacts
        )
      }
    )
  })
}
registerNativePresetJourneys()
