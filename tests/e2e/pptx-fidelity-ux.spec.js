import { EditorPage } from './pages/editor-page.js'
import { expect, test } from './fixtures/test-fixtures.js'

const unsafeTokens = ['C:\\private\\source.pptx', '/tmp/source.pptx', 'deadbeef', '--headless']

function fidelityContract(presentationId, overrides = {}) {
  return {
    presentationId,
    revision: 4,
    fidelity: { status: 'original-only', editabilityTier: 'original-only' },
    exports: {
      original: { available: true },
      validatedEdited: {
        available: false,
        reason: 'Validation tools are unavailable on this host.',
      },
      reconstructed: { available: false, reason: 'Original-only presentations cannot be rebuilt.' },
    },
    officeCli: {
      available: false,
      guidance: 'Validation tools are unavailable. Download the original package.',
    },
    ...overrides,
  }
}

async function openImportedEditor(page, presentationId, contract) {
  await page.route(`**/api/presentations/${presentationId}`, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    await route.fulfill({
      response,
      json: {
        ...body,
        pptxOriginal: { id: 'browser-safe-source', sha256: 'a'.repeat(64) },
      },
    })
  })
  await page.route(`**/api/presentations/${presentationId}/pptx-fidelity`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(contract) })
  )
  const editor = new EditorPage(page)
  await editor.gotoPresentation(presentationId)
  await page.getByTestId('ribbon-file-menu-trigger').click()
  await expect(page.getByTestId('pptx-fidelity-panel')).toBeVisible()
}

test.describe('PPTX fidelity File menu UX', () => {
  test('names distinct export choices and explains unavailable validation safely', async ({
    page,
    testPresentation,
  }) => {
    await openImportedEditor(
      page,
      testPresentation.id,
      fidelityContract(testPresentation.id)
    )

    await expect(page.getByTestId('pptx-fidelity-status'))
      .toHaveAccessibleName('Original-only fidelity')
    await expect(page.getByTestId('pptx-export-original')).toHaveText('Download Original')
    await expect(page.getByTestId('pptx-export-validatedEdited'))
      .toHaveText('Export Validated Edited Revision')
    await expect(page.getByTestId('pptx-export-reconstructed'))
      .toHaveText('Generate Reconstructed PPTX')
    await expect(page.getByTestId('pptx-export-original')).toBeEnabled()
    await expect(page.getByTestId('pptx-export-validatedEdited')).toBeDisabled()
    await expect(page.getByTestId('pptx-export-validatedEdited'))
      .toHaveAttribute('title', 'Validation tools are unavailable on this host.')
    await expect(page.getByTestId('pptx-export-reconstructed')).toBeDisabled()

    const visibleText = await page.getByTestId('pptx-fidelity-panel').innerText()
    for (const token of unsafeTokens) expect(visibleText).not.toContain(token)
  })

  test('supports keyboard focus and remains contained at a narrow viewport', async ({
    page,
    testPresentation,
  }) => {
    await openImportedEditor(
      page,
      testPresentation.id,
      fidelityContract(testPresentation.id)
    )

    await page.getByTestId('ribbon-file-menu-trigger').press('Escape')
    await expect(page.getByTestId('ribbon-file-menu-trigger')).toBeFocused()
    await page.getByTestId('ribbon-file-menu-trigger').press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Open Project' })).toBeFocused()
    await page.getByRole('menuitem', { name: 'Open Project' }).press('End')
    await expect(page.getByRole('menuitem', { name: 'Version History' })).toBeFocused()

    await page.setViewportSize({ width: 640, height: 740 })
    const box = await page.getByTestId('pptx-fidelity-panel').boundingBox()
    expect(box).not.toBeNull()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(640)
  })

  test('shows durable terminal fidelity state again after refresh', async ({
    page,
    testPresentation,
  }) => {
    const contract = fidelityContract(testPresentation.id, {
      fidelity: { status: 'source-backed', editabilityTier: 'structural-mvp' },
      exports: {
        original: { available: true },
        validatedEdited: { available: true },
        reconstructed: { available: true },
      },
    })
    await openImportedEditor(page, testPresentation.id, contract)
    await expect(page.getByTestId('pptx-fidelity-status'))
      .toHaveAccessibleName('Source-backed fidelity')

    await page.reload()
    const editor = new EditorPage(page)
    await editor.waitForReady()
    await page.getByTestId('ribbon-file-menu-trigger').click()
    await expect(page.getByTestId('pptx-export-validatedEdited')).toBeEnabled()
    await expect(page.getByTestId('pptx-export-reconstructed')).toBeEnabled()
  })
})
