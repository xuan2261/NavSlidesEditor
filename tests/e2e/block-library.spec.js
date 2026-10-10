import shared from 'revealjs-shared'
import { test, expect, apiGetPresentation } from './fixtures/test-fixtures.js'
import { EditorPage } from './pages/editor-page.js'
import { recordScenario } from './education/release-evidence-adapter.js'
import { loadRequiredCells } from '../../scripts/feature-inventory/education-release-policy.mjs'
import { ELEMENT_DEFAULTS } from '../../client/src/data/element-defaults.js'

const { EDUCATION_PRESETS } = shared

let requiredCells
test.beforeAll(async () => {
  requiredCells = await loadRequiredCells(undefined, ELEMENT_DEFAULTS)
})

function ownedIds(value, result = new Set()) {
  if (!value || typeof value !== 'object') return result
  if (typeof value.id === 'string') result.add(value.id)
  if (typeof value.groupId === 'string') result.add(value.groupId)
  Object.values(value).forEach((child) => ownedIds(child, result))
  return result
}

for (const preset of EDUCATION_PRESETS) {
  test(`Library ${preset.id} inserts stay independent through undo, redo, save and reload`, async ({
    page,
    request,
    testPresentation,
  }, testInfo) => {
    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)
    const canvasElements = editor.canvasLocator.locator('.element-wrapper')
    const originalIds = await canvasElements.evaluateAll((elements) =>
      elements.map((element) => element.dataset.elementId)
    )
    await page.getByRole('tab', { name: 'Insert' }).click()
    const opener = page.getByRole('button', { name: 'Education Library' })
    await opener.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox', { name: /Language|Ngôn ngữ/ }).selectOption('en')
    await dialog.getByRole('searchbox', { name: 'Search' }).fill(preset.id)
    await dialog.getByRole('button', { name: preset.labels.en, exact: true }).click()
    await expect(dialog.locator('iframe, script, canvas, object, embed')).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Insert', exact: true }).click()
    await expect(canvasElements).toHaveCount(originalIds.length + preset.elements.length)
    const firstIds = (
      await canvasElements.evaluateAll((elements) =>
        elements.map((element) => element.dataset.elementId)
      )
    ).filter((id) => !originalIds.includes(id))
    await dialog.getByRole('button', { name: 'Insert', exact: true }).click()
    await expect(canvasElements).toHaveCount(originalIds.length + 2 * preset.elements.length)
    const secondIds = (
      await canvasElements.evaluateAll((elements) =>
        elements.map((element) => element.dataset.elementId)
      )
    ).filter((id) => !originalIds.includes(id) && !firstIds.includes(id))
    expect(firstIds).toHaveLength(preset.elements.length)
    expect(secondIds).toHaveLength(preset.elements.length)
    await expect(dialog.getByRole('status')).toContainText(`Inserted: ${preset.labels.en}`)
    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused()
    await editor.undo()
    await expect(canvasElements).toHaveCount(originalIds.length + preset.elements.length)
    const afterUndoIds = await canvasElements.evaluateAll((elements) =>
      elements.map((element) => element.dataset.elementId)
    )
    expect(afterUndoIds).toEqual([...originalIds, ...firstIds])
    await editor.redo()
    await expect(canvasElements).toHaveCount(originalIds.length + 2 * preset.elements.length)
    const afterRedoIds = await canvasElements.evaluateAll((elements) =>
      elements.map((element) => element.dataset.elementId)
    )
    expect(afterRedoIds).toEqual([...originalIds, ...firstIds, ...secondIds])
    await editor.clickQuickAccessSave()
    const insertedIds = [...firstIds, ...secondIds]
    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, testPresentation.id)
        return saved.slides[0].elements
          .filter((element) => insertedIds.includes(element.id))
          .map((element) => element.id)
      })
      .toEqual(insertedIds)
    const before = await apiGetPresentation(request, testPresentation.id)
    const first = before.slides[0].elements.filter((element) => firstIds.includes(element.id))
    const second = before.slides[0].elements.filter((element) => secondIds.includes(element.id))
    const firstOwned = ownedIds(first)
    const secondOwned = ownedIds(second)
    const originalOwned = ownedIds(preset.elements)
    const sharedCloneIds = [...firstOwned].filter((id) => secondOwned.has(id))
    const reusedSourceIds = [...firstOwned, ...secondOwned].filter((id) => originalOwned.has(id))
    expect(sharedCloneIds).toEqual([])
    expect(reusedSourceIds).toEqual([])
    expect(first.map((element) => element.type)).toEqual(
      preset.elements.map((element) => element.type)
    )
    expect(second.map((element) => element.type)).toEqual(
      preset.elements.map((element) => element.type)
    )
    if (preset.gameType) {
      expect(first[0].gameType).toBe(preset.gameType)
      expect(second[0].gameType).toBe(preset.gameType)
    } else {
      expect(first[0].content).toBe(preset.elements[0].content)
      expect(second[0].content).toBe(preset.elements[0].content)
      expect(first[0].sourceMetadata).toEqual(preset.elements[0].sourceMetadata)
    }
    await page.reload()
    await editor.waitForReady()
    await expect(canvasElements).toHaveCount(originalIds.length + 2 * preset.elements.length)
    const reloadedIds = await canvasElements.evaluateAll((elements) =>
      elements.map((element) => element.dataset.elementId)
    )
    expect(reloadedIds).toEqual(afterRedoIds)
    const after = await apiGetPresentation(request, testPresentation.id)
    const restored = after.slides[0].elements.filter((element) => insertedIds.includes(element.id))
    expect(restored).toEqual([...first, ...second])
    const cells = requiredCells.filter(
      (cell) =>
        cell.presetId === preset.id &&
        cell.surface === 'editor' &&
        cell.mode === 'local' &&
        cell.scenarioId === 'insert-save-reload-undo-clone' &&
        cell.lane === 'production-browser'
    )
    expect(cells).toHaveLength(1)
    const proof = testInfo.outputPath(`preset-${preset.id}.png`)
    await page.screenshot({ path: proof })
    await recordScenario(testInfo, cells[0], {
      expected: {
        presetId: preset.id,
        types: preset.elements.map((element) => element.type),
        afterUndoIds: [...originalIds, ...firstIds],
        afterRedoIds: [...originalIds, ...insertedIds],
        reloadedIds: [...originalIds, ...insertedIds],
        sharedCloneIds: [],
        reusedSourceIds: [],
        persistedBundles: [...first, ...second],
      },
      observed: {
        presetId: preset.id,
        types: first.map((element) => element.type),
        afterUndoIds,
        afterRedoIds,
        reloadedIds,
        sharedCloneIds,
        reusedSourceIds,
        persistedBundles: restored,
      },
      artifacts: [proof],
      page,
      limitations: [],
    })
  })
}
