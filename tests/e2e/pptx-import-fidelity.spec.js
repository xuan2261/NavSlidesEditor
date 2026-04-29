import fs from 'node:fs/promises'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { EditorPage } from './pages/EditorPage.js'
import {
  apiDeletePresentation,
  apiGetPresentation,
} from './fixtures/test-fixtures.js'

const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const PPTX_FIXTURE = path.resolve(process.cwd(), 'PPTX', 'Bai_2_2.pptx')

test.describe('PPTX import fidelity', () => {
  let presentationId = null

  test.afterEach(async ({ request }) => {
    if (presentationId) {
      await apiDeletePresentation(request, presentationId)
      presentationId = null
    }
  })

  test('imports pptx, renders stable element boxes, and persists property edits', async ({
    page,
    request,
  }) => {
    const buffer = await fs.readFile(PPTX_FIXTURE)
    const importRes = await request.post('/api/pptx/import', {
      multipart: {
        file: {
          name: path.basename(PPTX_FIXTURE),
          mimeType: PPTX_MIME,
          buffer,
        },
      },
    })
    expect(importRes.ok()).toBeTruthy()
    const imported = await importRes.json()
    expect(imported.presentation?.slides?.length).toBeGreaterThan(0)

    const createRes = await request.post('/api/presentations', {
      data: imported.presentation,
    })
    expect(createRes.ok()).toBeTruthy()
    const presentation = await createRes.json()
    presentationId = presentation.id

    const editor = new EditorPage(page)
    await editor.gotoPresentation(presentationId)

    const elementLocator = page.locator('[data-testid^="slide-element-"]')
    await expect(elementLocator.first()).toBeVisible({ timeout: 10000 })
    const elementCount = await elementLocator.count()
    expect(elementCount).toBeGreaterThan(0)

    const boundsAudit = await page.evaluate(() => {
      const canvas = document.querySelector('.slide-canvas')
      if (!canvas) return { ok: false, reason: 'missing-canvas' }
      const c = canvas.getBoundingClientRect()
      const audited = Array.from(document.querySelectorAll('[data-testid^="slide-element-"]'))
        .slice(0, 12)
        .map((node) => {
          const r = node.getBoundingClientRect()
          return {
            id: node.getAttribute('data-element-id'),
            type: node.getAttribute('data-element-type'),
            width: r.width,
            height: r.height,
            left: r.left - c.left,
            top: r.top - c.top,
            right: r.right - c.left,
            bottom: r.bottom - c.top,
            canvasWidth: c.width,
            canvasHeight: c.height,
          }
        })

      const ok = audited.every((entry) => {
        if (!(entry.width > 0 && entry.height > 0)) return false
        if (!(entry.left <= entry.canvasWidth + 5 && entry.top <= entry.canvasHeight + 5)) return false
        if (!(entry.right >= -5 && entry.bottom >= -5)) return false
        return true
      })
      return { ok, audited }
    })
    expect(boundsAudit.ok).toBe(true)

    const firstElement = page.locator('[data-testid^="slide-element-"]').first()
    const firstElementId = await firstElement.getAttribute('data-element-id')
    await firstElement.click()
    await expect(page.locator('.properties-panel')).toBeVisible({ timeout: 5000 })

    const xInput = page.getByTestId('prop-x')
    await expect(xInput).toBeVisible()
    const previousX = Number(await xInput.inputValue())
    const nextX = Number.isFinite(previousX) ? previousX + 7 : 7
    await xInput.fill(String(nextX))
    await xInput.blur()
    await editor.waitForAutoSave()

    await page.reload()
    await editor.waitForReady()
    const saved = await apiGetPresentation(request, presentationId)
    const savedElement = saved.slides[0]?.elements?.find((el) => el.id === firstElementId)
    expect(savedElement).toBeTruthy()
    expect(savedElement.x).toBe(nextX)
  })
})
