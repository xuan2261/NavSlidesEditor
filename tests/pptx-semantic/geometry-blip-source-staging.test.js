import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { expect, it } from 'vitest'
import { geometryStyleFixture, authored, styleLocation } from './geometry-style-fixture.js'
const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
const { stageGeometryBlipSourceAssets } = require('../../server/services/pptx-import/geometry-blip-source-assets')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { createMediaTransaction } = require('../../server/services/pptx-import/media-dedup')
const { createMediaBudget } = require('../../server/services/pptx-import/resource-budgets')
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
  return { document: normalizePptxSemanticDocument(document), zip, bytes }
}
async function context(run) {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'blip-stage-source-'))
  const mediaTransaction = createMediaTransaction({ hashScope: {} })
  try { await run({ uploadsDir, mediaOptions: { mediaTransaction, mediaBudget: createMediaBudget() } }) }
  finally { await mediaTransaction.rollback(); await rm(uploadsDir, { recursive: true, force: true }) }
}
it('stages only actually requested path modifiers once across repeated source occurrences', async () => {
  await context(async options => {
    const { document, zip, bytes } = fixture(), original = structuredClone(document)
    const staged = await stageGeometryBlipSourceAssets(document, zip, options)
    expect(Object.keys(staged.styles.image.payload.derivedAssets)).toEqual(['darken'])
    expect(await readdir(options.uploadsDir)).toHaveLength(1)
    expect(staged.styles.image.payload.asset).toEqual(original.styles.image.payload.asset)
    expect(staged.definitions).toEqual(original.definitions)
    expect(staged.instances).toEqual(original.instances)
    expect(document).toEqual(original)
    expect(await zip.file('ppt/media/source.png').async('nodebuffer')).toEqual(bytes)
  })
})
it('does not decode or require a staging context for norm-only sources', async () => {
  const { document, zip } = fixture('norm'), before = structuredClone(document)
  zip.remove('ppt/media/source.png') // No source-byte read is needed for a norm-only request.
  const staged = await stageGeometryBlipSourceAssets(document, zip, {})
  expect(staged).toEqual(before)
  expect(document).toEqual(before)
})
it('rolls back and rejects shaded sources with unqualified alpha before rendering', async () => {
  await context(async options => {
    const { document, zip } = fixture('darken', 128)
    const before = structuredClone(document)
    await expect(stageGeometryBlipSourceAssets(document, zip, options)).rejects.toThrow(/alpha/i)
    expect(await readdir(options.uploadsDir)).toEqual([])
    expect(options.mediaOptions.mediaBudget.usedBytes).toBe(0)
    expect(document).toEqual(before)
  })
})
it('observes cancellation before deriving or publishing source assets', async () => {
  await context(async options => {
    const { document, zip } = fixture(), before = structuredClone(document)
    const controller = new AbortController(); controller.abort(new Error('Import cancelled'))
    options.mediaOptions.signal = controller.signal
    await expect(stageGeometryBlipSourceAssets(document, zip, options)).rejects.toThrow('Import cancelled')
    expect(await readdir(options.uploadsDir)).toEqual([])
    expect(document).toEqual(before)
  })
})
