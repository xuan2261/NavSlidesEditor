import fs from 'node:fs/promises'
import path from 'node:path'
import { EditorPage } from './pages/editor-page.js'
import {
  apiGetPresentation,
  apiUpdatePresentation,
  expect,
  test,
} from './fixtures/test-fixtures.js'

const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const PPTX_FIXTURE = path.resolve(process.cwd(), 'PPTX', 'Bai_2_2.pptx')

async function waitForPptxImport(request, jobId) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const poll = await request.get(`/api/pptx/jobs/${jobId}`)
    expect(poll.ok()).toBeTruthy()
    const job = await poll.json()
    if (job.status === 'done') return job.result
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(job.error || `PPTX import ${job.status}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Timed out waiting for PPTX import job')
}

test.describe('PPTX import fidelity', () => {
  test('imports pptx, renders stable element boxes, and persists property edits', async ({
    page,
    request,
    testPresentation,
  }) => {
    test.setTimeout(150000)
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
    expect(importRes.status()).toBe(202)
    const { jobId } = await importRes.json()
    const imported = await waitForPptxImport(request, jobId)
    expect(imported.presentation?.slides?.length).toBeGreaterThan(0)

    const presentation = await apiUpdatePresentation(request, testPresentation.id, imported.presentation)

    const editor = new EditorPage(page)
    await editor.gotoPresentation(presentation.id)

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
    const saved = await apiGetPresentation(request, presentation.id)
    const savedElement = saved.slides[0]?.elements?.find((el) => el.id === firstElementId)
    expect(savedElement).toBeTruthy()
    expect(savedElement.x).toBe(nextX)
  })
})
