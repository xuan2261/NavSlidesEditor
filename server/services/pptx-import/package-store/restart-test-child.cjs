// Dedicated test child; never mounted by server/index.js or a public route.
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const JSZip = require('jszip')
if (process.env.NAVSLIDES_CRASH_TEST_HARNESS !== '1') throw new Error('Test harness only')
const mode = process.argv[2]
const root = process.env.SLIDES_DATA_DIR
async function pause(boundary, payload = {}) {
  process.send({ type: 'checkpoint', boundary, ...payload })
  await new Promise(() => {})
}
async function main() {
  const { openPackageStore } = require('./index')
  const store = await openPackageStore({ rootDir: root })
  await store.acquireWriter()
  await store.mutate(() => {}) // A real predecessor root, not hand-written authority.
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('ppt/presentation.xml', '<p:presentation/>')
  const original = await zip.generateAsync({ type: 'nodebuffer' })
  const sha256 = crypto.createHash('sha256').update(original).digest('hex')
  await fs.writeFile(path.join(path.dirname(root), 'original.pptx'), original)
  await fs.writeFile(path.join(path.dirname(root), 'receipt.json'), JSON.stringify({
    jobId: 'restart-job', presentationId: 'restart-deck', sha256,
    revisionId: `r0-${sha256}`, priorGeneration: store.getState().generation,
  }))
  if (mode === 'blob') {
    const commit = store.blobs.commit.bind(store.blobs)
    store.blobs.commit = async (...args) => {
      const result = await commit(...args)
      await pause('blob', { sha256: result.sha256 })
      return result
    }
  }
  const projection = { id: 'restart-deck', title: 'Restart', slides: [] }
  const prepared = await store.prepareImport(original, {
    jobId: 'restart-job', presentationId: projection.id, projection,
    sourceMap: { entries: {} }, compatibilityPresentation: projection,
  })
  // Wrap the actual durable boundary before StateStore's next publish.
  const durable = require('./durable-fs')
  const originalWrite = durable.writeDurable
  const originalReplace = durable.replaceDurable
  durable.writeDurable = async (filename, ...args) => {
    const result = await originalWrite(filename, ...args)
    if (mode === 'prepared' && filename.endsWith('.prepared.json')) await pause('prepared')
    if (mode === 'completed' && filename.endsWith('.completed')) await pause('completed')
    return result
  }
  durable.replaceDurable = async (...args) => {
    const result = await originalReplace(...args)
    if (mode === 'root' && args[1] === store.metadata.rootPath) await pause('root')
    return result
  }
  // StateStore captured exports at load; replace only this instance's publish
  // with the same implementation loaded after installing boundary observers.
  delete require.cache[require.resolve('./state-store')]
  store.metadata.publish = require('./state-store').StateStore.prototype.publish
  await store.publishImport(prepared)
  throw new Error('Requested crash boundary was not reached')
}
main().catch((error) => {
  process.send?.({ type: 'failure', code: error.code || error.name })
  process.exitCode = 1
  process.disconnect?.()
})
