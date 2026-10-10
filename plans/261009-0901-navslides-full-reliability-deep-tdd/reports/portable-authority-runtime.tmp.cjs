const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const JSZip = require('jszip')
const { openPackageStore } = require(path.resolve('server/services/pptx-import/package-store'))
const { buildImportSourceMap } = require(path.resolve('server/services/pptx-import/source-map'))
const { resolveEditedExportContext } = require(path.resolve('server/services/pptx-import/validated-edited-export-context'))
const { hashRecord } = require(path.resolve('server/services/pptx-import/package-store/schemas'))
const resources = []
const receipt = { status: 'running', observed: [], limitations: ['Real store/import/export/lifecycle APIs; minimal ZIP source, not parser or Office qualification'] }
async function create(id, title) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-authority-runtime-'))
  const store = await openPackageStore({ rootDir })
  resources.push({ store, rootDir })
  await store.acquireWriter()
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('ppt/presentation.xml', `<p:presentation marker="${title}"/>`)
  const original = await zip.generateAsync({ type: 'nodebuffer' })
  const projection = { id, title, slides: [] }
  await store.commitImport(original, {
    jobId: `import-${id}`, presentationId: id, projection,
    compatibilityPresentation: projection,
    sourceMap: await buildImportSourceMap(projection, null, null),
  })
  return { store, original }
}
;(async () => {
  try {
    const source = await create('source', 'Incoming')
    const destination = await create('destination', 'Previous')
    const bundle = await source.store.exportPresentationPackage('source')
    const previous = destination.store.getState().heads[0]
    const history = { ownerType: 'history', ownerId: 'destination:before' }
    const template = { ownerType: 'template', ownerId: 'previous' }
    await destination.store.retainHead(history, 'destination')
    await destination.store.retainHead(template, 'destination')
    await destination.store.importPresentationPackage(bundle, 'destination', { replace: true, expectedHead: previous })
    await destination.store.instantiateRetainedHead(template, 'from-template')
    assert.equal(resolveEditedExportContext(destination.store.getState(), 'from-template').after.title, 'Previous')
    await destination.store.restoreForward('destination', history)
    assert.equal(resolveEditedExportContext(destination.store.getState(), 'destination').after.title, 'Previous')
    assert.deepEqual(await destination.store.readOriginal(previous.originalRevisionId), destination.original)
    receipt.observed.push('template and snapshot projections restored after replacement; Original bytes exact')
    for (const mismatch of ['revision', 'generation', 'schema']) {
      const bad = { ...bundle, manifest: structuredClone(bundle.manifest) }
      const result = bad.manifest.mutationResults[0]
      result.sourceMap.entries['s1:e1'] = { status: 'missing', revisionId: result.packageRevisionId,
        packageGeneration: result.generation, partUri: 'unknown', kind: 'text', relationshipChain: [],
        groupAncestry: [], occurrencePath: [], sourceHash: 'a'.repeat(64) }
      if (mismatch === 'revision') result.sourceMap.entries['s1:e1'].revisionId = 'foreign'
      else if (mismatch === 'generation') result.sourceMap.entries['s1:e1'].packageGeneration += 1
      else result.sourceMap.schemaVersion = 2
      bad.manifest.head.sourceMapRevisionId = hashRecord(result.sourceMap)
      const before = destination.store.getState()
      await assert.rejects(destination.store.importPresentationPackage(bad, `reject-${mismatch}`), { code: 'PACKAGE_AUTHORITY_UNAVAILABLE' })
      assert.deepEqual(destination.store.getState(), before)
      receipt.observed.push(`supplied foreign ${mismatch} rejected before authority publication`)
    }
    receipt.sourceFiles = []
    for (const file of ['server/services/pptx-import/package-store/portable.js', 'server/services/pptx-import/package-store/portable-authority.js', 'server/services/package-backed-presentation-read.js', 'server/services/pptx-import/validated-edited-export-context.js']) {
      const bytes = await fs.readFile(file)
      receipt.sourceFiles.push({ file, sha256: crypto.createHash('sha256').update(bytes).digest('hex') })
    }
    receipt.status = 'passed'
  } catch (error) { receipt.status = 'failed'; receipt.error = error.stack; process.exitCode = 1 }
  finally {
    for (const { store, rootDir } of resources) { await store.releaseWriter(); await fs.rm(rootDir, { recursive: true, force: true }) }
    await fs.writeFile('plans/261009-0901-navslides-full-reliability-deep-tdd/reports/portable-authority-runtime.json', JSON.stringify(receipt, null, 2))
    console.log(JSON.stringify(receipt))
  }
})()
