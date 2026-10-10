// Test-only child entrypoint; never imported by production startup.
const path = require('node:path')
const fs = require('fs-extra')
const crypto = require('node:crypto')
if (process.env.NAVSLIDES_CRASH_TEST_HARNESS !== '1') throw new Error('Test harness only')
const mode = process.argv[2]
const data = process.env.SLIDES_DATA_DIR
const root = path.dirname(data)
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const mediaBytes = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,15,0,0,1,1,0,5,24,212,205,0,0,0,59,73,69,78,68,174,66,96,130])
async function pause(boundary, receipt) {
  await fs.writeJson(path.join(root, 'receipt.json'), receipt)
  process.send({ type: 'checkpoint', boundary })
  await new Promise(() => {})
}
async function main() {
  if (['restart-pptx-apply-timeout', 'restart-pptx-ack-timeout'].includes(mode)) {
    require('./recovery-timeout-barrier.cjs')(mode, data)
  }
  if (mode === 'restart-timeout') {
    // Deliberately stalled recovery, not a fake process-death claim.
    const stall = () => new Promise(() => {})
    require('./services/project-import-media-session-recovery').recoverProjectImports = stall
    require('./services/project-import-media-session').recoverProjectImports = stall
  }
  const runtime = require('./index')
  const server = await runtime.startServer(0, { host: '127.0.0.1' })
  const url = `http://127.0.0.1:${server.address().port}`
  if (mode === 'restart' || mode.startsWith('restart-')) {
    process.send({ type: 'ready', url })
    return
  }
  const storage = require('./services/storage')
  const ownership = require('./services/media-placement-ownership')
  const sessions = require('./services/project-import-media-session')
  const shared = await ownership.placeMedia({ ownerId: 'retained-winner', bytes: mediaBytes,
    originalName: 'shared.png', mimeType: 'image/png', sourceKey: 'shared' })
  await ownership.commitOwner('retained-winner', 'retained-winner')
  await storage.withPresentations((rows) => rows.push({ id: 'retained-winner', title: 'Winner',
    slides: [{ id: 's1', elements: [{ id: 'e1', type: 'image', src: `/uploads/${shared.filename}` }] }] }))
  const receipt = { sharedUrl: `/uploads/${shared.filename}`, sharedSha256: digest(mediaBytes) }
  if (mode.startsWith('project-')) {
    const store = require('./services/project-import-media-session-store')
    const stage = path.join(root, 'new.png')
    await fs.writeFile(stage, Buffer.concat([mediaBytes, Buffer.from('-new')]))
    receipt.mediaSha256 = digest(await fs.readFile(stage))
    const admitted = await sessions.createProjectImportSession({ archiveDigest: 'a'.repeat(64),
      payloadDigest: 'b'.repeat(64), activeContent: [], trustedAuthorActiveContentAcknowledged: false,
      presentation: { title: 'Recovery', slides: [{ id: 's1', elements: [
        { id: 'new', type: 'image', src: '/uploads/new.png' },
      ] }] }, media: [{ archivePath: 'media/new.png', originalUrl: '/uploads/new.png',
        filename: 'new.png', mimeType: 'image/png', stagingPath: stage }] })
    receipt.sessionId = admitted.sessionId
    const place = ownership.placeMedia
    ownership.placeMedia = async (...args) => {
      const result = await place(...args)
      receipt.mediaUrl = `/uploads/${result.filename}`
      if (mode === 'project-placement') await pause(mode, receipt)
      return result
    }
    const update = store.updateSession
    store.updateSession = async (...args) => {
      const result = await update(...args)
      const current = await store.readSession(admitted.sessionId)
      if (mode === 'project-checkpoint' && current.state === 'pending' && current.placements.length) await pause(mode, receipt)
      return result
    }
    // Reload only the API to capture the real store boundary observer.
    delete require.cache[require.resolve('./services/project-import-media-session')]
    const observed = require('./services/project-import-media-session')
    await observed.stageProjectImportMedia(admitted)
    const committing = await observed.beginProjectImportCommit(admitted)
    receipt.presentationId = committing.intendedPresentationId
    if (mode === 'project-committing') await pause(mode, receipt)
    const commit = ownership.commitOwner
    ownership.commitOwner = async (...args) => {
      if (mode === 'project-row') await pause(mode, receipt)
      return commit(...args)
    }
    await observed.publishProjectImport(admitted)
    await pause('project-committed', receipt)
  }
  const JSZip = require('jszip')
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('ppt/presentation.xml', '<p:presentation/>')
  zip.file('ppt/media/image1.png', mediaBytes)
  const original = await zip.generateAsync({ type: 'nodebuffer' })
  await fs.writeFile(path.join(root, 'original.pptx'), original)
  const file = path.join(root, 'upload-source.pptx')
  await fs.writeFile(file, original)
  receipt.originalSha256 = digest(original)
  const packageRuntime = require('./services/pptx-import/package-store-runtime')
  const jobs = require('./services/pptx-import-job-manager')
  const route = require('./routes/pptx-import')
  const { persistImageBuffer } = require('./services/pptx-import/media')
  const { buildImportSourceMap } = require('./services/pptx-import/source-map')
  const jobId = jobs.createJob()
  receipt.jobId = jobId
  if (mode === 'pptx-json') {
    const mutate = packageRuntime.getPackageStore().mutate.bind(packageRuntime.getPackageStore())
    packageRuntime.getPackageStore().mutate = async (...args) => {
      const rows = await storage.readPresentations()
      const projection = rows.find((row) => row.id !== 'retained-winner')
      if (projection) {
        receipt.presentationId = projection.id
        await pause(mode, receipt) // JSON applied; exact outbox ack has not mutated authority.
      }
      return mutate(...args)
    }
  }
  await route.runImport({ jobId, filePath: file, originalName: 'process-death.pptx', jobManager: jobs,
    importer: async (_file, { mediaTransaction, signal }) => {
      if (mode === 'pptx-blob') {
        receipt.mediaUrl = receipt.sharedUrl; receipt.mediaSha256 = receipt.sharedSha256
        const presentation = { title: 'Pre-root', slides: [] }
        return { presentation, sourceMap: await buildImportSourceMap(presentation, null, null), warnings: [], stats: { slideCount: 0 } }
      }
      const sharedImage = await persistImageBuffer(mediaBytes, 'image/png', storage.UPLOADS_DIR, { mediaTransaction, signal })
      const placed = await persistImageBuffer(Buffer.concat([mediaBytes, Buffer.from('-new')]), 'image/png', storage.UPLOADS_DIR, { mediaTransaction, signal })
      receipt.mediaUrl = placed.url
      receipt.mediaSha256 = digest(Buffer.concat([mediaBytes, Buffer.from('-new')]))
      if (mode === 'pptx-media') await pause(mode, receipt)
      const presentation = { title: 'Recovery', slides: [{ id: 's1', elements: [
        { id: 'shared', type: 'image', src: sharedImage.url }, { id: 'new', type: 'image', src: placed.url },
      ] }] }
      return { presentation, sourceMap: await buildImportSourceMap(presentation, null, null), warnings: [], stats: { slideCount: 1 } }
    },
    packageCommit: async (source, input) => {
      if (mode === 'pptx-blob') {
        await require('./recovery-preroot-proof.cjs').prepareFence(packageRuntime.getPackageStore(), source, input, receipt, root, url)
        await pause(mode, receipt)
      }
      const prepared = await packageRuntime.getPackageStore().prepareImport(source, input)
      return packageRuntime.withPackageStore((store) => store.publishImport(prepared))
    },
    packageRollback: (input) => {
      if (mode === 'pptx-rollback') throw Object.assign(new Error('Test rollback sink unavailable'), { code: 'EIO' })
      return packageRuntime.withPackageStore((store) => store.rollbackImport(input))
    },
    drainCompatibility: () => {
      if (mode === 'pptx-rollback') throw Object.assign(new Error('Test projection sink unavailable'), { code: 'EIO' })
      return packageRuntime.drainPackageCompatibilityOutbox()
    },
    afterPackagePublish: async ({ presentationId }) => {
      receipt.presentationId = presentationId
      if (mode === 'pptx-root') await pause(mode, receipt)
    },
    afterPackageVisibility: async () => { if (mode === 'pptx-visible') await pause(mode, receipt) },
  })
  if (mode === 'pptx-rollback') await pause(mode, receipt)
  throw new Error('Requested crash boundary was not reached')
}
main().catch((error) => {
  process.send?.({ type: 'failure', code: error.code || error.name })
  process.exitCode = 1
  process.disconnect?.()
  process.exit(1)
})
