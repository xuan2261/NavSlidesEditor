// Real Chromium PNG decoding; synthetic source package, not native qualification.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { chromium } from 'playwright'
import { createCanvas } from '@napi-rs/canvas'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pictureFixture } from './semantic-picture-fixture'
import renderer from '../../shared/src/pptx-picture-svg'
import renderTree from '../../shared/src/pptx-semantic-render-tree'
import operations from '../../shared/src/pptx-projection-operation'

let browser, page, uploadsDir
beforeAll(async () => {
  browser = await chromium.launch({ headless: true })
  page = await browser.newPage()
})
afterAll(async () => {
  await page?.close()
  await browser?.close()
})
beforeEach(async () => {
  uploadsDir = await mkdtemp(join(tmpdir(), 'picture-browser-'))
})
afterEach(async () => {
  await rm(uploadsDir, { recursive: true, force: true })
})

async function pixels(presentation, bytes) {
  const element = renderTree.semanticRenderTree(
    presentation.pptxSemantic,
    presentation.slides[0]
  )[0].element
  const svg = renderer
    .pictureSvg(element, () => `data:image/png;base64,${bytes.toString('base64')}`)
    .replace('width="100%" height="100%"', 'width="100" height="80"')
  return page.evaluate(async (svg) => {
    const image = new Image()
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error('Browser failed to decode canonical picture SVG/PNG'))
    })
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 80
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const samples = [
      [50, 40],
      [3, 40],
      [0, 0],
      [25, 40],
      [75, 40],
    ].map(([x, y]) => [...context.getImageData(x, y, 1, 1).data])
    document.body.replaceChildren(image)
    return samples
  }, svg)
}

describe('canonical picture paint with actual Chromium image decoding', () => {
  it('clamps ordered alpha stages and paints the outline independently', async () => {
    const image = createCanvas(100, 80),
      context = image.getContext('2d')
    context.fillStyle = 'rgba(255,0,0,0.8)'
    context.fillRect(0, 0, 100, 80)
    const bytes = image.toBuffer('image/png')
    const { presentation } = await pictureFixture({
      uploadsDir,
      imageBytes: bytes,
      crop: '',
      outline: '<a:ln w="95250"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:ln>',
    })
    const before = JSON.stringify(presentation)
    const result = await pixels(presentation, bytes)
    expect(result[0]).toEqual([255, 0, 0, 89])
    expect(result[1]).toEqual([18, 52, 86, 255])
    expect(result[2]).toEqual([0, 0, 0, 0])
    const element = presentation.slides[0].elements[0]
    const reversed = operations.applyPresentationProjectionOperation(presentation, {
      type: 'picture.edit',
      instanceId: element.pptxInstanceId,
      componentId: element.pptxPicture.componentId,
      command: { type: 'alpha', stages: [...element.pptxPicture.alpha].reverse() },
    })
    // The first transfer quantizes 204 * .35 to 71 before the next doubles it.
    expect((await pixels(reversed, bytes))[0]).toEqual([255, 0, 0, 142])
    expect(JSON.stringify(presentation)).toBe(before)
  })

  it('keeps native signed source outsets transparent with the original image bytes', async () => {
    const image = createCanvas(100, 80),
      context = image.getContext('2d')
    context.fillStyle = '#ff0000'
    context.fillRect(0, 0, 100, 80)
    const bytes = image.toBuffer('image/png')
    const { presentation } = await pictureFixture({
      uploadsDir,
      imageBytes: bytes,
      effects: '',
      crop: '<a:srcRect l="-100000"/>',
      outline: '<a:ln><a:noFill/></a:ln>',
    })
    const result = await pixels(presentation, bytes)
    expect(result[3]).toEqual([0, 0, 0, 0])
    expect(result[4]).toEqual([255, 0, 0, 255])
  })
})
