import { expect } from '../fixtures/test-fixtures.js'

const stateOf = (root) => root.evaluate((node) => window.NavSlidesEducation.mount(node).getState())
const button = (root, name) => root.getByRole('button', { name, exact: true })

export async function completeCrosswordWithIme(touch, active, across, down, crossword, grid, ime) {
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
  return { completedCrossword, composition }
}
