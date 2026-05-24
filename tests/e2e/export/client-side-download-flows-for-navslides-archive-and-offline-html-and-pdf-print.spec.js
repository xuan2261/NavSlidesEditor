import { test, expect } from '@playwright/test'
import { EditorPage } from '../pages/editor-page.js'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'

const SAMPLE_SLIDES = [
  {
    id: 'slide-1',
    elements: [
      { id: 'text-1', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<h1>Slide One</h1>' },
    ],
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  },
  {
    id: 'slide-2',
    elements: [
      { id: 'text-2', type: 'text', x: 100, y: 100, width: 600, height: 80, content: '<p>Body text</p>' },
    ],
    notes: '',
    background: { type: 'color', color: '#0f172a' },
  },
]

async function withSeededPresentation({ request, page }, fn) {
  const pres = await apiCreatePresentation(request, 'Client export E2E')
  await apiUpdatePresentation(request, pres.id, { slides: SAMPLE_SLIDES })
  const editor = new EditorPage(page)
  await editor.gotoPresentation(pres.id)
  try {
    await fn({ editor, pres })
  } finally {
    try { await apiDeletePresentation(request, pres.id) } catch {}
  }
}

test.describe('Client side download flows for navslides project archive and offline HTML and PDF print', () => {
  test('exports navslides JSON archive when no local media present', async ({ page, request }) => {
    await withSeededPresentation({ request, page }, async ({ editor }) => {
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
      await editor.menubar.openFileMenuItem('Export Project')
      const download = await downloadPromise
      const name = download.suggestedFilename()
      expect(name).toMatch(/\.navslides(\.json)?$/)
      const path = await download.path()
      expect(path).toBeTruthy()
    })
  })

  test('exports offline HTML with no remote CDN scripts', async ({ page, request }) => {
    await withSeededPresentation({ request, page }, async ({ editor }) => {
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
      await editor.menubar.openFileMenuItem('Export Offline HTML')
      const download = await downloadPromise
      const name = download.suggestedFilename()
      expect(name).toMatch(/\.html$/)
      const path = await download.path()
      expect(path).toBeTruthy()
      const fs = await import('node:fs/promises')
      const html = await fs.readFile(path, 'utf8')
      expect(html.length).toBeGreaterThan(1000)
      expect(html).not.toMatch(/src=["']https:\/\/cdn\.jsdelivr\.net/)
      expect(html).not.toMatch(/src=["']https:\/\/unpkg\.com/)
      expect(html).not.toMatch(/src=["']https:\/\/cdnjs\.cloudflare\.com/)
    })
  })

  test('exports HTML via Export HTML menu item', async ({ page, request }) => {
    await withSeededPresentation({ request, page }, async ({ editor }) => {
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
      await editor.menubar.openFileMenuItem('Export HTML')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/\.html$/)
      const path = await download.path()
      expect(path).toBeTruthy()
    })
  })

  test('PDF export menu opens new window with print HTML', async ({ page, request, context }) => {
    await withSeededPresentation({ request, page }, async ({ editor }) => {
      const popupPromise = context.waitForEvent('page', { timeout: 15000 })
      await editor.menubar.openFileMenuItem('Export PDF')
      const popup = await popupPromise
      await popup.waitForLoadState('domcontentloaded', { timeout: 15000 })
      const html = await popup.content()
      expect(html.length).toBeGreaterThan(500)
      expect(html.toLowerCase()).toMatch(/section|reveal|slide/)
      await popup.close()
    })
  })
})
