import {
  test,
  expect,
  apiGetPresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameFixture, deckWith } from './release-game-fixtures.js'
import { visitGeneratedSurfaces } from './release-surfaces.js'
import { searchGrid } from './release-game-fields-puzzles.js'
import { observedTouch } from './native-touch-observations.js'
import { observe } from './release-observations.js'
import { completeCrosswordWithIme } from './puzzle-crossword-ime-interactions.js'

const stateOf = (root) => root.evaluate((node) => window.NavSlidesEducation.mount(node).getState())
const button = (root, name) => root.getByRole('button', { name, exact: true })
function puzzleDeck() {
  const crossword = { ...gameFixture('crossword'), x: 15, y: 15, width: 450, height: 510 }
  crossword.crossword = {
    ...crossword.crossword,
    rows: 5,
    columns: 5,
    entries: [
      { id: 'learn', answer: 'HỌC', clue: 'Learning', row: 0, column: 0, direction: 'across' },
      { id: 'meet', answer: 'HẸN', clue: 'Meeting', row: 0, column: 0, direction: 'down' },
    ],
  }
  const search = { ...gameFixture('word-search'), x: 495, y: 15, width: 450, height: 510 }
  search['word-search'] = {
    ...search['word-search'],
    rows: 5,
    columns: 5,
    seed: 44,
    words: [
      { id: 'learn', text: 'HỌC' },
      { id: 'read', text: 'ĐỌC' },
    ],
    alphabet: 'X',
    directions: ['E', 'S', 'SE'],
  }
  return { deck: deckWith([crossword, search]), config: search['word-search'] }
}
function visiblePaths(cells, config) {
  const vectors = { E: [0, 1], S: [1, 0], SE: [1, 1] }
  return config.words.map((word) => {
    for (const cell of cells)
      for (const direction of config.directions) {
        const [dr, dc] = vectors[direction]
        const path = [...word.text].map((_, offset) =>
          cells.find(
            (next) =>
              next.row === cell.row + offset * dr && next.column === cell.column + offset * dc
          )
        )
        if (path.every(Boolean) && path.map((part) => part.text).join('') === word.text)
          return { id: word.id, text: word.text, direction, path }
      }
    throw new Error(`Authored Vietnamese word is missing from the visible grid: ${word.text}`)
  })
}

for (const selectedSurface of ['present', 'share', 'file'])
  test(`Vietnamese puzzles accept native CDP touch and IME graphemes, reject missing accents, retry, complete once and reset the same layout on ${selectedSurface}`, async ({
    page,
    request,
    browser,
    testPresentation,
  }, testInfo) => {
    const { deck, config } = puzzleDeck()
    await apiUpdatePresentation(request, testPresentation.id, deck)
    await new EditorPage(page).gotoPresentation(testPresentation.id)
    const saved = await apiGetPresentation(request, testPresentation.id)
    await visitGeneratedSurfaces(
      { page, request, browser, id: testPresentation.id, testInfo, surfaces: [selectedSurface] },
      async (active, surface, artifacts) => {
        await active.setViewportSize({ width: 768, height: 1024 })
        const touch = await observedTouch(active),
          ime = await active.context().newCDPSession(active)
        const crossword = active.locator('[data-ns-game][data-ns-element-id="release-crossword"]')
        const search = active.locator('[data-ns-game][data-ns-element-id="release-word-search"]')
        const grid = crossword.getByRole('group', { name: 'Crossword grid', exact: true })
        const across = crossword.getByRole('button', { name: /across: Learning$/ })
        const down = crossword.getByRole('button', { name: /down: Meeting$/ })
        try {
          const { completedCrossword, composition } =
            await completeCrosswordWithIme(touch, active, across, down, crossword, grid, ime)

          const cells = await searchGrid(search),
            paths = visiblePaths(cells, config)
          const cell = (part) =>
            search.locator(`[data-row="${part.row}"][data-column="${part.column}"]`)
          await touch.tap(cell(paths[0].path[0]))
          await touch.tap(button(search, 'Submit selected path'))
          expect(await stateOf(search)).toMatchObject({
            foundIds: [],
            completed: false,
            lastResult: 'incorrect',
          })
          const solve = async () => {
            for (const entry of paths) {
              await touch.tap(cell(entry.path[0]))
              await touch.tap(cell(entry.path.at(-1)))
              await touch.tap(button(search, 'Submit selected path'))
              const authoredWord = search
                .locator('[data-ns-game-ui]')
                .getByRole('list')
                .getByText(entry.text, { exact: true })
              await expect(authoredWord).toHaveCount(1)
              await expect(authoredWord).toBeVisible()
              await expect(authoredWord).toHaveCSS('text-decoration-line', 'line-through')
            }
            expect(await stateOf(search)).toMatchObject({
              foundIds: ['learn', 'read'],
              completed: true,
            })
          }
          await solve()
          const completedSearch = await stateOf(search)
          await touch.tap(cell(paths[0].path[0]))
          await touch.tap(cell(paths[0].path.at(-1)))
          await touch.tap(button(search, 'Submit selected path'))
          expect((await stateOf(search)).foundIds).toEqual(completedSearch.foundIds)
          await touch.tap(button(search, 'Reset'))
          expect(await searchGrid(search)).toEqual(cells)
          expect(await stateOf(search)).toMatchObject({ foundIds: [], completed: false })
          await solve()
          await touch.tap(button(search, 'Reset'))
          expect(await searchGrid(search)).toEqual(cells)
          expect(await active.evaluate(() => window.Reveal.getIndices())).toMatchObject({
            h: 0,
            v: 0,
          })
          expect(await apiGetPresentation(request, testPresentation.id)).toEqual(saved)
          const inputs = await touch.events()
          for (const gameType of ['crossword', 'word-search'])
            await observe(
              testInfo,
              active,
              { element: 'game', gameType, surface },
              surface === 'file' ? 'offline-complete-reset' : 'complete-reset',
              {
                modality: 'trusted CDP touch and native Chromium CDP IME',
                missingAccentsRejected: true,
                compositionDoesNotCommitEarly: true,
                canonicalGraphemes: ['H', 'Ọ', 'C'],
                completedEntries: 2,
                resetPreservesGrid: true,
                duplicateAward: false,
              },
              {
                completedCrossword,
                completedSearch,
                composition,
                paths,
                cells,
                inputs,
                savedConfig: saved.slides,
              },
              artifacts
            )
        } finally {
          try {
            await ime.detach()
          } finally {
            await touch.close()
          }
        }
      }
    )
  })
