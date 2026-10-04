import { expect, apiGetPresentation } from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { cloneProjection } from './release-clone-observations.js'

export async function savedElements(request, id) {
  return (await apiGetPresentation(request, id)).slides[0].elements
}

export async function authorHistory(page, request, id, original, mutate, expected) {
  const editor = new EditorPage(page)
  await editor.gotoPresentation(id)
  const target = page.getByTestId(`slide-element-${original.id}`)
  const selectTarget = async () => {
    await target.focus()
    if ((await target.getAttribute('data-selected')) !== 'true') await target.press('Enter')
    await expect(target).toHaveAttribute('data-selected', 'true')
    await target.focus()
    await expect(target).toBeFocused()
  }
  await selectTarget()
  await mutate(page)
  await expect.poll(() => savedElements(request, id)).toEqual([expected])
  await selectTarget()
  await editor.undo()
  await expect.poll(() => savedElements(request, id)).toEqual([original])
  await editor.redo()
  await expect.poll(() => savedElements(request, id)).toEqual([expected])
  await selectTarget()
  await editor.duplicateElement()
  await expect.poll(async () => (await savedElements(request, id)).length).toBe(2)
  let clone
  await expect
    .poll(async () => {
      clone = (await savedElements(request, id)).find((element) => element.id !== original.id)
      return clone ? cloneProjection(clone).content : null
    })
    .toEqual(cloneProjection(expected).content)
  expect(clone.id).not.toBe(original.id)
  if (original.type === 'game') {
    const originalIds = new Set(cloneProjection(expected).ownedIds)
    expect(
      cloneProjection(clone).ownedIds.filter((id) => originalIds.has(id)),
      'Duplicated native configuration must own fresh identities rather than alias the source graph'
    ).toEqual([])
  }
  await selectTarget()
  await editor.undo()
  await expect.poll(() => savedElements(request, id)).toEqual([expected])
  await expect(page.locator('.element-wrapper')).toHaveCount(1)
  await page.reload()
  await editor.waitForReady()
  expect(await savedElements(request, id)).toEqual([expected])
  return {
    persisted: expected,
    cloned: clone,
    undoRestored: original,
    reloaded: await savedElements(request, id),
  }
}

export async function mutateGameTitle(page, type) {
  if (type === 'name-picker') {
    await page.getByRole('textbox', { name: 'Item 1 label', exact: true }).fill('Authored winner')
  } else {
    await page
      .getByRole('tablist', { name: 'Game property sections', exact: true })
      .getByRole('tab', { name: 'Display', exact: true })
      .click()
    await page
      .getByRole('textbox', { name: 'Game title', exact: true })
      .fill('Release authored title')
  }
  await page.getByTestId('canvas-area').click({ position: { x: 10, y: 10 } })
}
