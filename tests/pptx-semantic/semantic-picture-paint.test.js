// Production mask/filter math with a uniform image-loader adapter. The installed
// Skia SVG decoder does not paint embedded PNG <image> nodes. This does not test
// browser PNG decoding or establish PowerPoint/native corpus qualification.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { pictureFixture } from './semantic-picture-fixture'
import pictureRenderer from '../../shared/src/pptx-picture-svg'
import renderTree from '../../shared/src/pptx-semantic-render-tree'
import operations from '../../shared/src/pptx-projection-operation'
let uploadsDir
beforeEach(async () => { uploadsDir = await mkdtemp(join(tmpdir(), 'picture-paint-')) })
afterEach(async () => { await rm(uploadsDir, { recursive: true, force: true }) })
async function sample(presentation, bytes) {
  const element = renderTree.semanticRenderTree(presentation.pptxSemantic, presentation.slides[0])[0].element
  const raster = await loadImage(bytes)
  const rasterContext = createCanvas(100, 80).getContext('2d')
  rasterContext.drawImage(raster, 0, 0)
  const source = [...rasterContext.getImageData(50, 40, 1, 1).data]
  const allPixels = rasterContext.getImageData(0, 0, 100, 80).data
  for (let i = 0; i < allPixels.length; i++)
    expect(allPixels[i]).toBe(source[i % 4])
  const svg = pictureRenderer.pictureSvg(element)
    .replace('width="100%" height="100%"', 'width="100" height="80"')
    // Preserve the production destination/crop transform and filter attachment.
    // A constant-color PNG and this rectangle have identical source pixels.
    .replace(/<image ([^>]+)\/>/g, (_match, attrs) =>
      `<rect ${attrs.replace(/\s(?:href|preserveAspectRatio)="[^"]*"/g, '')} fill="rgb(${source.slice(0, 3).join(',')})" fill-opacity="${source[3] / 255}"/>`)
  const image = await loadImage(Buffer.from(svg))
  const context = createCanvas(100, 80).getContext('2d')
  context.drawImage(image, 0, 0)
  return (x, y) => [...context.getImageData(x, y, 1, 1).data]
}
describe('picture source crop and alpha raster witnesses', () => {
  it('clamps every alpha stage independently and never attenuates native outline paint', async () => {
    const image = createCanvas(100, 80), ctx = image.getContext('2d')
    ctx.fillStyle = 'rgba(255,0,0,0.8)'
    ctx.fillRect(0, 0, 100, 80)
    const bytes = image.toBuffer('image/png')
    const { presentation } = await pictureFixture({ uploadsDir, imageBytes: bytes, crop: '',
      outline: '<a:ln w="95250"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:ln>' })
    const pixel = await sample(presentation, bytes)
    expect(pixel(50, 40)).toEqual([255, 0, 0, 89])
    expect(pixel(3, 40)).toEqual([18, 52, 86, 255])
    expect(pixel(0, 0)).toEqual([0, 0, 0, 0])
    const element = presentation.slides[0].elements[0]
    const reversed = operations.applyPresentationProjectionOperation(presentation, {
      type: 'picture.edit', instanceId: element.pptxInstanceId,
      componentId: element.pptxPicture.componentId,
      command: { type: 'alpha', stages: [...element.pptxPicture.alpha].reverse() },
    })
    expect((await sample(reversed, bytes))(50, 40)).toEqual([255, 0, 0, 142])
  })
  it('renders signed source outsets as transparent coverage rather than clamping the source rect', async () => {
    const image = createCanvas(100, 80), ctx = image.getContext('2d')
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 100, 80)
    const bytes = image.toBuffer('image/png')
    const { presentation } = await pictureFixture({ uploadsDir, imageBytes: bytes, effects: '',
      crop: '<a:srcRect l="-100000"/>', outline: '<a:ln><a:noFill/></a:ln>' })
    const pixel = await sample(presentation, bytes)
    expect(pixel(25, 40)).toEqual([0, 0, 0, 0])
    expect(pixel(75, 40)).toEqual([255, 0, 0, 255])
    expect(presentation.slides[0].elements[0].pptxPictureGeometry.width).toBe(952500)
  })
})
