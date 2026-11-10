const { chromium } = require('@playwright/test')
const { geometryJourney } = require('../e2e/helpers/pptx-semantic-media-journeys.js')
const { home, importFromHome, pinnedSource, selectElement, inspector, closeOverlay } = require('../e2e/helpers/pptx-semantic-ui-journey.js')

async function debug() {
  console.log('Starting debug journey...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:3202',
    viewport: { width: 1440, height: 1000 }
  })
  const page = await context.newPage()
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()))
  page.on('pageerror', err => console.log('PAGE ERROR:', err))
  setInterval(() => {
    console.log('CURRENT URL:', page.url())
  }, 2000)

  try {
    const sourceFile = await pinnedSource(geometryJourney.source)
    console.log('Source file pinned:', sourceFile)

    await page.addInitScript(() => {
      globalThis.localStorage.setItem('navSlidesTutorialSeen', 'true')
      globalThis.localStorage.setItem('editor-theme', 'light')
    })

    console.log('Navigating home...')
    await home(page)
    console.log('Home loaded. Starting importFromHome...')
    const owned = []
    const id = await importFromHome(page, sourceFile, page.getByTestId('home-import-pptx-input'), owned)
    console.log('Import finished, id:', id)

    const res = await page.request.get(`http://127.0.0.1:3202/api/presentations/${id}`)
    const before = await res.json()
    const target = geometryJourney.target(before)
    console.log('Target element:', target.element.id)

    console.log('Selecting element...')
    await selectElement(page, target, 'pointer')
    console.log('Element selected successfully!')

    const panel = await inspector(page, 'pointer')
    console.log('Inspector open.')
    console.log('PANEL HTML length:', (await panel.innerHTML()).length)
    const comboboxes = await panel.getByRole('combobox').all()
    console.log('Comboboxes count:', comboboxes.length)
    for (const cb of comboboxes) {
      console.log('Combobox aria-label:', await cb.getAttribute('aria-label'))
    }
    console.log('Looking for Native stroke cap combobox...')
    const select = panel.getByRole('combobox', { name: 'Native stroke cap', exact: true })
    const count = await select.count()
    console.log('Native stroke cap count:', count)
    if (count > 0) {
      console.log('Native stroke cap isVisible:', await select.isVisible())
    }
    console.log('Editing element via journey...')
    await geometryJourney.edit({ page, panel, target, interaction: 'pointer' })
    console.log('Edit completed!')

    await closeOverlay(page, 'pointer')
    console.log('Overlay closed.')
  } catch (err) {
    console.error('DEBUG JOURNEY ERROR:', err)
  } finally {
    await browser.close()
  }
}

debug()
