import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { EditorPage } from './pages/editor-page.js'
import { apiCreateSnapshot, apiGetPresentation, apiUpdatePresentation } from './fixtures/test-fixtures.js'
import { historyJourney, content, titleInput, saved, slide, text } from './helpers/p06-history-acceptance.js'
import { createHistoryPackage, sha256 } from './helpers/p06-history-package.js'

async function restoreNamed(page, editor, name) {
  await editor.openHistoryModal()
  const history = page.getByRole('dialog', { name: 'Version History' })
  const label = history.getByText(name, { exact: true })
  await expect(label).toBeVisible()
  await label.locator('../..').getByRole('button', { name: 'Restore', exact: true }).click()
  await page.getByRole('dialog', { name: 'Restore snapshot' }).getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(history).toHaveCount(0)
}

async function downloadOriginal(page, info, label, originalHash) {
  await page.getByTestId('ribbon-file-menu-trigger').click()
  const pending = page.waitForEvent('download')
  await page.getByTestId('pptx-export-original').click()
  const filename = info.outputPath(`${label}-original.pptx`)
  await (await pending).saveAs(filename)
  expect(sha256(await readFile(filename))).toBe(originalHash)
  return originalHash
}

async function reversibleSnapshot(request, id) {
  const response = await request.get(`${process.env.PLAYWRIGHT_API_BASE_URL}/presentations/${id}/snapshots`)
  expect(response.ok()).toBeTruthy()
  const reversible = (await response.json()).find((item) => /before.restore/i.test(item.name))
  expect(reversible).toBeTruthy()
  return reversible
}

const documentContent = (deck) => JSON.stringify({ title: deck.title, slides: deck.slides })

test('P06-14 server history restore is reversible with immutable Original downloads', async ({ page, browser, request }, info) => {
  test.setTimeout(120000)
  await historyJourney({ page, browser, request }, info, ['P06-14'], async ({ create, ids, receipt }) => {
    const editor = new EditorPage(page)
    const plainId = await create('Plain original', { slides: [slide([text('restore-text', '<p>Restore Alpha</p>')])] })
    const originalContent = documentContent(await apiGetPresentation(request, plainId))
    await apiCreateSnapshot(request, plainId, 'P06 plain original')
    await apiUpdatePresentation(request, plainId, { title: 'Plain changed', slides: [slide([text('restore-text', '<p>Restore Beta</p>')])] })
    const changedContent = documentContent(await apiGetPresentation(request, plainId))
    await page.goto(`/editor/${plainId}`)
    await expect(content(page, 'restore-text')).toContainText('Restore Beta')
    await restoreNamed(page, editor, 'P06 plain original')
    await expect(content(page, 'restore-text')).toContainText('Restore Alpha')
    expect(documentContent(await apiGetPresentation(request, plainId))).toBe(originalContent)
    const plainReversible = await reversibleSnapshot(request, plainId)
    await restoreNamed(page, editor, plainReversible.name)
    await expect(content(page, 'restore-text')).toContainText('Restore Beta')
    expect(documentContent(await apiGetPresentation(request, plainId))).toBe(changedContent)
    await page.reload()
    await expect(content(page, 'restore-text')).toContainText('Restore Beta')
    receipt.runs.push({ scenarioId: 'P06-14', status: 'pending-identity', kind: 'plain-changed-content', originalContent, changedContent, reversibleSnapshotId: plainReversible.id })

    const { id, originalSha256 } = await createHistoryPackage(request, ids)
    const snapshot = await apiCreateSnapshot(request, id, 'P06 package snapshot')
    const initial = await apiGetPresentation(request, id)
    expect(initial.pptxSourceAvailable).toBe(true)
    await page.goto(`/editor/${id}`)
    await expect(content(page, 'package-text')).toContainText('Package Alpha')
    const initialHash = await downloadOriginal(page, info, 'initial', originalSha256)
    await restoreNamed(page, editor, 'P06 package snapshot')
    await expect(titleInput(page)).toHaveValue('Package original')
    const restored = await apiGetPresentation(request, id)
    expect(restored.aggregateGeneration).toBeGreaterThan(initial.aggregateGeneration)
    expect(documentContent(restored)).toBe(documentContent(initial))
    const beforeRestoreHash = await downloadOriginal(page, info, 'restored', originalSha256)
    const reversible = await reversibleSnapshot(request, id)
    await restoreNamed(page, editor, reversible.name)
    await expect(content(page, 'package-text')).toContainText('Package Alpha')
    const restoredBack = await apiGetPresentation(request, id)
    expect(restoredBack.aggregateGeneration).toBeGreaterThan(restored.aggregateGeneration)
    expect(documentContent(restoredBack)).toBe(documentContent(initial))
    const restoreBackHash = await downloadOriginal(page, info, 'restored-back', originalSha256)
    receipt.runs.push({ scenarioId: 'P06-14', status: 'pending-identity', kind: 'settled-package', snapshotId: snapshot.id, reversibleSnapshotId: reversible.id,
      generations: [initial.aggregateGeneration, restored.aggregateGeneration, restoredBack.aggregateGeneration], initialHash, beforeRestoreHash, restoreBackHash,
      retainedOwnerBoundary: 'actual server restore-back from Before restore succeeds and Original remains downloadable; raw authority intentionally hidden by editor DTO',
      packageProvenance: 'PptxGenJS genuine PPTX, real source package store, portable admission API; not parser/Office qualification' })

    // An unvalidated projection is intentionally ineligible, never a fake edited revision.
    await titleInput(page).fill('Package pending projection')
    await saved(request, id, (deck) => deck.title, 'Package pending projection')
    const pending = await apiGetPresentation(request, id)
    expect(pending.aggregateGeneration).toBeGreaterThan(restoredBack.aggregateGeneration)
    await editor.openHistoryModal()
    const history = page.getByRole('dialog', { name: 'Version History' })
    await history.getByText('P06 package snapshot', { exact: true }).locator('../..').getByRole('button', { name: 'Restore', exact: true }).click()
    const refusalResponse = page.waitForResponse((response) => response.url().includes(`/restore/${snapshot.id}`) && response.request().method() === 'POST')
    await page.getByRole('dialog', { name: 'Restore snapshot' }).getByRole('button', { name: 'Restore', exact: true }).click()
    const refusal = await refusalResponse
    expect(refusal.status()).toBe(409)
    expect((await refusal.json()).error).toBe('Cannot restore while the current package projection is pending')
    await expect(history.getByRole('alert')).toContainText('Cannot restore while the current package projection is pending')
    const afterRefusal = await apiGetPresentation(request, id)
    expect(documentContent(afterRefusal)).toBe(documentContent(pending))
    expect(afterRefusal).toEqual(pending)
    await editor.closeOverlayModal()
    await expect(titleInput(page)).toHaveValue('Package pending projection')
    const pendingRefusalHash = await downloadOriginal(page, info, 'pending-refusal', originalSha256)
    await page.reload()
    await expect(titleInput(page)).toHaveValue('Package pending projection')
    receipt.runs.push({ scenarioId: 'P06-14', status: 'pending-identity', kind: 'pending-projection-refusal', statusCode: 409,
      publicError: 'Cannot restore while the current package projection is pending', publicDtoAndGenerationUnchanged: true, pendingRefusalHash })
  })
})
