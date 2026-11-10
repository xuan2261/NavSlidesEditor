import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { expect, it } from 'vitest'
import JSZip from 'jszip'
import { geometryStyleFixture, authored, styleLocation } from './geometry-style-fixture.js'
const layout = 'ppt/slideLayouts/slideLayout1.xml'
function fixture(fill = 'darken', alpha = 255) {
  const document = geometryStyleFixture(), zip = new JSZip()
  const bytes = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([100, 150, 200, alpha]) })
  const asset = { partUri: 'ppt/media/source.png', preconditionHash: createHash('sha256').update(bytes).digest('hex'),
    byteLength: bytes.length, width: 1, height: 1, format: 'png', src: '/uploads/original.png' }
  zip.file(asset.partUri, bytes)
  document.styles.image = { kind: 'geometry-blip-binding', origin: 'source',
    source: styleLocation(layout, [0, 0, 0]), payload: { asset, edge: {
      fromPartUri: layout, toPartUri: asset.partUri, relationshipId: 'imageOne',
      type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
      source: styleLocation('ppt/slideLayouts/_rels/slideLayout1.xml.rels'),
    } } }
  document.styles.provider.payload.properties.fill = authored({ blip: authored({
    embed: authored('imageOne'), bindingId: 'image', stretch: authored({}),
  }) })
  document.definitions.definition.content.geometry.paths[0].fill = fill
  const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
  return { document: normalizePptxSemanticDocument(document), zip, bytes }
}
const require = createRequire(import.meta.url)
// Test-only codec; production must declare its own decoder dependency.
const { PNG } = require('pngjs')
const { createMediaTransaction } = require('../../server/services/pptx-import/media-dedup')
const { createMediaBudget } = require('../../server/services/pptx-import/resource-budgets')
const modes = ['lighten', 'lightenLess', 'darken', 'darkenLess']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const sourcePixels = Buffer.from([100, 150, 200, 255, 0, 85, 170, 255, 255, 128, 64, 255, 1, 2, 3, 255])
const source = (pixels = sourcePixels) => PNG.sync.write({ width: 4, height: 1, data: pixels }, { colorType: 6 })
const asset = bytes => ({ partUri: 'ppt/media/source.png', preconditionHash: sha(bytes), byteLength: bytes.length,
  width: 4, height: 1, format: 'png', src: '/uploads/immutable-source.png' })
