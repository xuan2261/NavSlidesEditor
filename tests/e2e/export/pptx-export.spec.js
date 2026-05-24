import { existsSync, readFileSync, statSync } from 'node:fs'
import JSZip from 'jszip'
import { test, expect, apiUpdatePresentation } from '../fixtures/test-fixtures.js'

const PPTX_SLIDES = [
  {
    id: 'slide-pptx-1',
    elements: [
      {
        id: 'text-pptx-1',
        type: 'text',
        x: 100,
        y: 100,
        width: 640,
        height: 100,
        content: '<h1>Hello PPTX</h1>',
        zIndex: 1,
      },
    ],
    notes: '',
    background: { type: 'color', color: '#1e1e2e' },
  },
]

test.describe('PPTX export', () => {
  test('File menu exports a valid pptx download with slide text', async ({ page, request, testPresentation }) => {
    await page.addInitScript(() => {
      window.__E2E__ = true
      window.localStorage.setItem('navSlidesTutorialSeen', 'true')
      window.localStorage.setItem('navSlidesProductTourSeen', 'true')
    })
    await apiUpdatePresentation(request, testPresentation.id, { slides: PPTX_SLIDES })
    await page.goto(`/editor/${testPresentation.id}`)

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await page.getByTestId('ribbon-file-menu-trigger').click()
    await page.getByTestId('ribbon-file-export-pptx').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/\.pptx$/)
    const downloadPath = await download.path()
    expect(downloadPath).toBeTruthy()
    expect(existsSync(downloadPath)).toBe(true)
    expect(statSync(downloadPath).size).toBeGreaterThan(1000)

    const zip = await JSZip.loadAsync(readFileSync(downloadPath))
    expect(zip.file('ppt/presentation.xml')).not.toBeNull()
    expect(zip.file('[Content_Types].xml')).not.toBeNull()

    const slideXml = await zip.file('ppt/slides/slide1.xml').async('string')
    expect(slideXml).toContain('Hello PPTX')
  })
})
