// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { JSDOM } from 'jsdom'
import JSZip from 'jszip'
import exporter from './server-export.js'
import raster from './server-raster.js'

const curve = {
  id: 'curve',
  type: 'line',
  x: 96,
  y: 54,
  width: 400,
  height: 200,
  x1: 10,
  y1: 180,
  x2: 390,
  y2: 180,
  cx: 200,
  cy: 20,
  stroke: '#ff00ff',
  strokeWidth: 8,
  rotation: 10,
}
const straight = { ...curve, id: 'straight', cx: undefined, cy: undefined }
const deck = {
  resolution: { width: 960, height: 540 },
  slides: [
    { id: 'curved-slide', elements: [curve] },
    { id: 'straight-slide', elements: [straight] },
  ],
}
const xmlDocument = (xml) => new JSDOM(xml, { contentType: 'text/xml' }).window.document

async function inspectPixels(data, sampleY, sampleX = 0.5) {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    return await page.evaluate(
      async ({ source, sampleY, sampleX }) => {
        const image = new Image()
        await new Promise((resolve, reject) => {
          image.onload = resolve
          image.onerror = reject
          image.src = source
        })
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(image, 0, 0)
        const pixel = (y, x = 0.5) => [
          ...ctx.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1)
            .data,
        ]
        return {
          width: canvas.width,
          height: canvas.height,
          curveMidpoint: pixel(sampleY, sampleX),
          straightMidpoint: pixel(0.9),
        }
      },
      { source: data, sampleY, sampleX }
    )
  } finally {
    await browser.close()
  }
}

describe('actual curved-line PPTX capture', () => {
  it.each([
    {
      name: 'in-bounds',
      cy: 20,
      width: 400,
      height: 200,
      expandedLeft: 0,
      expandedTop: 0,
      x: 96,
      y: 54,
      sampleY: 0.5,
    },
    {
      name: 'overflowing',
      cy: -220,
      width: 400,
      height: 224,
      expandedLeft: 0,
      expandedTop: -24,
      x: 96 + 12 * Math.sin(Math.PI / 18),
      y: 54 - 12 - 12 * Math.cos(Math.PI / 18),
      sampleY: 4 / 224,
    },
    {
      name: 'overflowing marker',
      cy: 20,
      arrowEnd: 'diamond',
      width: 540,
      height: 260,
      expandedLeft: -70,
      expandedTop: 0,
      x: 26 - 30 * Math.sin(Math.PI / 18),
      y: 24 + 30 * Math.cos(Math.PI / 18),
      sampleX: 484 / 540,
      sampleY: 190 / 260,
    },
  ])(
    'preserves the $name quadratic pixels and original rotation pivot while straight lines remain native',
    async (expected) => {
      const directory = await mkdtemp(path.join(tmpdir(), 'curve-pptx-'))
      try {
        const filePath = path.join(directory, 'curve.pptx')
        const presentation = structuredClone(deck)
        presentation.slides[0].elements[0].cy = expected.cy
        presentation.slides[0].elements[0].arrowEnd = expected.arrowEnd
        await exporter.exportToFile(presentation, filePath)
        const zip = await JSZip.loadAsync(await readFile(filePath))
        const curvedDocument = xmlDocument(await zip.file('ppt/slides/slide1.xml').async('string'))
        const straightDocument = xmlDocument(
          await zip.file('ppt/slides/slide2.xml').async('string')
        )
        const presentationNs = 'http://schemas.openxmlformats.org/presentationml/2006/main'
        const drawingNs = 'http://schemas.openxmlformats.org/drawingml/2006/main'
        expect(curvedDocument.getElementsByTagNameNS(presentationNs, 'pic')).toHaveLength(1)
        expect(straightDocument.getElementsByTagNameNS(presentationNs, 'pic')).toHaveLength(0)
        const picture = curvedDocument.getElementsByTagNameNS(presentationNs, 'pic')[0]
        const transform = picture.getElementsByTagNameNS(drawingNs, 'xfrm')[0]
        expect(transform.getAttribute('rot')).toBe('600000')
        const offset = transform.getElementsByTagNameNS(drawingNs, 'off')[0]
        const extent = transform.getElementsByTagNameNS(drawingNs, 'ext')[0]
        expect(Number(offset.getAttribute('x')) / 914400).toBeCloseTo(expected.x / 96, 3)
        expect(Number(offset.getAttribute('y')) / 914400).toBeCloseTo(expected.y / 96, 3)
        expect(Number(extent.getAttribute('cx')) / 914400).toBeCloseTo(expected.width / 96, 3)
        expect(Number(extent.getAttribute('cy')) / 914400).toBeCloseTo(expected.height / 96, 3)
        // Independently known expanded bounds put the authored midpoint inside the PNG.
        // Reconstruct its world position using only the serialized picture transform.
        const pictureWidth = Number(extent.getAttribute('cx')) / 914400
        const pictureHeight = Number(extent.getAttribute('cy')) / 914400
        const centerX = Number(offset.getAttribute('x')) / 914400 + pictureWidth / 2
        const centerY = Number(offset.getAttribute('y')) / 914400 + pictureHeight / 2
        const midpointX = (curve.width / 2 - expected.expandedLeft) / 96 - pictureWidth / 2
        const midpointY = (curve.height / 2 - expected.expandedTop) / 96 - pictureHeight / 2
        const angle = ((Number(transform.getAttribute('rot')) / 60000) * Math.PI) / 180
        expect(centerX + midpointX * Math.cos(angle) - midpointY * Math.sin(angle)).toBeCloseTo(
          (curve.x + curve.width / 2) / 96,
          3
        )
        expect(centerY + midpointX * Math.sin(angle) + midpointY * Math.cos(angle)).toBeCloseTo(
          (curve.y + curve.height / 2) / 96,
          3
        )
        expect(
          straightDocument.getElementsByTagNameNS(drawingNs, 'prstGeom')[0].getAttribute('prst')
        ).toBe('line')
        const media = Object.values(zip.files).find(
          (file) => !file.dir && file.name.startsWith('ppt/media/') && file.name.endsWith('.png')
        )
        const pixels = await inspectPixels(
          `data:image/png;base64,${await media.async('base64')}`,
          expected.sampleY,
          expected.sampleX
        )
        expect(pixels.width / pixels.height).toBeCloseTo(expected.width / expected.height, 2)
        expect(pixels.curveMidpoint).toEqual([255, 0, 255, 255])
        expect(pixels.straightMidpoint).not.toEqual([255, 0, 255, 255])
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    },
    60000
  )

  it('rejects an unavailable curve capture instead of exporting a straight approximation or placeholder', async () => {
    await expect(raster.getServerRasters(deck, { capture: async () => ({}) })).rejects.toThrow(
      /curve|line|capture/i
    )
  })
})
