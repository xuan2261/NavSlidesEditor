import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { EditorPage } from './pages/editor-page.js'
import {
  expectOriginalPptxHash,
  getPptxFidelity,
  importPptxWhenAvailable,
} from './helpers/pptx-import-api-helper.js'
import {
  apiDeletePresentation,
  apiGetPresentation,
  expect,
  test,
} from './fixtures/test-fixtures.js'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const FIXTURE = 'Bai_2_2.pptx'
const PATCHABLE_TEXT_BOX = Object.freeze({ slideIndex: 16, name: 'TextBox 22' })
function importedTextSource(presentation) {
  const slide = presentation.slides?.[PATCHABLE_TEXT_BOX.slideIndex]
  const element = slide?.elements?.find((item) =>
    item?.type === 'text' && item.name === PATCHABLE_TEXT_BOX.name &&
    typeof item.id === 'string' && item.id && typeof item.content === 'string'
  )
  if (!slide?.id || !element) {
    throw new Error(`Imported PPTX is missing ${PATCHABLE_TEXT_BOX.name} on slide ${PATCHABLE_TEXT_BOX.slideIndex + 1}`)
  }
  return { elementId: element.id, slideId: slide.id, slideIndex: PATCHABLE_TEXT_BOX.slideIndex }
}
function contentForSource(presentation, source) {
  return presentation.slides
    .find((slide) => slide.id === source.slideId)
    ?.elements?.find((element) => element.id === source.elementId)?.content
}
function authoritativeGeneration(presentation) {
  expect(Number.isSafeInteger(presentation.aggregateGeneration)).toBe(true)
  expect(presentation.aggregateGeneration).toBeGreaterThan(0)
  return presentation.aggregateGeneration
}

async function waitForStableSavedGeneration(request, presentationId, source, marker, generation) {
  let priorGeneration = null
  let saved
  await expect
    .poll(
      async () => {
        const current = await apiGetPresentation(request, presentationId)
        const currentGeneration = current.aggregateGeneration
        const markerSaved = String(contentForSource(current, source) || '').includes(marker)
        if (
          !markerSaved ||
          !Number.isSafeInteger(currentGeneration) ||
          currentGeneration <= generation
        ) {
          priorGeneration = null
          return 'pending'
        }
        if (priorGeneration === currentGeneration) {
          saved = { generation: currentGeneration, presentation: current }
          return 'stable'
        }
        priorGeneration = currentGeneration
        return `generation-${currentGeneration}`
      },
      { timeout: 60000, intervals: [250, 500, 1000, 2000] }
    )
    .toBe('stable')
  return saved
}

async function assertValidatedEditedExport(request, presentationId, generation, fidelity) {
  const validatedEdited = fidelity.exports?.validatedEdited
  expect(typeof validatedEdited?.available).toBe('boolean')
  const response = await request.post(`/api/presentations/${presentationId}/pptx-edited`, {
    headers: {
      'Idempotency-Key': `e2e-${randomUUID()}`,
      'If-Pptx-Generation': String(generation),
    },
  })

  if (validatedEdited.available) {
    if (!response.ok()) {
      throw new Error(
        `Validated edited export advertised available but failed: ${response.status()} ${JSON.stringify(
          await response.json().catch(() => ({}))
        )}`
      )
    }
    const headers = response.headers()
    expect(headers['content-type']).toContain(PPTX_MIME)
    expect(headers['x-pptx-export-mode']).toBe('validated-edited')
    const successorGeneration = Number(headers['x-pptx-generation'])
    expect(Number.isSafeInteger(successorGeneration)).toBe(true)
    expect(successorGeneration).toBeGreaterThan(generation)
    const bytes = await response.body()
    expect(bytes.subarray(0, 4).equals(Buffer.from('PK'))).toBe(true)
    const zip = await JSZip.loadAsync(bytes)
    expect(zip.file('[Content_Types].xml')).not.toBeNull()
    expect(zip.file('ppt/presentation.xml')).not.toBeNull()
    return
  }

  expect(typeof validatedEdited.reasonCode).toBe('string')
  expect(response.status()).toBe(422)
  expect(response.headers()['content-type']).toContain('application/json')
  expect(response.headers()['x-pptx-export-mode']).toBeUndefined()
  const failure = await response.json()
  expect(failure.code).toBe(validatedEdited.reasonCode)
  expect(failure.reasonCode).toBe(validatedEdited.reasonCode)
}

