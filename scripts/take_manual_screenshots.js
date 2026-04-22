import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'docs/manual/screenshots')

// Ensure directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

/**
 * Capture screenshot of a specific element or full page
 * @param {import('playwright').Page} page
 * @param {string|null} selector
 * @param {string} filename
 */
async function capture(page, selector, filename) {
  const filepath = path.join(SCREENSHOT_DIR, filename)
  try {
    // Removed forced body background styling to avoid white text on white background issues.

    if (selector) {
      const element = page.locator(selector).first()
      await element.waitFor({ state: 'visible', timeout: 5000 })
      await element.screenshot({ path: filepath })
    } else {
      await page.screenshot({ path: filepath })
    }
    console.log(`[x] Captured: ${filename}`)
  } catch (err) {
    console.warn(`[!] Failed to capture ${filename}: ${err.message}`)
    // Fallback to full page if selector fails
    if (selector) {
      await page.screenshot({ path: filepath })
      console.log(`[x] Fallback capture (full page): ${filename}`)
    }
  }
}

async function run() {
  console.log('Starting NavSlides Playwright UI Capture...')

  // Launch browser
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 2, // High-res for print manual
    colorScheme: 'light',
  })
  const page = await context.newPage()

  // Set light theme in local storage before loading any page
  await page.addInitScript(() => {
    window.localStorage.setItem('editor-theme', 'light')
  })

  try {
    // 1. Home Page
    console.log(`Navigating to ${BASE_URL}...`)
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000) // Give it time to render properly
    await capture(page, null, '01_home_full.png')

    // 2. Editor Workspace
    // Navigate to a demo editor instance
    await page.goto(`${BASE_URL}/editor/demo`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(4000) // Wait for UI to render
    await capture(page, null, '02_editor_workspace.png')

    // 3. Toolbar
    // We try to target the top toolbar area, fallback to full page
    await capture(page, 'header', '03_editor_toolbar.png')

    // 4. Properties Panel (Right sidebar)
    await capture(page, 'aside.right-panel, .properties-panel', '04_properties_panel.png')

    // 5. Present Mode (Live)
    await page.goto(`${BASE_URL}/live/demo`, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)
    await capture(page, null, '05_present_mode.png')

    // 6. Chalkboard & Presenter Tools
    // Reveal.js chalkboard usually triggers with 'b' or 'c'
    await page.keyboard.press('c')
    await page.waitForTimeout(1000)
    await capture(page, null, '06_chalkboard_active.png')

    // Draw a sample line on chalkboard
    await page.mouse.move(400, 300)
    await page.mouse.down()
    await page.mouse.move(600, 500)
    await page.mouse.move(700, 400)
    await page.mouse.up()
    await capture(page, null, '07_chalkboard_drawing.png')

    // Slide Menu
    await page.keyboard.press('m')
    await page.waitForTimeout(1000)
    await capture(page, null, '08_slide_menu.png')

    console.log('Successfully completed automated UI captures.')
  } catch (error) {
    console.error('Critical Error taking screenshots:', error)
  } finally {
    await browser.close()
  }
}

run()
