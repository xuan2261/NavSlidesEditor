/**
 * Re-runnable documentation screenshot capture.
 *
 * Boots a headless Chromium against an ALREADY-RUNNING `npm run dev` (Vite :5173
 * + Express :3002), seeds presentations via the REST API, navigates to known UI
 * states, and writes deterministic PNGs to website/public/img/.
 *
 * This is intentionally NOT a Playwright *test* — it imports chromium directly
 * from the @playwright/test re-export, lives under scripts/ (not tests/), and is
 * never picked up by `npx playwright test`. Run it by hand after UI changes:
 *
 *   npm run dev        # in one terminal
 *   node scripts/capture-docs-screenshots.js
 *
 * It cleans up every presentation it creates (soft + permanent delete).
 */
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require('@playwright/test')

const WEB = 'http://localhost:5173'
const API = 'http://127.0.0.1:3002/api'
const OUT_DIR = path.resolve(__dirname, '..', 'website', 'public', 'img')

// Freeze animations, hide carets, suppress hover transitions — mirrors
// tests/e2e/pages/visual-snapshot-deterministic-freeze-and-helper.js so the
// images are deterministic across runs.
const FREEZE_CSS = `*, *::before, *::after {
  animation-duration: 0s !important; animation-delay: 0s !important;
  transition-duration: 0s !important; transition-delay: 0s !important;
  caret-color: transparent !important;
}
.blinking, .cursor-blink, *[data-blink] { animation: none !important; }`

async function preflight() {
  const ports = [
    [WEB, 'Vite dev server (5173)'],
    [`${API}/presentations`, 'Express API (3002)'],
  ]
  for (const [url, label] of ports) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      console.error(
        `\n✗ ${label} is not reachable at ${url} (${err.message}).\n` +
          `  Start it first with:  npm run dev\n`
      )
      process.exit(1)
    }
  }
}

// ── REST seeding ────────────────────────────────────────────────────────────
const created = []

