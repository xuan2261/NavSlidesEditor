import { test, expect } from './fixtures/test-fixtures.js'
import { EditorPage } from './pages/editor-page.js'

const API_BASE = `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT || '3202'}/api`

async function waitForApiReady(request) {
  await expect
    .poll(async () => {
      try {
        const res = await request.get(`${API_BASE}/presentations`)
        return res.ok()
      } catch {
        return false
      }
    }, { timeout: 60000 })
    .toBe(true)
}

async function getPresentation(request, id) {
  const res = await request.get(`${API_BASE}/presentations/${id}`)
  expect(res.ok()).toBeTruthy()
  return res.json()
}

test.describe('Plugin runtime insert, render, and persistence', () => {
  test.setTimeout(90000)

  test.beforeEach(async ({ request }) => {
    await waitForApiReady(request)
  })

  test('inserts Animated Counter, renders sandbox, persists element, and exports fallback', async ({
    page,
    request,
    testPresentation,
  }) => {
    const editor = new EditorPage(page)

    await editor.gotoPresentation(testPresentation.id)
    await page.getByRole('tab', { name: 'Insert' }).click()

    const insertPanel = page.getByRole('tabpanel', { name: 'Insert' })
    await expect(insertPanel).toBeVisible()
    await expect(insertPanel.getByRole('button', { name: 'More advanced insert options' })).toBeVisible()
    await insertPanel.getByRole('button', { name: 'More advanced insert options' }).click()
    await page.getByRole('menuitem', { name: 'Animated Counter' }).click()

    const pluginElement = page.locator('[data-element-type="plugin:counter"]').first()
    await expect(pluginElement).toBeVisible({ timeout: 10000 })
    await expect(pluginElement.locator('iframe[sandbox="allow-scripts"]')).toBeVisible()

    await editor.waitForAutoSave()
    await expect
      .poll(async () => {
        const saved = await getPresentation(request, testPresentation.id)
        return saved.slides[0].elements.find((el) => el.type === 'plugin:counter')
      })
      .toMatchObject({
        pluginId: 'navslides.animated-counter',
        pluginSlug: 'animated-counter',
        pluginData: expect.objectContaining({ value: 100 }),
        pluginRuntime: expect.objectContaining({ sandbox: 'sandbox.html' }),
      })

    await page.reload()
    await editor.waitForReady()
    await expect(page.locator('[data-element-type="plugin:counter"]')).toBeVisible()

    const presentRes = await request.get(`${API_BASE}/presentations/${testPresentation.id}/present`)
    expect(presentRes.ok()).toBeTruthy()
    const presentHtml = await presentRes.text()
    expect(presentHtml).toContain('/api/plugins/animated-counter/assets/sandbox.html')
    expect(presentHtml).toContain('Animated Counter')
    expect(presentHtml).toContain("type: 'init'")

    await page.goto(`/api/presentations/${testPresentation.id}/present`, { timeout: 15000 })
    const pluginFrame = page.frameLocator('iframe[title="Animated Counter"]').first()
    await expect(pluginFrame.locator('#value')).toHaveText('100%', { timeout: 10000 })
  })
})
