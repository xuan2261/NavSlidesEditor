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
          await touch.tap(across)
          await active.keyboard.insertText('HOC')
          await touch.tap(down)
          await active.keyboard.insertText('HEN')
          await touch.tap(button(crossword, 'Check answers'))
          expect(await stateOf(crossword)).toMatchObject({
            foundIds: [],
            completed: false,
            lastResult: 'incorrect',
          })
          await touch.tap(across)
          await active.keyboard.press('ControlOrMeta+A')
          await active.evaluate(() => {
            window.__puzzleComposition = []
            for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'input'])
              document.addEventListener(
                type,
                (event) => {
                  if (!event.target.matches('input[data-row]')) return
                  window.__puzzleComposition.push({
                    type,
                    trusted: event.isTrusted,
                    data: event.data,
                    composing: event.isComposing,
                    row: event.target.dataset.row,
                    column: event.target.dataset.column,
                  })
                },
                true
              )
          })
          const beforeComposition = await stateOf(crossword)
          const decomposed = 'ho\u0323c'
          await ime.send('Input.imeSetComposition', {
            text: decomposed,
            selectionStart: decomposed.length,
            selectionEnd: decomposed.length,
          })
          expect(await stateOf(crossword)).toEqual(beforeComposition)
          await ime.send('Input.insertText', { text: decomposed })
          await expect(grid.locator('input[data-row="0"][data-column="0"]')).toHaveValue('H')
          await expect(grid.locator('input[data-row="0"][data-column="1"]')).toHaveValue('Ọ')
          await expect(grid.locator('input[data-row="0"][data-column="2"]')).toHaveValue('C')
          await touch.tap(button(crossword, 'Check answers'))
          expect(await stateOf(crossword)).toMatchObject({ foundIds: ['learn'], completed: false })
          await touch.tap(down)
          await active.keyboard.press('ControlOrMeta+A')
          await active.keyboard.insertText('HẸN')
          await touch.tap(button(crossword, 'Check answers'))
          const completedCrossword = await stateOf(crossword)
          expect(completedCrossword).toMatchObject({ foundIds: ['learn', 'meet'], completed: true })
          for (const input of await grid.locator('input').all())
            await expect(input).toHaveAttribute('readonly', '')
          await touch.tap(button(crossword, 'Check answers'))
          expect(await stateOf(crossword)).toEqual(completedCrossword)
          const composition = await active.evaluate(() => window.__puzzleComposition)
          expect(composition).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: 'compositionstart',
                trusted: true,
                row: '0',
                column: '0',
              }),
              expect.objectContaining({
                type: 'compositionupdate',
                trusted: true,
                data: decomposed,
                row: '0',
                column: '0',
              }),
              expect.objectContaining({
                type: 'input',
                trusted: true,
                composing: true,
                data: decomposed,
                row: '0',
                column: '0',
              }),
              // Native CDP insertText and blur commits emit an untrusted end in the qualification Chromium.
              expect.objectContaining({
                type: 'compositionend',
                data: decomposed,
                row: '0',
                column: '0',
              }),
            ])
          )
          await touch.tap(button(crossword, 'Reset'))
          for (const input of await grid.locator('input').all()) await expect(input).toHaveValue('')
          expect(await stateOf(crossword)).toMatchObject({ foundIds: [], completed: false })

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
