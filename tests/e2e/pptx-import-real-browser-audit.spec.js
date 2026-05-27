import fs from 'node:fs'
import path from 'node:path'
import { apiDeletePresentation, expect, test } from './fixtures/test-fixtures.js'
import { AUDIT_VIEWPORT, buildAuditMetadata, classifyImageClipping, classifyOutOfCanvas, classifyTextOverflow, createAuditRunPaths, ensureAuditRunDirs, importDeckViaHome, sanitizeDiagnosticText, screenshotSlide, selectAuditDecks, selectSlide } from './pages/pptx-import-audit-helper.js'
import { assertStrictAuditSummary, summarizeDecks, writeAuditReports } from './pages/pptx-import-audit-report-helper.js'

const PPTX_DIR = path.resolve(process.cwd(), 'PPTX')
const REPORT_DIR = path.resolve(process.cwd(), 'plans', 'reports')
const ALL_DECKS = fs.readdirSync(PPTX_DIR).filter((name) => name.toLowerCase().endsWith('.pptx')).sort()
const DECKS = selectAuditDecks(ALL_DECKS)
const auditRun = createAuditRunPaths(REPORT_DIR, process.env.PPTX_IMPORT_AUDIT_RUN_ID)
const auditResults = []
let metadata

async function auditCurrentSlide(page, deckName, index) {
  const screenshot = await screenshotSlide(page, auditRun, deckName, index)
  const audit = await page.evaluate(() => {
    const canvasNode = document.querySelector('.slide-canvas')
    if (!canvasNode) return { missingCanvas: true }
    const c = canvasNode.getBoundingClientRect()
    const elements = Array.from(document.querySelectorAll('[data-testid^="slide-element-"]'))
      const textOverflow = []
      const imageClipping = []
    const rawOutOfCanvas = []
    const zeroSized = []

    for (const node of elements) {
      const r = node.getBoundingClientRect()
      const entry = {
        id: node.getAttribute('data-element-id') || node.getAttribute('data-testid') || 'unknown',
        type: node.getAttribute('data-element-type') || 'unknown',
        x: Math.round(r.left - c.left),
        y: Math.round(r.top - c.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
        canvasWidth: Math.round(c.width),
        canvasHeight: Math.round(c.height),
        hasPointerInteraction: Boolean(node.querySelector('a, [onclick]') || node.getAttribute('data-has-action') === 'true'),
      }
      if (r.width < 1 || r.height < 1) zeroSized.push(entry)
      if (r.left < c.left - 2 || r.top < c.top - 2 || r.right > c.right + 2 || r.bottom > c.bottom + 2) {
        rawOutOfCanvas.push(entry)
      }
      for (const textNode of Array.from(node.querySelectorAll('.ProseMirror, [contenteditable], p, span'))) {
        if (!(textNode.textContent || '').trim()) continue
        const overflowX = textNode.scrollWidth - textNode.clientWidth
        const overflowY = textNode.scrollHeight - textNode.clientHeight
        if (overflowX > 3 || overflowY > 3) {
          const styles = window.getComputedStyle(textNode)
          const parsePx = (value) => {
            const parsed = Number.parseFloat(value)
            return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null
          }
          const text = textNode.textContent || ''
          const tokens = text.split(/\s+/).filter(Boolean)
          textOverflow.push({
            ...entry,
            elementType: entry.type,
            overflowX: Math.round(overflowX),
            overflowY: Math.round(overflowY),
            whiteSpace: styles.whiteSpace,
            wordBreak: styles.wordBreak,
            overflowWrap: styles.overflowWrap,
            display: styles.display,
            fontSizePx: parsePx(styles.fontSize),
            lineHeightPx: parsePx(styles.lineHeight),
            marginTopPx: parsePx(styles.marginTop) || 0,
            marginBottomPx: parsePx(styles.marginBottom) || 0,
            textCharCount: text.trim().length,
            longestTokenLength: tokens.reduce((max, token) => Math.max(max, token.length), 0),
            hasTextInsets: Boolean(node.style.paddingLeft || node.style.paddingRight),
          })
          break
        }
      }
      const img = node.querySelector('img')
      if (img) {
        const imgRect = img.getBoundingClientRect()
        const styles = window.getComputedStyle(img)
        const clippedByBox =
          imgRect.left < r.left - 2 || imgRect.top < r.top - 2 || imgRect.right > r.right + 2 || imgRect.bottom > r.bottom + 2
        if (clippedByBox || styles.objectFit === 'cover') {
          const issue = {
            ...entry,
            reason: styles.objectFit === 'cover' ? 'object-fit-cover' : 'image-outside-wrapper',
            hasSourceCrop: node.getAttribute('data-pptx-crop-intent') === 'source-crop',
          }
          if (issue.hasSourceCrop) {
            issue.cropDataPresent = Boolean(node.getAttribute('data-pptx-crop-data'))
          }
          imageClipping.push(issue)
        }
      }
    }
    return { missingCanvas: false, elementCount: elements.length, textOverflow, imageClipping, rawOutOfCanvas, zeroSized }
  })
  const buckets = { acceptedBleed: [], acceptedBleedCandidates: [], unexpectedOutOfCanvas: [] }
  audit.textOverflow = (audit.textOverflow || []).map((issue) => ({ ...issue, rootCause: classifyTextOverflow(issue) }))
  const intentionalImageCrop = []
  const unexpectedImageClipping = []
  for (const issue of audit.imageClipping || []) {
    const classified = classifyImageClipping(issue)
    if (classified.bucket === 'intentionalImageCrop') {
      intentionalImageCrop.push({ ...issue, classificationReason: classified.reason })
    } else {
      unexpectedImageClipping.push({ ...issue, classificationReason: classified.reason })
    }
  }
  audit.imageClipping = unexpectedImageClipping
  audit.intentionalImageCrop = intentionalImageCrop
  for (const entry of audit.rawOutOfCanvas || []) {
    const classified = classifyOutOfCanvas({ ...entry, deck: deckName, slide: index + 1 })
    const bucketName = classified.bucket === 'acceptedBleedCandidate' ? 'acceptedBleedCandidates' : `${classified.bucket}OutOfCanvas`
    buckets[bucketName]?.push({
      ...entry,
      classificationReason: classified.reason,
    })
    if (classified.bucket === 'acceptedBleed') buckets.acceptedBleed.push({ ...entry, classificationReason: classified.reason })
  }
  const status =
    audit.missingCanvas ||
    audit.textOverflow.length ||
    audit.imageClipping.length ||
    buckets.acceptedBleedCandidates.length ||
    buckets.unexpectedOutOfCanvas.length ||
    audit.zeroSized.length
      ? 'fail'
      : 'pass'
  return { index, screenshot, status, ...audit, ...buckets }
}

test.describe.serial('PPTX import real browser audit', () => {
  test.beforeAll(async ({ browserName }) => {
    ensureAuditRunDirs(auditRun)
    metadata = buildAuditMetadata({ pptxDir: PPTX_DIR, deckNames: DECKS, browserName })
  })

  test.afterAll(() => writeAuditReports(auditRun, metadata, auditResults))

  for (const deckName of DECKS) {
    test(`real browser import audit: ${deckName}`, async ({ page, request }) => {
      test.setTimeout(900000)
      await page.setViewportSize(AUDIT_VIEWPORT)
      await page.addInitScript(() => {
        window.__E2E__ = true
        window.localStorage.setItem('navSlidesTutorialSeen', 'true')
      })

      const deckResult = { deck: deckName, slideCount: 0, slides: [], consoleErrors: [] }
      page.on('console', (msg) => {
        if (msg.type() === 'error') deckResult.consoleErrors.push(sanitizeDiagnosticText(msg.text()))
      })

      let presentationId
      try {
        presentationId = await importDeckViaHome(page, PPTX_DIR, deckName)
        const thumbnails = page.getByTestId('slide-panel-item')
        await expect(thumbnails.first()).toBeVisible({ timeout: 30000 })
        deckResult.slideCount = await thumbnails.count()
        for (let index = 0; index < deckResult.slideCount; index += 1) {
          await selectSlide(page, index)
          deckResult.slides.push(await auditCurrentSlide(page, deckName, index))
        }
      } catch (error) {
        deckResult.importError = sanitizeDiagnosticText(error?.message || String(error))
      } finally {
        auditResults.push(deckResult)
        writeAuditReports(auditRun, metadata, auditResults)
        if (presentationId) await apiDeletePresentation(request, presentationId).catch(() => {})
      }

      expect(deckResult.importError || '').toBe('')
    })
  }

  test('strict audit fails while the raw baseline has strict categories', () => {
    test.skip(process.env.PPTX_IMPORT_AUDIT_STRICT !== '1', 'Strict mode is opt-in for release and local audit gates.')
    expect(assertStrictAuditSummary(summarizeDecks(auditResults))).toBe(true)
  })
})
