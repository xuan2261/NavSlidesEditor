import fs from 'node:fs/promises'
import path from 'node:path'
import { EditorPage } from './pages/editor-page.js'
import { importPptxWhenAvailable } from './helpers/pptx-import-api-helper.js'
import {
  apiDeletePresentation,
  apiGetPresentation,
  expect,
  test,
} from './fixtures/test-fixtures.js'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const PPTX_FIXTURE = path.resolve(process.cwd(), 'PPTX', 'Bai_2_2.pptx')

test.describe('PPTX import fidelity', () => {
  test('imports a package-backed PPTX and renders stable element boxes', async ({
    page,
    request,
  }) => {
    test.setTimeout(150000)
    let presentationId

    try {
      const buffer = await fs.readFile(PPTX_FIXTURE)
      const imported = await importPptxWhenAvailable(request, {
        file: { name: path.basename(PPTX_FIXTURE), mimeType: PPTX_MIME, buffer },
      })
      presentationId = imported.presentationId

      const presentation = await apiGetPresentation(request, presentationId)
      expect(presentation.id).toBe(presentationId)
      expect(presentation.pptxSourceAvailable).toBe(true)
      expect(Number.isSafeInteger(presentation.aggregateGeneration)).toBe(true)
      expect(presentation.slides?.length).toBeGreaterThan(0)

      const editor = new EditorPage(page)
      await editor.gotoPresentation(presentationId)

      const elementLocator = page.getByTestId(/^slide-element-/)
      await expect(elementLocator.first()).toBeVisible({ timeout: 10000 })
      expect(await elementLocator.count()).toBeGreaterThan(0)

      const boundsAudit = await page.evaluate(() => {
        const canvas = document.querySelector('.slide-canvas')
        if (!canvas) return { ok: false, reason: 'missing-canvas' }
        const canvasBox = canvas.getBoundingClientRect()
        const audited = Array.from(document.querySelectorAll('[data-testid^="slide-element-"]'))
          .slice(0, 12)
          .map((node) => {
            const box = node.getBoundingClientRect()
            return {
              bottom: box.bottom - canvasBox.top,
              height: box.height,
              left: box.left - canvasBox.left,
              right: box.right - canvasBox.left,
              top: box.top - canvasBox.top,
              width: box.width,
              canvasHeight: canvasBox.height,
              canvasWidth: canvasBox.width,
            }
          })
        const ok = audited.every(
          (entry) =>
            entry.width > 0 &&
            entry.height > 0 &&
            entry.left <= entry.canvasWidth + 5 &&
            entry.top <= entry.canvasHeight + 5 &&
            entry.right >= -5 &&
            entry.bottom >= -5
        )
        return { ok, audited }
      })
      expect(boundsAudit.ok, JSON.stringify(boundsAudit)).toBe(true)

      const reloaded = await apiGetPresentation(request, presentationId)
      expect(reloaded.id).toBe(presentationId)
      expect(reloaded.aggregateGeneration).toBe(presentation.aggregateGeneration)
    } finally {
      await apiDeletePresentation(request, presentationId)
    }
  })
})
