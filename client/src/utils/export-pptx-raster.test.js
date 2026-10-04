// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import { build } from 'esbuild'
import { chromium } from 'playwright'
import { renderElementFallbackDataUri } from './export-pptx-raster'

describe('export-pptx-raster', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns no QR raster when QR generation rejects so the caller can insert a placeholder', async () => {
    vi.spyOn(QRCode, 'toDataURL').mockRejectedValueOnce(new Error('QR payload is too large'))

    await expect(
      renderElementFallbackDataUri({
        type: 'qrcode',
        qrData: 'too-large',
        width: 180,
        height: 180,
      })
    ).resolves.toBeNull()
  })

  it('[cap:element.svg depth:export] preserves authored SVG paint and data-SVG video posters in real PNG captures', async () => {
    const bundle = await build({
      stdin: {
        contents:
          'export { renderElementFallbackDataUri } from "./export-pptx-raster.js"; export { resolveClientPptxPoster } from "./export-pptx-media.js";',
        resolveDir: __dirname,
      },
      bundle: true,
      platform: 'browser',
      format: 'iife',
      globalName: 'PptxCapture',
      write: false,
    })
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setContent('<html><body></body></html>')
      await page.addScriptTag({ content: bundle.outputFiles[0].text })
      const observed = await page.evaluate(async () => {
        const svg =
          '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80"/><script>window.compromised=true</script></svg>'
        const painted = await PptxCapture.renderElementFallbackDataUri({
          type: 'svg',
          content: svg,
          width: 240,
          height: 160,
          fillOverride: '#2563eb',
        })
        const poster = await PptxCapture.resolveClientPptxPoster(
          'data:image/svg+xml;base64,' + btoa(svg.replace('<rect ', '<rect fill="#2563eb" '))
        )
        window.parentProbe = 'protected'
        const html = await PptxCapture.renderElementFallbackDataUri({
          type: 'html',
          width: 120,
          height: 80,
          content:
            '<!doctype html><html><body><svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#ff0000"/></svg><script>try{parent.parentProbe="compromised"}catch{document.querySelector("rect").setAttribute("fill","#2563eb")}</script></body></html>',
        })
        const pixels = async (source) => {
          const image = new Image()
          image.src = source
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth
          canvas.height = image.naturalHeight
          const context = canvas.getContext('2d')
          context.drawImage(image, 0, 0)
          const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data
          let blue = 0
          for (let index = 0; index < bytes.length; index += 4)
            if (
              bytes[index] === 37 &&
              bytes[index + 1] === 99 &&
              bytes[index + 2] === 235 &&
              bytes[index + 3] > 0
            )
              blue++
          return { width: canvas.width, height: canvas.height, blue }
        }
        return {
          painted: await pixels(painted),
          poster: await pixels(poster),
          html: await pixels(html),
          parentProbe: window.parentProbe,
          compromised: window.compromised === true,
        }
      })
      expect(observed.painted).toMatchObject({ width: 480, height: 320 })
      expect(observed.painted.blue).toBeGreaterThan(10000)
      expect(observed.poster.blue).toBeGreaterThan(10000)
      expect(observed.html.blue).toBeGreaterThan(10000)
      expect(observed.parentProbe).toBe('protected')
      expect(observed.compromised).toBe(false)
    } finally {
      await browser.close()
    }
  }, 30000)
})
