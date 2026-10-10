// Test-only package seeding; the application and all browser journeys use real sockets.
const path = require('node:path')
const fs = require('fs-extra')
const crypto = require('node:crypto')
if (process.env.NAVSLIDES_CRASH_TEST_HARNESS !== '1') throw new Error('Test harness only')
async function main() {
  const service = require('../../../server/index')
  const server = await service.startServer(0, { host: '127.0.0.1' })
  const root = path.dirname(process.env.SLIDES_DATA_DIR)
  const input = await fs.readJson(path.join(root, 'seed.json'))
  const ownership = require('../../../server/services/media-placement-ownership')
  const urls = {}
  for (const asset of input.assets) {
    const placed = await ownership.placeMedia({ ownerId: 'browser-seed',
      bytes: Buffer.from(asset.base64, 'base64'), originalName: asset.name,
      mimeType: asset.mime, sourceKey: asset.name })
    urls[asset.name] = `/uploads/${placed.filename}`
  }
  const id = 'portable-browser-source'
  await ownership.commitOwner('browser-seed', id)
  const elements = [{ id: 'text', type: 'text', x: 50, y: 30, width: 700,
    height: 100, content: '<p>Portable browser before save</p>' }]
  if (input.assets.length) elements.push(
    { id: 'image', type: 'image', x: 50, y: 160, width: 240, height: 160,
      src: urls['image.png'], alt: 'Owned generated image' },
    { id: 'video', type: 'video', x: 340, y: 160, width: 320, height: 180,
      src: urls['video.webm'], poster: urls['poster.png'], controls: true, muted: true,
      tracks: [{ src: urls['captions.vtt'], kind: 'captions', srcLang: 'en',
        label: 'Owned captions', default: true }] })
  const projection = { id, title: 'Portable browser qualification', theme: 'black',
    transition: 'none', slides: [{ id: 'slide', elements, notes: '',
      background: { type: 'color', color: '#111827' } }] }
  // A real generated PPTX, not a ZIP with invented native metadata or a fake validator.
  const PptxGenJS = require('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.addSlide().addText('Portable browser before save', { x: 0.5, y: 0.3, w: 7, h: 1 })
  const original = Buffer.from(await pptx.write({ outputType: 'nodebuffer' }))
  const runtime = require('../../../server/services/pptx-import/package-store-runtime')
  const sourceMap = await require('../../../server/services/pptx-import/source-map')
    .buildImportSourceMap(projection, null, null)
  await runtime.getPackageStore().commitImport(original, { jobId: 'browser-seed',
    presentationId: id, projection, compatibilityPresentation: projection, sourceMap })
  await runtime.drainPackageCompatibilityOutbox()
  process.send({ type: 'ready', url: `http://127.0.0.1:${server.address().port}`, id,
    originalSha256: crypto.createHash('sha256').update(original).digest('hex') })
}
main().catch((error) => {
  process.send?.({ type: 'failure', code: `${error.code || error.name}: ${error.message}` })
  process.exitCode = 1
})