test.describe('Critical PPTX user journeys', () => {
  test('[journey:pptx-import-edit-export] [cap:import.pptx] [cap:export.pptx] package lifecycle', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000)
    const marker = `PPTX edited marker ${Date.now()}`
    const fixturePath = path.resolve(process.cwd(), 'PPTX', FIXTURE)
    let presentationId

    try {
      const sourceBytes = await fs.readFile(fixturePath)
      const sourceHash = createHash('sha256').update(sourceBytes).digest('hex')
      const imported = await importPptxWhenAvailable(request, {
        file: { name: FIXTURE, mimeType: PPTX_MIME, buffer: sourceBytes },
      })
      presentationId = imported.presentationId

      const initial = await apiGetPresentation(request, presentationId)
      expect(initial.id).toBe(presentationId)
      expect(initial.pptxSourceAvailable).toBe(true)
      const generation1 = authoritativeGeneration(initial)
      const source = importedTextSource(initial)
      await expectOriginalPptxHash(request, presentationId, sourceHash, PPTX_MIME)

      const editor = new EditorPage(page)
      await editor.gotoPresentation(presentationId)
      await editor.selectSlide(source.slideIndex)
      const sourceElement = page.getByTestId(`slide-element-${source.elementId}`)
      await sourceElement.click({ force: true })
      await sourceElement.dblclick({ force: true })
      const textEditor = page.locator('.ProseMirror')
      await expect(textEditor).toBeVisible()
      const saveResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().endsWith(`/api/presentations/${presentationId}`)
      )
      await textEditor.fill(marker)
      await page.keyboard.press('Escape')
      const saveResponse = await saveResponsePromise
      if (!saveResponse.ok()) throw new Error(
        `Package edit save failed: ${saveResponse.status()} ${JSON.stringify(await saveResponse.json().catch(() => ({})))}`
      )
      await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 15000 })

      const saved = await waitForStableSavedGeneration(
        request,
        presentationId,
        source,
        marker,
        generation1
      )
      expect(saved.generation).toBeGreaterThan(generation1)

      await page.reload()
      await editor.waitForReady()
      await editor.selectSlide(source.slideIndex)
      await expect(page.getByTestId(`slide-element-${source.elementId}`)).toContainText(marker)
      const reloaded = await apiGetPresentation(request, presentationId)
      expect(contentForSource(reloaded, source)).toContain(marker)
      expect(authoritativeGeneration(reloaded)).toBe(saved.generation)
      await expectOriginalPptxHash(request, presentationId, sourceHash, PPTX_MIME)

      const fidelity = await getPptxFidelity(request, presentationId)
      expect(fidelity.aggregateGeneration).toBe(saved.generation)
      await assertValidatedEditedExport(request, presentationId, saved.generation, fidelity)

      const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
      await editor.menubar.exportPPTX()
      const download = await downloadPromise
      const downloadPath = await download.path()
      expect(downloadPath).toBeTruthy()
      const zip = await JSZip.loadAsync(readFileSync(downloadPath))
      expect(zip.file('[Content_Types].xml')).not.toBeNull()
      expect(zip.file(`ppt/slides/slide${source.slideIndex + 1}.xml`)).not.toBeNull()
      const exportedSlide = await zip
        .file(`ppt/slides/slide${source.slideIndex + 1}.xml`)
        .async('string')
      expect(exportedSlide).toContain(marker)
    } finally {
      await apiDeletePresentation(request, presentationId)
    }
  })
})
