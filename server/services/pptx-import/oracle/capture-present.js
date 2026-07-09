/**
 * Capture NavSlides present-mode screenshots for oracle actuals.
 * Uses Playwright chromium against generateRevealHTML offline HTML.
 */
const fs = require('fs-extra')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')

const VIEWPORT = Object.freeze({ width: 960, height: 540 })

async function writePresentHtml(presentation, outFile) {
  let generateRevealHTML
  try {
    ;({ generateRevealHTML } = require('revealjs-shared'))
  } catch {
    ;({ generateRevealHTML } = require('../../../../shared/src/htmlGenerator.js'))
  }
  const html = generateRevealHTML(presentation)
  await fs.writeFile(outFile, html, 'utf8')
  return outFile
}

/**
 * @param {object} presentation
 * @param {{ outDir: string, deckStem: string, browser?: import('playwright').Browser }} options
 * @returns {Promise<{ ok: boolean, files: string[], error?: string }>}
 */
async function capturePresentSlides(presentation, options = {}) {
  const outDir = options.outDir
  const deckStem = options.deckStem || 'deck'
  if (!outDir) return { ok: false, files: [], error: 'outDir-required' }

  const slideCount = Math.max(1, (presentation?.slides || []).length)
  const deckDir = path.join(outDir, deckStem)
  await fs.ensureDir(deckDir)

  let chromium
  try {
    ;({ chromium } = require('playwright'))
  } catch (err) {
    return { ok: false, files: [], error: `playwright-missing: ${err.message}` }
  }

  const tmpHtml = path.join(os.tmpdir(), `pptx-oracle-present-${Date.now()}.html`)
  const browser = options.browser || (await chromium.launch({ headless: true }))
  const ownBrowser = !options.browser
  const files = []
  try {
    await writePresentHtml(presentation, tmpHtml)
    const page = await browser.newPage({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    })
    await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: 'load', timeout: 30_000 })
    // Allow fonts/layout to settle
    await page.waitForTimeout(200)

    for (let i = 0; i < slideCount; i += 1) {
      if (i > 0) {
        await page.keyboard.press('ArrowRight')
        await page.waitForTimeout(100)
      }
      const target = path.join(deckDir, `slide-${i}.png`)
      // Prefer reveal slide section; fallback full page
      const slide = page.locator('.reveal .slides section.present, .reveal .slides > section').first()
      if ((await slide.count()) > 0) {
        await slide.screenshot({ path: target })
      } else {
        await page.screenshot({ path: target, fullPage: false })
      }
      files.push(target)
    }
    await page.close()
    return { ok: true, files, viewport: VIEWPORT }
  } catch (err) {
    return { ok: false, files, error: err.message }
  } finally {
    await fs.unlink(tmpHtml).catch(() => {})
    if (ownBrowser) await browser.close().catch(() => {})
  }
}

module.exports = {
  VIEWPORT,
  writePresentHtml,
  capturePresentSlides,
}
