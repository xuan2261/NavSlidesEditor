import {
  test,
  expect,
  apiCreateSnapshot,
  apiUpdatePresentation,
  apiGetPresentation,
} from './fixtures/test-fixtures.js'
import { EditorPage } from './pages/editor-page.js'

function textSlide(content) {
  return {
    slides: [
      {
        id: 'slide-1',
        elements: [{ id: 'text-1', type: 'text', x: 100, y: 100, width: 400, height: 80, content }],
        notes: '',
        background: { type: 'color', color: '#1e1e2e' },
      },
    ],
  }
}

test.describe('Version history UI restore', () => {
  test('restoring a snapshot reverts canvas content and persists', async ({
    page,
    request,
    testPresentation,
  }) => {
    // Snapshot captures ORIGINAL, then the deck is changed before we open the editor.
    await apiUpdatePresentation(request, testPresentation.id, textSlide('<p>ORIGINAL CONTENT</p>'))
    await apiCreateSnapshot(request, testPresentation.id, 'Original Snapshot')
    await apiUpdatePresentation(request, testPresentation.id, textSlide('<p>CHANGED CONTENT</p>'))

    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)

    const el = page.getByTestId('slide-element-text-1')
    await expect(el).toContainText('CHANGED CONTENT')

    await editor.openHistoryModal()
    const dialog = page.getByRole('dialog', { name: 'Version History' })
    await expect(dialog.getByText('Original Snapshot')).toBeVisible()

    await dialog.getByRole('button', { name: 'Restore' }).first().click()
    await page
      .getByRole('dialog', { name: 'Restore snapshot' })
      .getByRole('button', { name: 'Restore', exact: true })
      .click()

    await expect(dialog).toHaveCount(0)
    await expect(el).toContainText('ORIGINAL CONTENT')

    await expect
      .poll(
        async () => {
          const saved = await apiGetPresentation(request, testPresentation.id)
          return saved.slides[0].elements[0].content
        },
        { timeout: 8000 }
      )
      .toContain('ORIGINAL CONTENT')
  })
})