async function context(run, limit) {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'blip-source-assets-'))
  const mediaTransaction = createMediaTransaction({ hashScope: {} })
  const mediaBudget = createMediaBudget(limit)
  try { await run({ uploadsDir, mediaOptions: { mediaTransaction, mediaBudget } }) }
  finally { await mediaTransaction.rollback(); await rm(uploadsDir, { recursive: true, force: true }) }
}
async function producer(options) {
  const module = require('../../server/services/pptx-import/geometry-blip-source-assets')
  return module.createGeometryBlipSourceAssetProducer(options)
}
it('refuses source-resolution shading when source alpha is not natively qualified', async () => {
  await context(async options => {
    const derive = await producer(options)
    const bytes = source(Buffer.from([100, 150, 200, 0, 0, 85, 170, 1, 255, 128, 64, 128, 1, 2, 3, 255]))
    await expect(derive(bytes, asset(bytes), modes)).rejects.toThrow(/alpha/i)
    expect(await readdir(options.uploadsDir)).toEqual([])
    expect(options.mediaOptions.mediaBudget.usedBytes).toBe(0)
  })
})
it('derives source-resolution RGB before sampling, preserves every alpha byte and immutable provenance', async () => {
  await context(async options => {
    const derive = await producer(options), bytes = source(), original = Buffer.from(bytes), input = asset(bytes)
    const variants = await derive(bytes, input, modes)
    expect(Object.keys(variants)).toEqual(modes)
    for (const mode of modes) {
      const entry = variants[mode], png = await readFile(join(options.uploadsDir, basename(entry.src)))
      expect(entry).toEqual({ src: entry.src, width: 4, height: 1, format: 'png', byteLength: png.length,
        sha256: sha(png), sourceHash: sha(bytes), algorithm: 'ooxml-blip-source-rgb-v1' })
      const decoded = PNG.sync.read(png)
      expect([decoded.width, decoded.height]).toEqual([4, 1])
      const mix = Math.trunc(255 * (1 - (mode.endsWith('Less') ? 0.8 : 0.6)))
      expect([...decoded.data]).toEqual([...sourcePixels].map((value, i) => i % 4 === 3 ? value :
        Math.round((value * (255 - mix) + (mode.startsWith('lighten') ? 255 * mix : 0)) / 255)))
    }
    expect(bytes).toEqual(original)
    expect(input).toEqual(asset(bytes))
    const charged = options.mediaOptions.mediaBudget.usedBytes
    expect(charged).toBe(Object.values(variants).reduce((sum, entry) => sum + entry.byteLength, 0))
    expect(await derive(bytes, input, ['darken'])).toEqual({ darken: variants.darken })
    await expect(derive(bytes, { ...input, width: 5 }, ['darken'])).rejects.toThrow(/source identity dimensions/)
    await expect(derive(bytes, { ...input, format: 'bmp' }, ['darken'])).rejects.toThrow(/source identity format/)
    expect(options.mediaOptions.mediaBudget.usedBytes).toBe(charged)
    expect(await readdir(options.uploadsDir)).toHaveLength(4)
  })
})
it('refuses a source identity mismatch, requested unsupported format, and exhausted media budget without fallback', async () => {
  await context(async options => {
    const derive = await producer(options), bytes = source(), input = asset(bytes)
    await expect(derive(bytes, { ...input, preconditionHash: 'a'.repeat(64) }, modes)).rejects.toThrow(/source.*identity/i)
    await expect(derive(bytes, { ...input, format: 'jpeg' }, modes)).rejects.toThrow(/format/i)
    expect(await derive(bytes, input, [])).toEqual({})
    await expect(derive(bytes, input, ['lighten'])).rejects.toThrow(/budget/i)
    expect(await readdir(options.uploadsDir)).toEqual([])
  }, 0)
})
it('rolls derived media back with the existing import transaction', async () => {
  await context(async options => {
    const derive = await producer(options), bytes = source()
    await derive(bytes, asset(bytes), modes)
    await options.mediaOptions.mediaTransaction.rollback()
    expect(await readdir(options.uploadsDir)).toEqual([])
  })
})
it('returns unchanged document if no instances have blip shade modifiers', async () => {
  await context(async options => {
    const { stageGeometryBlipSourceAssets } = require('../../server/services/pptx-import/geometry-blip-source-assets')
    const doc = { schemaVersion: 1, definitions: {}, instances: {}, styles: {}, fonts: {} }
    const res = await stageGeometryBlipSourceAssets(doc, {}, options)
    expect(res).toBe(doc)
  })
})
it('stages derived assets using semantic records accessors and rejects nonopaque alpha', async () => {
  await context(async options => {
    const { stageGeometryBlipSourceAssets } = require('../../server/services/pptx-import/geometry-blip-source-assets')
    const { document, zip } = fixture('lighten', 128)
    await expect(stageGeometryBlipSourceAssets(document, zip, options)).rejects.toThrow(/alpha/i)
  })
})
it('stages derived assets successfully for qualified opaque source blip', async () => {
  await context(async options => {
    const { stageGeometryBlipSourceAssets } = require('../../server/services/pptx-import/geometry-blip-source-assets')
    const { document, zip } = fixture('lighten', 255)
    const result = await stageGeometryBlipSourceAssets(document, zip, options)
    const stagedBinding = result.styles.image
    expect(stagedBinding.payload.derivedAssets).toBeDefined()
    expect(stagedBinding.payload.derivedAssets.lighten).toMatchObject({
      format: 'png', width: 1, height: 1, algorithm: 'ooxml-blip-source-rgb-v1',
    })
  })
})