async function createPresentation(body) {
  const res = await fetch(`${API}/presentations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`create failed: ${res.status} ${await res.text()}`)
  const pres = await res.json()
  created.push(pres.id)
  return pres
}

async function cleanup() {
  for (const id of created) {
    try {
      await fetch(`${API}/presentations/${id}`, { method: 'DELETE' })
      await fetch(`${API}/presentations/${id}/permanent`, { method: 'DELETE' })
    } catch (err) {
      console.warn(`  cleanup warning for ${id}: ${err.message}`)
    }
  }
}

// A single deck whose slides each showcase one element type, so element shots
// need no fragile Insert interactions — just navigate to the slide and crop.
function richDeckSlides() {
  const bg = { type: 'color', color: '#1e1e2e' }
  const slide = (elements) => ({ elements, notes: '', background: bg })
  return [
    slide([
      { type: 'text', x: 120, y: 180, width: 720, height: 200, zIndex: 1,
        content: '<h1 style="text-align:center">NavSlides Editor</h1><p style="text-align:center">A WYSIWYG deck for the docs</p>' },
    ]),
    slide([
      { type: 'chart', x: 230, y: 90, width: 500, height: 380, zIndex: 2, chartType: 'bar',
        chartData: { labels: ['Q1','Q2','Q3','Q4'], datasets: [{ label: 'Revenue', data: [12,19,15,22], color: '#6366f1' }] } },
    ]),
    slide([
      { type: 'code', x: 180, y: 90, width: 600, height: 320, zIndex: 2, language: 'javascript',
        content: 'function greet(name) {\n  return `Hello, ${name}!`\n}\n\ngreet("NavSlides")' },
    ]),
    slide([
      { type: 'latex', x: 230, y: 80, width: 500, height: 380, zIndex: 2, fontSize: 20, textColor: '#ffffff',
        content: 'E = mc^2' },
    ]),
    slide([
      { type: 'shape', x: 360, y: 160, width: 260, height: 200, zIndex: 1, shape: 'rect',
        fill: '#6366f1', stroke: 'none', strokeWidth: 0, borderRadius: 12, opacity: 1, text: 'Shape', fontSize: 18, textColor: '#ffffff' },
    ]),
    slide([
      { type: 'table', x: 180, y: 140, width: 600, height: 240, zIndex: 2, headerRow: true,
        data: [['Feature','Status'],['Charts','Done'],['Tables','Done']] },
    ]),
  ]
}

// ── Capture helpers ───────────────────────────────────────────────────────────
const captured = []
const skipped = []

async function settle(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.addStyleTag({ content: FREEZE_CSS }).catch(() => {})
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  )
}

async function shoot(page, name, opts = {}) {
  const file = path.join(OUT_DIR, `${name}.png`)
  try {
    await settle(page)
    const target = opts.locator ? page.locator(opts.locator).first() : page
    await target.screenshot({ path: file, mask: opts.mask?.map((s) => page.locator(s)) })
    captured.push(name)
    console.log(`  ✓ ${name}.png`)
  } catch (err) {
    skipped.push([name, err.message])
    console.warn(`  ⚠ skipped ${name}: ${err.message}`)
  }
}

async function gotoSlide(page, idx) {
  // Slide panel thumbnails use aria-label="Select slide N" (1-based).
  await page.locator(`[aria-label="Select slide ${idx + 1}"]`).first().click({ timeout: 5000 })
  await page.waitForTimeout(400)
}

async function run() {
  await preflight()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const deck = await createPresentation({
    title: 'Docs Screenshot Deck',
    theme: 'black',
    transition: 'slide',
    slides: richDeckSlides(),
  })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  })
  // Suppress tutorial / product-tour overlays before any page script runs.
  await context.addInitScript(() => {
    try {
      localStorage.setItem('navSlidesTutorialSeen', 'true')
      localStorage.setItem('navSlidesProductTourSeen', 'true')
    } catch {}
  })
  const page = await context.newPage()

  try {
    // Home dashboard
    await page.goto(WEB, { waitUntil: 'domcontentloaded' })
    await shoot(page, 'home-dashboard')

    // Editor — open the seeded deck
    await page.goto(`${WEB}/editor/${deck.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    await shoot(page, 'editor-empty', { mask: ['[data-testid="autosave-status"]', '.autosave-badge'] })

    // Ribbon tabs
    for (const [tab, name] of [['Insert', 'editor-ribbon-insert'], ['Design', 'editor-ribbon-design']]) {
      try {
        await page.getByRole('tab', { name: new RegExp(`^${tab}`, 'i') }).click({ timeout: 3000 })
        await page.waitForTimeout(300)
        await shoot(page, name)
      } catch (err) {
        skipped.push([name, err.message])
        console.warn(`  ⚠ skipped ${name}: ${err.message}`)
      }
    }

    // Element-specific slides (deck order: 0 title, 1 chart, 2 code, 3 latex, 4 shape, 5 table)
    const elementShots = [
      [1, 'editor-chart-element'],
      [2, 'editor-code-element'],
      [3, 'editor-latex-element'],
      [4, 'editor-shape-element'],
      [5, 'editor-table-element'],
    ]
    for (const [idx, name] of elementShots) {
      await gotoSlide(page, idx)
      await page.waitForTimeout(500)
      await shoot(page, name)
    }

    // Properties panel: select an element, then capture the right rail.
    await gotoSlide(page, 1)
    await page.waitForTimeout(300)
    try {
      await page.locator('[data-testid^="slide-element-"]').first().click({ timeout: 3000 })
      await page.waitForTimeout(300)
    } catch {}
    await shoot(page, 'editor-properties-panel')

    // Settings page
    await page.goto(`${WEB}/settings`, { waitUntil: 'domcontentloaded' })
    await shoot(page, 'settings-page')

    console.log(`\nDone. ${captured.length} captured, ${skipped.length} skipped.`)
    if (skipped.length) {
      console.log('Skipped (UI state not single-page reachable in this run):')
      for (const [n, why] of skipped) console.log(`  - ${n}: ${why}`)
    }
  } finally {
    await browser.close()
    await cleanup()
  }
}

run().catch(async (err) => {
  console.error('\nCapture failed:', err)
  await cleanup()
  process.exit(1)
})
