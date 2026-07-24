import fs from 'node:fs/promises'
import path from 'node:path'
import {
  apiDeletePresentation,
  apiGetPresentation,
  expect,
  test,
} from './fixtures/test-fixtures.js'
import { importPptxWhenAvailable } from './helpers/pptx-import-api-helper.js'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const BASELINES_REVIEWED = process.env.PPTX_EDITOR_BASELINES_REVIEWED === '1'

const CORPUS_DECKS = [
  'Bai_2_1.pptx',
  'Bai_2_5.pptx',
  'math-rich-text.pptx',
  'non-default-4x3-resolution.pptx',
]

function fixturePath(name) {
  return path.resolve(process.cwd(), 'server/data/test-corpus', name)
}

async function importDeck(request, deckName) {
  const buffer = await fs.readFile(fixturePath(deckName))
  const { presentationId } = await importPptxWhenAvailable(request, {
    file: { name: deckName, mimeType: PPTX_MIME, buffer },
  })
  return presentationId
}

test.describe('PPTX import editor visual regression', () => {
  test.skip(!BASELINES_REVIEWED, 'Requires reviewed editor-canvas baselines. Set PPTX_EDITOR_BASELINES_REVIEWED=1 after editor baselines are accepted.')

  for (const deckName of CORPUS_DECKS) {
    test(`matches reviewed editor canvas baseline for ${deckName}`, async ({ page, request }) => {
      test.setTimeout(180000)

      let presentationId
      try {
        presentationId = await importDeck(request, deckName)
        const importedPresentation = await apiGetPresentation(request, presentationId)
        expect(importedPresentation.slides?.length).toBeGreaterThan(0)

        await page.setViewportSize({ width: 1600, height: 1000 })
        await page.addInitScript(() => {
          localStorage.setItem('navSlidesTutorialSeen', 'true')
        })
        await page.goto(`/editor/${presentationId}`)
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
      } finally {
        await apiDeletePresentation(request, presentationId)
      }
    })
  }
})
