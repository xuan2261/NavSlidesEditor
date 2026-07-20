import { test, expect, apiUpdatePresentation } from './fixtures/test-fixtures.js'
import { EditorPage } from './pages/editor-page.js'

const KEEPALIVE_MAX_BYTES = 60 * 1024

// A local draft is the recovery channel when a large unload request cannot be observed.
test.describe('oversized autosave recovery', () => {
  test('survives reload and requires an explicit reconciliation choice', async ({
    page,
    request,
    testPresentation,
  }) => {
    const largeContent = `<p>${'x'.repeat(70 * 1024)}</p>`
    await apiUpdatePresentation(request, testPresentation.id, {
      ...testPresentation,
      slides: [{
        id: 'slide-1',
        elements: [{
          id: 'large-text',
          type: 'text',
          x: 100,
          y: 100,
          width: 800,
          height: 300,
          content: largeContent,
        }],
      }],
    })

    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)
    const titleInput = page.locator('input').first()
    await titleInput.fill('Interrupted local draft')

    const pendingDraft = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith('navslides-editor-draft:presentation:')
      )
      return key ? JSON.parse(localStorage.getItem(key)) : null
    })
    expect(JSON.stringify(pendingDraft?.snapshot || {}).length).toBeGreaterThan(KEEPALIVE_MAX_BYTES)

    await page.reload()
    const recovery = page.getByRole('alertdialog', { name: 'Recover interrupted save' })
    await expect(recovery).toBeVisible()
    await expect(titleInput).toHaveValue('Auto E2E Fixture')
    await expect(recovery.getByRole('button', { name: 'Recover Local Draft' })).toBeVisible()

    await recovery.getByRole('button', { name: 'Use Remote' }).click()
    await expect(recovery).toBeHidden()
    await expect(titleInput).toHaveValue('Auto E2E Fixture')
  })

  test('recovers the local draft and retries with the preserved local title', async ({
    page,
    request,
    testPresentation,
  }) => {
    const largeContent = `<p>${'x'.repeat(70 * 1024)}</p>`
    await apiUpdatePresentation(request, testPresentation.id, {
      ...testPresentation,
      slides: [{
        id: 'slide-1',
        elements: [{
          id: 'large-text',
          type: 'text',
          x: 100,
          y: 100,
          width: 800,
          height: 300,
          content: largeContent,
        }],
      }],
    })

    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)
    const titleInput = page.locator('input').first()
    await titleInput.fill('Recovered local draft title')

    const pendingDraft = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) =>
        item.startsWith('navslides-editor-draft:presentation:')
      )
      return key ? JSON.parse(localStorage.getItem(key)) : null
    })
    expect(JSON.stringify(pendingDraft?.snapshot || {}).length).toBeGreaterThan(KEEPALIVE_MAX_BYTES)
    expect(pendingDraft?.snapshot?.title).toBe('Recovered local draft title')

    await page.reload()
    const recovery = page.getByRole('alertdialog', { name: 'Recover interrupted save' })
    await expect(recovery).toBeVisible()
    // Remote content stays visible until the user chooses recovery.
    await expect(titleInput).toHaveValue('Auto E2E Fixture')

    await recovery.getByRole('button', { name: 'Recover Local Draft' }).click()
    await expect(recovery).toBeHidden()
    await expect(titleInput).toHaveValue('Recovered local draft title')

    // Recovery immediately retries the saved draft against the server.
    await expect.poll(async () => {
      const remote = await request.get(`/api/presentations/${testPresentation.id}`)
      const body = await remote.json()
      return body.title
    }).toBe('Recovered local draft title')
  })
})
