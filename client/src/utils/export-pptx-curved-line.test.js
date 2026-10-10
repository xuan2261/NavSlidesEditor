// @vitest-environment node
import { describe, expect, it } from 'vitest'
import pptxgen from 'pptxgenjs'
import JSZip from 'jszip'
import { JSDOM } from 'jsdom'
import { addElementToPptxSlide } from './export-pptx-renderers'
import raster from '../../../server/utils/server-raster.js'

const line = {
  id: 'line',
  type: 'line',
  x: 0,
  y: 0,
  width: 400,
  height: 200,
  stroke: '#ff00ff',
  strokeWidth: 4,
}
const render = (pptx, element) =>
  addElementToPptxSlide({
    slide: pptx.addSlide(),
    element,
    pptx,
    warnings: [],
    slideNumber: 1,
    resolution: { width: 960, height: 540 },
    layout: { width: 10, height: 5.625 },
  })

describe('client curved-line static export', () => {
  it('requires a real capture for a finite quadratic control point including zero', async () => {
    await expect(render(new pptxgen(), { ...line, cx: 0, cy: 20 })).rejects.toThrow(
      /capture|raster/i
    )
  })

  it('places a real overflowing curve capture around the authored rotation pivot', async () => {
    const element = { ...line, x1: 10, y1: 180, x2: 390, y2: 180, cx: 200, cy: -220, rotation: 30 }
    const rasterOverrides = await raster.getServerRasters({
      resolution: { width: 960, height: 540 },
      slides: [{ id: 'slide', elements: [element] }],
    })
    const pptx = new pptxgen()
    await addElementToPptxSlide({
      slide: pptx.addSlide(),
      element,
      pptx,
      rasterOverrides,
      warnings: [],
      slideNumber: 1,
      resolution: { width: 960, height: 540 },
      layout: { width: 10, height: 5.625 },
    })
    const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }))
    const document = new JSDOM(await zip.file('ppt/slides/slide1.xml').async('string'), {
      contentType: 'text/xml',
    }).window.document
    const picture = document.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/presentationml/2006/main',
      'pic'
    )[0]
    const drawingNs = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    const transform = picture.getElementsByTagNameNS(drawingNs, 'xfrm')[0]
    const offset = transform.getElementsByTagNameNS(drawingNs, 'off')[0]
    const extent = transform.getElementsByTagNameNS(drawingNs, 'ext')[0]
    expect(transform.getAttribute('rot')).toBe('1800000')
    expect(Number(offset.getAttribute('x')) / 914400).toBeCloseTo(5.5 / 96, 3)
    expect(Number(offset.getAttribute('y')) / 914400).toBeCloseTo(
      (-11 - 11 * Math.cos(Math.PI / 6)) / 96,
      3
    )
    expect(Number(extent.getAttribute('cx')) / 914400).toBeCloseTo(400 / 96, 3)
    expect(Number(extent.getAttribute('cy')) / 914400).toBeCloseTo(222 / 96, 3)
    // The quadratic minimum is -20; its 2px stroke expands the top to -22.
    // Reconstruct the authored midpoint independently of capture geometry metadata.
    const expandedLeft = 0
    const expandedTop = -22
    const pictureWidth = Number(extent.getAttribute('cx')) / 914400
    const pictureHeight = Number(extent.getAttribute('cy')) / 914400
    const centerX = Number(offset.getAttribute('x')) / 914400 + pictureWidth / 2
    const centerY = Number(offset.getAttribute('y')) / 914400 + pictureHeight / 2
    const midpointX = (element.width / 2 - expandedLeft) / 96 - pictureWidth / 2
    const midpointY = (element.height / 2 - expandedTop) / 96 - pictureHeight / 2
    const angle = ((Number(transform.getAttribute('rot')) / 60000) * Math.PI) / 180
    expect(centerX + midpointX * Math.cos(angle) - midpointY * Math.sin(angle)).toBeCloseTo(
      (element.x + element.width / 2) / 96,
      3
    )
    expect(centerY + midpointX * Math.sin(angle) + midpointY * Math.cos(angle)).toBeCloseTo(
      (element.y + element.height / 2) / 96,
      3
    )
    const media = Object.values(zip.files).find(
      (file) => !file.dir && file.name.startsWith('ppt/media/') && file.name.endsWith('.png')
    )
    const png = await media.async('nodebuffer')
    expect(png.readUInt32BE(16) / png.readUInt32BE(20)).toBeCloseTo(400 / 222, 2)
  }, 60000)

  it('keeps an authored straight line as a native editable line', async () => {
    const pptx = new pptxgen()
    await render(pptx, line)
    const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }))
    const document = new JSDOM(await zip.file('ppt/slides/slide1.xml').async('string'), {
      contentType: 'text/xml',
    }).window.document
    const drawingNs = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    expect(document.getElementsByTagNameNS(drawingNs, 'prstGeom')[0].getAttribute('prst')).toBe(
      'line'
    )
    expect(
      document.getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/presentationml/2006/main',
        'pic'
      )
    ).toHaveLength(0)
  })
})
