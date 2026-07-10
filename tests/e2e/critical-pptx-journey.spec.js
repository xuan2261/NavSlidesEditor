import fs from 'node:fs/promises'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { EditorPage } from './pages/editor-page.js'
import { postPptxImportWhenAvailable } from './helpers/pptx-import-api-helper.js'
import {
  apiDeletePresentation,
  apiGetPresentation,
  apiUpdatePresentation,
  expect,
  test,
} from './fixtures/test-fixtures.js'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const FIXTURE = 'Bai_2_2.pptx'

async function waitForPptxImport(request, jobId) {
  let result
  await expect.poll(async () => {
    const poll = await request.get(`/api/pptx/jobs/${jobId}`)
    expect(poll.ok()).toBeTruthy()
    const job = await poll.json()
    if (job.status === 'done') {
      result = job.result
      return 'done'
    }
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(job.error || `PPTX import ${job.status}`)
    }
    return job.status
  }, { timeout: 60000, intervals: [500] }).toBe('done')
  return result
}

async function importFixtureIntoPresentation(request, testPresentation) {
  const fixturePath = path.resolve(process.cwd(), 'PPTX', FIXTURE)
  const buffer = await fs.readFile(fixturePath)
  const importRes = await postPptxImportWhenAvailable(request, {
    file: { name: FIXTURE, mimeType: PPTX_MIME, buffer },
  })
  expect(importRes.status()).toBe(202)

  const { jobId } = await importRes.json()
  const result = await waitForPptxImport(request, jobId)
  const imported = await apiGetPresentation(request, result.presentationId)
  expect(imported.slides.length).toBeGreaterThan(1)

  const slideIndex = imported.slides.findIndex((slide) =>
    (slide.elements || []).some((element) => element.type === 'text')
  )
  expect(slideIndex).toBeGreaterThanOrEqual(0)
  const elementIndex = imported.slides[slideIndex].elements.findIndex(
    (element) => element.type === 'text'
  )

  await apiUpdatePresentation(request, testPresentation.id, imported)
  await apiDeletePresentation(request, result.presentationId)
  return { elementIndex, slideIndex }
}

test.describe('Critical PPTX user journeys', () => {
  test('[journey:pptx-import-edit-export] [cap:import.pptx] [cap:export.pptx] imported PPTX stays editable and exports valid PPTX artifact', async ({
    page,
    request,
    testPresentation,
  }) => {
    test.setTimeout(180000)
    const marker = `PPTX edited marker ${Date.now()}`
    const { elementIndex, slideIndex } = await importFixtureIntoPresentation(request, testPresentation)

    const editor = new EditorPage(page)
    await editor.gotoPresentation(testPresentation.id)
    await editor.selectSlide(slideIndex)
    await editor.startEditingTextElement(elementIndex)
    await editor.selectAllText()
    await editor.typeInTextEditor(marker)
    await page.keyboard.press('Escape')

    await expect.poll(async () => {
      const saved = await apiGetPresentation(request, testPresentation.id)
      return saved.slides[slideIndex].elements[elementIndex].content
    }, { timeout: 10000 }).toContain(marker)

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await editor.menubar.exportPPTX()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pptx$/)

    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()
    expect(existsSync(downloadPath)).toBe(true)
    expect(statSync(downloadPath).size).toBeGreaterThan(1000)

    const zip = await JSZip.loadAsync(readFileSync(downloadPath))
    expect(zip.file('[Content_Types].xml')).not.toBeNull()
    expect(zip.file('ppt/presentation.xml')).not.toBeNull()
    expect(zip.file(`ppt/slides/slide${slideIndex + 1}.xml`)).not.toBeNull()

    const exportedSlide = await zip.file(`ppt/slides/slide${slideIndex + 1}.xml`).async('string')
    expect(exportedSlide).toContain(marker)
  })
})
