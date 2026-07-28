import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect } from '@playwright/test'
import { apiGetPresentation } from '../fixtures/test-fixtures.js'
import { postPptxImportWhenAvailable } from '../helpers/pptx-import-api-helper.js'

export const AUDIT_VIEWPORT = { width: 1600, height: 1000 }
export const PPTX_BROWSER_AUDIT_SMOKE_DECKS = ['Bai3_HinhChieuVuongGoc.pptx', 'Bai_2_5.pptx']
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export function selectAuditDecks(allDecks) {
  const explicit = String(process.env.PPTX_IMPORT_AUDIT_DECKS || '').split(',').map((name) => name.trim()).filter(Boolean)
  if (explicit.length) return explicit
  if (process.env.PPTX_IMPORT_AUDIT_SCOPE === 'smoke') {
    return PPTX_BROWSER_AUDIT_SMOKE_DECKS.filter((name) => allDecks.includes(name))
  }
  return allDecks
}

async function waitForPptxImport(request, jobId, capability) {
  if (typeof capability !== 'string' || !capability) {
    throw new Error('PPTX import job capability is required')
  }
  let result
  await expect
    .poll(async () => {
      const poll = await request.get(`/api/pptx/jobs/${jobId}`, {
        headers: { 'X-Pptx-Job-Capability': capability },
      })
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
    }, { timeout: 300000, intervals: [500, 1000, 2000] })
    .toBe('done')
  return result
}

export async function importDeckForAudit(page, request, pptxDir, deckName) {
  const deckPath = path.join(pptxDir, deckName)
  const buffer = await fs.promises.readFile(deckPath)
  const importRes = await postPptxImportWhenAvailable(
    request,
    {
      file: { name: deckName, mimeType: PPTX_MIME, buffer },
    },
    { maxAttempts: 90, retryDelayMs: 5000 }
  )
  expect(importRes.status()).toBe(202)

  const { jobId, capability } = await importRes.json()
  const imported = await waitForPptxImport(request, jobId, capability)
  const presentation = await apiGetPresentation(request, imported.presentationId)
  expect(presentation.slides?.length).toBeGreaterThan(0)

  await page.goto(`/editor/${presentation.id}`, { timeout: 30000 })
  await expect(page.locator('.slide-canvas')).toBeVisible({ timeout: 30000 })
  return presentation.id
}

export async function selectSlide(page, index) {
  const thumbnail = page.getByTestId('slide-panel-item').nth(index)
  await thumbnail.scrollIntoViewIfNeeded()
  await thumbnail.click()
  await expect(page.locator('.slide-canvas')).toBeVisible({ timeout: 30000 })
}

export async function screenshotSlide(page, auditRun, deckName, index) {
  const slug = deckName.replace(/\.pptx$/i, '').replace(/[^a-z0-9_-]+/gi, '_')
  const screenshot = path.join(auditRun.screenshotDir, `${slug}-slide-${String(index + 1).padStart(2, '0')}.png`)
  const box = await page.locator('.slide-canvas').boundingBox()
  expect(box).toBeTruthy()
  await page.screenshot({
    path: screenshot,
    clip: {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    },
  })
  return screenshot
}

