import { test, expect, apiGetPresentation } from './fixtures/test-fixtures.js'
import { EditorPage } from './pages/editor-page.js'

async function waitForElement(request, presentationId, predicate) {
  return expect
    .poll(async () => {
      const presentation = await apiGetPresentation(request, presentationId)
      return presentation.slides?.[0]?.elements?.find(predicate) || null
    })
    .not.toBeNull()
}

test.describe('Teaching interactivity smoke', () => {
  test('inserts Mermaid, STEM simulation, and live poll through the Insert ribbon', async ({
    page,
    request,
    testPresentation,
  }) => {
    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)
    await page.getByRole('tab', { name: 'Insert' }).click()
    const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })

    await insertPanel.getByRole('button', { name: 'Add Mermaid diagram' }).click()
    await page.getByRole('button', { name: 'Apply' }).click()
    await waitForElement(
      request,
      testPresentation.id,
      (element) => element.type === 'html' && element.embedKind === 'mermaid'
    )

    await page.getByRole('tab', { name: 'Insert' }).click()
    await insertPanel.getByRole('button', { name: 'Add STEM simulation' }).click()
    await page.getByRole('combobox').selectOption('phet')
    await page.getByRole('textbox', { name: 'URL or ID' }).fill('fractions-intro')
    await page.getByRole('button', { name: 'Insert', exact: true }).click()
    await waitForElement(
      request,
      testPresentation.id,
      (element) => element.type === 'html' && element.embedKind === 'stem-simulation'
    )

    await page.getByRole('tab', { name: 'Insert' }).click()
    await insertPanel.getByRole('button', { name: 'More advanced insert options' }).click()
    await page.getByRole('menuitem', { name: 'Games...' }).click()
    await page.getByRole('button', { name: 'Live Poll' }).click()
    await waitForElement(
      request,
      testPresentation.id,
      (element) => element.type === 'game' && element.gameType === 'poll'
    )
  })
})
