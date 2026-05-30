import { test, expect } from './fixtures/test-fixtures.js'

test.describe('Command palette execution', () => {
  test('Ctrl+K filters to a command and running it produces the effect', async ({
    page,
    testPresentation,
  }) => {
    await page.goto(`/editor/${testPresentation.id}`)
    // The Ctrl+K handler attaches in a mount effect on the lazy-loaded editor.
    await expect(page.getByTestId('canvas-area')).toBeVisible({ timeout: 30000 })

    await page.locator('body').click()
    await page.keyboard.press('Control+K')

    const palette = page.getByPlaceholder('Type a command...')
    await expect(palette).toBeVisible({ timeout: 5000 })

    // "Insert Slide" filters to a single command; running it opens the Add Slide
    // picker and closes the palette — i.e. the command actually executed, not
    // just that the palette opened.
    await palette.fill('Insert Slide')
    await palette.press('Enter')

    await expect(palette).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Add Slide' })).toBeVisible()
  })
})