export function createAuditRunPaths(rootDir, runId = null) {
  const id = runId || `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
  const runDir = path.join(rootDir, 'pptx-import-real-browser-audit-runs', id)
  return {
    id,
    runDir,
    screenshotDir: path.join(runDir, 'screenshots'),
    reportJson: path.join(runDir, 'pptx-import-real-browser-audit.json'),
    reportMd: path.join(runDir, 'pptx-import-real-browser-audit.md'),
    latestPointer: path.join(rootDir, 'pptx-import-real-browser-audit-latest.json'),
  }
}

export function ensureAuditRunDirs(paths) {
  fs.mkdirSync(paths.screenshotDir, { recursive: true })
}

export function hashCorpusFiles(pptxDir, deckNames) {
  return deckNames.map((name) => {
    const filePath = path.join(pptxDir, name)
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    return { name, bytes: fs.statSync(filePath).size, sha256: hash }
  })
}

export function buildAuditMetadata({ pptxDir, deckNames, browserName }) {
  return {
    generatedAt: new Date().toISOString(),
    corpus: pptxDir,
    corpusFiles: hashCorpusFiles(pptxDir, deckNames),
    browserName,
    chromiumVersion: process.env.PLAYWRIGHT_CHROMIUM_VERSION || null,
    viewport: AUDIT_VIEWPORT,
    os: { platform: os.platform(), release: os.release(), arch: os.arch() },
    strictMode: process.env.PPTX_IMPORT_AUDIT_STRICT === '1',
  }
}

export function classifyOutOfCanvas(entry, allowlist = []) {
  if (entry.type === 'text' || entry.type === 'image') {
    return { bucket: 'unexpected', reason: 'text-or-image-cannot-be-bleed' }
  }
  if (entry.hasPointerInteraction) {
    return { bucket: 'unexpected', reason: 'interactive-element-cannot-be-bleed' }
  }
  const allowed = allowlist.find(
    (item) => item.deck === entry.deck && item.slide === entry.slide && item.id === entry.id
  )
  if (allowed) return { bucket: 'acceptedBleed', reason: allowed.reason }
  const patternAllowed = explicitDecorativeBleedReason(entry)
  if (patternAllowed) return { bucket: 'acceptedBleed', reason: patternAllowed }
  const thin = Math.min(entry.width, entry.height) <= 12
  const oversized = entry.width >= entry.canvasWidth * 0.8 || entry.height >= entry.canvasHeight * 0.8
  const nearAxis = entry.width >= entry.height * 4 || entry.height >= entry.width * 4
  if ((entry.type === 'shape' || entry.type === 'line' || entry.type === 'svg') && thin && oversized && nearAxis) {
    return { bucket: 'acceptedBleedCandidate', reason: 'thin-decorative-strip-needs-source-evidence' }
  }
  return { bucket: 'unexpected', reason: 'not-decorative-bleed' }
}

export function classifyImageClipping(entry) {
  if (entry.hasSourceCrop && entry.cropDataPresent) return { bucket: 'intentionalImageCrop', reason: 'source-crop' }
  return { bucket: 'unexpectedImageClipping', reason: entry.reason || 'image-outside-wrapper' }
}

export function sanitizeDiagnosticText(value, maxLength = 240) {
  const raw = String(value || '')
  const summary = `[redacted diagnostic: ${raw.length} chars]`
  if (summary.length <= maxLength) return summary
  return '[redacted]'
}

function inRange(value, min, max) {
  return value >= min && value <= max
}

function explicitDecorativeBleedReason(entry) {
  if (entry.type !== 'shape') return null
  if (entry.deck === 'Bai3_HinhChieuVuongGoc.pptx') {
    if (inRange(entry.slide, 8, 82) && inRange(entry.x, -15, 0) && inRange(entry.y, 50, 70) && inRange(entry.width, 1148, 1165) && entry.height <= 8) {
      return 'explicit-allowlist: repeated top divider strip extends beyond slide edges in source deck screenshots'
    }
    if (inRange(entry.slide, 27, 56) && entry.width >= 1090 && entry.width <= 1165 && entry.height >= 35 && entry.height <= 80) {
      return 'explicit-allowlist: repeated full-width decorative header/body band with slight edge overscan'
    }
    if (inRange(entry.slide, 57, 80) && inRange(entry.x, 10, 18) && inRange(entry.y, -16, -10) && inRange(entry.width, 24, 32) && inRange(entry.height, 24, 32)) {
      return 'explicit-allowlist: repeated decorative top marker intentionally bleeds above slide'
    }
    if (entry.slide === 15 && entry.x < 0 && inRange(entry.width, 580, 600) && inRange(entry.height, 65, 90)) {
      return 'explicit-allowlist: slide 15 layered title/background shape intentionally starts off-canvas'
    }
    if (entry.slide === 18 && entry.x > 420 && entry.y > 540 && entry.width >= 720 && entry.height <= 60) {
      return 'explicit-allowlist: slide 18 bottom decorative band extends past right edge'
    }
  }
  if (entry.deck === 'Bai_2_1.pptx' && entry.slide === 10 && inRange(entry.x, 968, 972) && inRange(entry.width, 168, 172)) {
    return 'explicit-allowlist: slide 10 right-side decorative shape has 4px source edge overscan'
  }
  if (entry.deck === 'Bai_2_5.pptx' && entry.slide === 32 && inRange(entry.x, 160, 175) && inRange(entry.y, 322, 336) && inRange(entry.width, 855, 875) && inRange(entry.height, 308, 322)) {
    return 'explicit-allowlist: slide 32 rotated-group shape extends ~5px past the bottom edge, matching the source deck overflow'
  }
  if (entry.deck === 'STTre_Duc.pptx' && entry.slide === 20 && entry.width >= 1030 && entry.height <= 50) {
    return 'explicit-allowlist: final-slide decorative underline extends slightly past right edge'
  }
  return null
}

export function classifyTextOverflow(issue) {
  if (issue.elementType === 'shape') return 'shape-text-foreign-object'
  const whiteSpace = String(issue.whiteSpace || '').toLowerCase()
  const wordBreak = String(issue.wordBreak || '').toLowerCase()
  const overflowWrap = String(issue.overflowWrap || '').toLowerCase()
  const fontSize = Number(issue.fontSizePx)
  const lineHeight = Number(issue.lineHeightPx)
  const verticalOnly = issue.overflowY > 3 && issue.overflowX <= 3
  if (issue.overflowX > 3 && (whiteSpace.includes('nowrap') || (wordBreak === 'normal' && overflowWrap === 'normal'))) {
    return 'nowrap-or-unbreakable'
  }
  if (verticalOnly && Number.isFinite(fontSize) && Number.isFinite(lineHeight) && lineHeight > fontSize * 1.45) {
    return 'line-height-too-large'
  }
  if (Number.isFinite(fontSize) && (fontSize > issue.height * 0.6 || fontSize > issue.width * 0.25)) {
    return 'font-too-large'
  }
  if (issue.marginTopPx > 0 || issue.marginBottomPx > 0) return 'paragraph-margin'
  if (issue.hasTextInsets && issue.overflowX > 3) return 'text-inset-shrinks-box'
  return 'unknown/insufficient-source-data'
}
