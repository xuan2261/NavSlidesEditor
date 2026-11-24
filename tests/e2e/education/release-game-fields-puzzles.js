import { expect } from '@playwright/test'
import { click, label } from './release-game-fields-harness.js'

export async function crosswordComplete(root, config) {
  const grid = root.getByRole('group', { name: 'Crossword grid', exact: true })
  await expect(grid).toHaveAttribute('data-rows', String(config.rows))
  await expect(grid).toHaveAttribute('data-columns', String(config.columns))
  for (const entry of config.entries) {
    await expect(
      root.getByRole('button', { name: new RegExp(`${entry.direction}: ${entry.clue}$`) })
    ).toBeVisible()
    for (const [offset, letter] of [...entry.answer].entries()) {
      const row = entry.row + (entry.direction === 'down' ? offset : 0)
      const column = entry.column + (entry.direction === 'across' ? offset : 0)
      await grid.locator(`input[data-row="${row}"][data-column="${column}"]`).fill(letter)
    }
  }
  await click(root, 'Check answers')
  await expect(root).toContainText('Crossword complete!')
  await click(root, 'Reset')
  for (const input of await grid.getByRole('textbox').all()) await expect(input).toHaveValue('')
}
export async function searchGrid(root) {
  const cells = root.getByRole('group', { name: 'Word search grid', exact: true }).locator('button')
  await expect(cells.first()).toBeVisible()
  return cells.evaluateAll((nodes) =>
    nodes.map((node) => ({
      row: Number(node.dataset.row),
      column: Number(node.dataset.column),
      text: node.textContent,
    }))
  )
}
export async function searchComplete(root, config) {
  const grid = root.getByRole('group', { name: 'Word search grid', exact: true })
  await expect(grid).toHaveAttribute('data-rows', String(config.rows))
  await expect(grid).toHaveAttribute('data-columns', String(config.columns))
  const cells = await searchGrid(root)
  const vectors = {
    E: [0, 1],
    W: [0, -1],
    N: [-1, 0],
    S: [1, 0],
    NE: [-1, 1],
    NW: [-1, -1],
    SE: [1, 1],
    SW: [1, -1],
  }
  for (const word of config.words) {
    let path
    for (const cell of cells)
      for (const direction of config.directions) {
        const [dr, dc] = vectors[direction]
        const candidate = [...word.text].map((_, index) =>
          cells.find(
            (next) => next.row === cell.row + dr * index && next.column === cell.column + dc * index
          )
        )
        if (candidate.every(Boolean) && candidate.map((part) => part.text).join('') === word.text)
          path = candidate
      }
    expect(
      path,
      `Authored word ${word.text} must appear along an allowed visible grid path`
    ).toBeDefined()
    if (word.id === config.words[0].id) {
      const start = grid.locator(`[data-row="${path[0].row}"][data-column="${path[0].column}"]`)
      const end = grid.locator(
        `[data-row="${path.at(-1).row}"][data-column="${path.at(-1).column}"]`
      )
      await start.click()
      await expect(start).toHaveAttribute('aria-pressed', 'true')
      await end.click()
      await expect(end).toHaveAttribute('aria-pressed', 'true')
      await click(root, 'Submit selected path')
    } else {
      await label(root, 'Word for coordinate selection').selectOption(word.id)
      for (const [name, value] of [
        ['Start row', path[0].row + 1],
        ['Start column', path[0].column + 1],
        ['End row', path.at(-1).row + 1],
        ['End column', path.at(-1).column + 1],
      ])
        await label(root, name).fill(String(value))
      await click(root, 'Submit coordinates')
    }
    await expect(root.locator('li').filter({ hasText: word.text })).toHaveCSS(
      'text-decoration-line',
      'line-through'
    )
  }
  await expect(root).toContainText('All words found!')
  return cells
}
export async function beforeSearch(page) {
  await click(page, 'Try game')
  const dialog = page.getByRole('dialog', { name: 'Try game', exact: true })
  const cells = await searchGrid(dialog.locator('[data-ns-game]'))
  await dialog.getByRole('button', { name: /^Close/ }).click()
  return cells
}
