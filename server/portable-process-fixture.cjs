// Operator-only P10 fixture: genuine package store, real PPTX bytes and valid PNGs.
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const JSZip = require('jszip')
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64')
const other = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
async function build(root) {
  const original = await fs.readFile(path.join(__dirname, 'data/test-corpus/diagram-process-flow.pptx'))
  const { openPackageStore } = require('./services/pptx-import/package-store')
  const store = await openPackageStore({ rootDir: path.join(root, 'source') })
  await store.acquireWriter()
  try {
    const projection = { id: 'source', title: 'P10 portable process death', slides: [{ id: 'slide', elements: [
      { id: 'shared', type: 'image', src: '/uploads/shared.png', width: 100, height: 100 },
      { id: 'new', type: 'image', src: '/uploads/new.png', width: 100, height: 100 },
    ] }] }
    await store.commitImport(original, { jobId: 'source-package-import', presentationId: 'source', projection,
      compatibilityPresentation: projection,
      sourceMap: await require('./services/pptx-import/source-map').buildImportSourceMap(projection, null, null) })
    const bundle = await store.exportPresentationPackage('source')
    const zip = new JSZip(), assets = [['shared.png', png], ['new.png', other]]
    const media = assets.map(([name, bytes]) => ({ archivePath: `media/${name}`, originalUrl: `/uploads/${name}`,
      filename: name, mimeType: 'image/png', sha256: sha(bytes), byteLength: bytes.length }))
    zip.file('manifest.json', JSON.stringify({ version: '2.0', externalLinks: [], media }), { createFolders: false })
    zip.file('presentation.json', JSON.stringify(projection), { createFolders: false })
    zip.file('package/manifest.json', JSON.stringify(bundle.manifest), { createFolders: false })
    for (const blob of bundle.blobs) zip.file(`package/blobs/${blob.sha256}`, blob.bytes, { createFolders: false })
    for (const [name, bytes] of assets) zip.file(`media/${name}`, bytes, { createFolders: false })
    const archive = await zip.generateAsync({ type: 'nodebuffer' })
    await fs.writeFile(path.join(root, 'fixture.navslides'), archive, { flag: 'wx' })
    return { originalSha256: sha(original), originalByteLength: original.length, archiveSha256: sha(archive),
      packageManifestSha256: sha(JSON.stringify(bundle.manifest)),
      blobs: bundle.blobs.map(({ sha256, byteLength }) => ({ sha256, byteLength })), media }
  } finally { await store.releaseWriter() }
}
module.exports = { build, png, other, sha }
