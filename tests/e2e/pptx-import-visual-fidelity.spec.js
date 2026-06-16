import fs from 'node:fs/promises'
import path from 'node:path'
import {
  apiUpdatePresentation,
  expect,
  test,
} from './fixtures/test-fixtures.js'
import { postPptxImportWhenAvailable } from './helpers/pptx-import-api-helper.js'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const BASELINES_REVIEWED = process.env.PPTX_VISUAL_BASELINES_REVIEWED === '1'

const CORPUS_DECKS = [
  'Bai_2_1.pptx',
  'Bai_2_5.pptx',
  'math-rich-text.pptx',
  'non-default-4x3-resolution.pptx',
]

function fixturePath(name) {
  return path.resolve(process.cwd(), 'server/data/test-corpus', name)
}

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

async function importDeckIntoPresentation(request, testPresentation, deckName) {
  const buffer = await fs.readFile(fixturePath(deckName))
  const importRes = await postPptxImportWhenAvailable(request, {
    file: { name: deckName, mimeType: PPTX_MIME, buffer },
  })
  expect(importRes.status()).toBe(202)
  const { jobId } = await importRes.json()
  const imported = await waitForPptxImport(request, jobId)
  expect(imported.presentation?.slides?.length).toBeGreaterThan(0)
  return apiUpdatePresentation(request, testPresentation.id, imported.presentation)
}

test.describe('PPTX import visual fidelity', () => {
  test.skip(!BASELINES_REVIEWED, 'Requires reviewed PowerPoint/LibreOffice visual baselines. Set PPTX_VISUAL_BASELINES_REVIEWED=1 after baselines are accepted.')

  for (const deckName of CORPUS_DECKS) {
    test(`matches reviewed editor canvas baseline for ${deckName}`, async ({
      page,
      request,
      testPresentation,
    }) => {
      test.setTimeout(180000)

      const presentation = await importDeckIntoPresentation(request, testPresentation, deckName)
      await page.setViewportSize({ width: 1600, height: 1000 })
      await page.addInitScript(() => {
        localStorage.setItem('navSlidesTutorialSeen', 'true')
      })
      await page.goto(`/editor/${presentation.id}`)
      const canvas = page.locator('.slide-canvas')
      await expect(canvas).toBeVisible({ timeout: 30000 })
      await canvas.evaluate((node) => {
        node.style.transform = 'scale(1)'
        node.style.transformOrigin = 'top left'
        node.style.boxShadow = 'none'
      })
      await expect.poll(async () => {
        const box = await canvas.boundingBox()
        return box ? `${Math.round(box.width)}x${Math.round(box.height)}` : ''
      }).toBe('960x540')
      const box = await canvas.boundingBox()
      expect(box).toBeTruthy()

      await expect(page).toHaveScreenshot(`${deckName.replace(/\.pptx$/i, '')}-editor-canvas.png`, {
        clip: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: 960,
          height: 540,
        },
        maxDiffPixelRatio: 0.002,
        maxDiffPixels: Number.MAX_SAFE_INTEGER,
      })
    })
  }
})
