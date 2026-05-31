import { test, expect } from './fixtures/test-fixtures.js'
import { EditorPage } from './pages/editor-page.js'

const STATIC_RIBBON_TABS = ['home', 'insert', 'design', 'transitions', 'animations', 'view']

test.describe('data-testid selector contract', () => {
  test('home and settings selectors are stable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-new-presentation-btn')).toBeVisible()
    await expect(page.getByTestId('home-import-markdown-btn')).toBeVisible()
    await expect(page.getByTestId('home-import-markdown-input')).toBeAttached()

    await page.goto('/settings')
    await expect(page.getByTestId('settings-open-sync')).toBeVisible()
    await page.getByTestId('settings-open-sync').click()
    await expect(page.getByTestId('modal-shell-overlay')).toBeVisible()
    await expect(page.getByTestId('modal-shell-dialog')).toBeVisible()
    await expect(page.getByTestId('modal-shell-close-btn')).toBeVisible()
    await expect(page.getByTestId('sync-modal-dialog')).toBeVisible()
  })

  test('editor ribbon and canvas selectors are stable', async ({ page, testPresentation }) => {
    const editorPage = new EditorPage(page)
    await editorPage.gotoPresentation(testPresentation.id)

    await expect(page.getByTestId('canvas-area')).toBeVisible()
    await expect(page.getByTestId('slide-panel-item')).toHaveCount(1)
    await expect(page.getByTestId('ribbon-panel-container')).toBeVisible()

    for (const tab of STATIC_RIBBON_TABS) {
      await expect(page.getByTestId(`ribbon-tab-${tab}`)).toBeVisible()
      await page.getByTestId(`ribbon-tab-${tab}`).click()
      await expect(page.getByTestId(`ribbon-tab-${tab}-content`)).toBeVisible()
    }

    await expect(page.getByTestId('ribbon-tab-format')).toHaveCount(0)
    await editorPage.addShape('Rectangle')
    await page.locator('.element-wrapper[data-element-type="shape"]').first().click({ force: true })
    await expect(page.getByTestId('ribbon-tab-format')).toBeVisible()
    await page.getByTestId('ribbon-tab-format').click()
    await expect(page.getByTestId('ribbon-tab-format-content')).toBeVisible()

    await page.getByTestId('ribbon-tab-insert').click()
    await expect(page.getByTestId('ribbon-insert-text')).toBeVisible()
    await expect(page.getByTestId('ribbon-insert-shape')).toBeVisible()
    await expect(page.getByTestId('ribbon-insert-game')).toBeVisible()

    await page.getByTestId('ribbon-tab-view').click()
    await expect(page.getByTestId('canvas-controls-toggle-smart-guides')).toBeVisible()
    await expect(page.getByTestId('view-toggle-selection-pane')).toBeVisible()

    await expect(page.getByTestId('ribbon-file-menu-trigger')).toBeVisible()
    await page.getByTestId('ribbon-file-menu-trigger').click()
    await expect(page.getByTestId('ribbon-file-export-pptx')).toBeVisible()
    await expect(page.getByTestId('ribbon-file-export-html')).toBeVisible()
  })
})
