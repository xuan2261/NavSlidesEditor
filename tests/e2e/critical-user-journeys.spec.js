import fs from 'node:fs/promises'
import { HomePage } from './pages/home-page.js'
import { EditorPage } from './pages/editor-page.js'
import {
  test,
  expect,
  apiCreatePresentation,
  apiCreateShareLinkWithPassword,
  apiDeletePresentation,
  apiGetPresentation,
  apiRevokeShareToken,
  apiUpdatePresentation,
  getBaseUrl,
} from './fixtures/test-fixtures.js'

const slideWithText = (marker) => ({
  id: 'slide-critical-1',
  background: { type: 'color', color: '#1e1e2e' },
  notes: '',
  elements: [{
    id: 'critical-text-1',
    type: 'text',
    x: 100,
    y: 100,
    width: 600,
    height: 80,
    zIndex: 1,
    content: `<h1>${marker}</h1>`,
  }],
})

function idFromEditorUrl(url) {
  return new URL(url).pathname.split('/').filter(Boolean).pop()
}

async function waitForPresentationPut(page, presId, action) {
  const saveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes(`/api/presentations/${presId}`) &&
      response.ok(),
    { timeout: 20000 }
  )
  await action()
  await saveResponse
}

test.describe('Critical MVP user journeys', () => {
  test('[journey:create-edit-persist] create/edit/persist journey survives save and reload', async ({ page, request }) => {
    const title = `Critical Persist ${Date.now()}`
    const marker = `Persisted marker ${Date.now()}`
    let presId

    try {
      const home = new HomePage(page)
      await home.goto()
      await home.createNewPresentation(title)
      presId = idFromEditorUrl(page.url())

      const editor = new EditorPage(page)
      await editor.waitForReady()
      await editor.addTextNode()
      await editor.startEditingTextElement()
      await editor.selectAllText()
      await editor.typeInTextEditor(marker)
      await waitForPresentationPut(page, presId, () => page.keyboard.press('Escape'))

      await expect.poll(async () => {
        const saved = await apiGetPresentation(request, presId)
        return saved.slides[0].elements.some((el) => el.type === 'text' && el.content.includes(marker))
      }, { timeout: 20000 }).toBe(true)

      await page.reload()
      await editor.waitForReady()
      await expect(
        page.locator('[data-testid^="slide-element-"]').filter({ hasText: marker })
      ).toBeVisible({ timeout: 10000 })
    } finally {
      if (presId) await apiDeletePresentation(request, presId).catch(() => {})
    }
  })

  test('[journey:share-password-revoke] [cap:share.password] [cap:share.revoke] share password and revoke journey protects then disables access', async ({ page, request }) => {
    const marker = `Shared critical marker ${Date.now()}`
    const pres = await apiCreatePresentation(request, 'Critical Share Password Revoke')

    try {
      await apiUpdatePresentation(request, pres.id, { slides: [slideWithText(marker)] })
      const { token } = await apiCreateShareLinkWithPassword(request, pres.id, 'critical-secret')

      const missing = await request.post(`/share/${token}/verify`, { data: {} })
      expect(missing.status()).toBe(401)
      const wrong = await request.post(`/share/${token}/verify`, {
        data: { password: 'wrong-secret' },
      })
      expect(wrong.status()).toBe(401)

      await page.goto(new URL(`/share/${token}`, getBaseUrl()).toString(), { timeout: 15000 })
      await expect(page.getByRole('heading', { name: 'Password Required' })).toBeVisible()
      await expect(page.getByText(marker)).toHaveCount(0)
      await page.getByPlaceholder('Enter password').fill('critical-secret')
      await page.getByRole('button', { name: 'View' }).click()
      await expect(page.locator('.reveal')).toBeVisible({ timeout: 10000 })
      await expect(page.locator('.reveal .slides section.present').filter({ hasText: marker })).toBeVisible()

      const revoke = await apiRevokeShareToken(request, token)
      expect(revoke.ok()).toBeTruthy()
      const revoked = await request.get(`/share/${token}`)
      expect(revoked.status()).toBe(404)
    } finally {
      await apiDeletePresentation(request, pres.id).catch(() => {})
    }
  })

  test('[journey:insert-format-arrange-export] [cap:export.html] inserted elements persist and export to HTML artifact', async ({
    page,
    request,
    testPresentation,
  }) => {
    const marker = `Export journey marker ${Date.now()}`
    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)

    await editor.addTextNode()
    await editor.startEditingTextElement()
    await editor.selectAllText()
    await editor.typeInTextEditor(marker)
    await page.keyboard.press('Escape')

    const shapeIndex = await editor.addShape('Rectangle')
    await editor.selectElement(shapeIndex)
    await page.getByRole('tab', { name: 'Shape Format' }).click()
    await page.getByLabel('Fill color').fill('#22c55e')
    await page.getByRole('spinbutton', { name: 'Width', exact: true }).fill('180')
    await page.getByRole('spinbutton', { name: 'Height', exact: true }).fill('90')
    await page.getByRole('button', { name: 'Align center horizontal' }).click()
    await page.getByLabel('Y position').fill('260')

    await expect
      .poll(async () => {
        const saved = await apiGetPresentation(request, testPresentation.id)
        const elements = saved.slides[0].elements
        const text = elements.find((el) => el.type === 'text' && el.content.includes(marker))
        const shape = elements.find((el) => el.type === 'shape' && el.fill === '#22c55e')
        return {
          hasText: Boolean(text),
          shape: shape && {
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            fill: shape.fill,
          },
        }
      }, { timeout: 10000 })
      .toEqual({
        hasText: true,
        shape: {
          x: 390,
          y: 260,
          width: 180,
          height: 90,
          fill: '#22c55e',
        },
      })

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
    await editor.menubar.openFileMenuItem('Export HTML')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.html$/)
    const path = await download.path()
    expect(path).toBeTruthy()
    const html = await fs.readFile(path, 'utf8')
    expect(html).toContain(marker)
    expect(html).toContain('<section')
    expect(html).toContain('#22c55e')
  })
})
