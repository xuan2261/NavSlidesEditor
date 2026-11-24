// Native concurrency exit acceptance; synthetic fixture bytes do not qualify Office rendering.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const sourceIdentity = require('./recovery-source-manifest.cjs')
const { api, bounded } = require('./pptx-concurrency-exit-fixture.cjs')
const repo = path.resolve(__dirname, '..')
async function main() {
  assert.equal(process.argv.length, 4)
  assert.equal(process.argv[2], '--receipt')
  assert.match(process.argv[3], /^reports\/pptx-phase08-concurrency-exit[-a-z0-9]*\.json$/u)
  const receiptPath = path.join(repo, process.argv[3])
  const handle = await fs.open(receiptPath, 'wx')
  const record = { status: 'started', artifactKind: 'backend-source-runtime',
    command: [process.execPath, ...process.argv.slice(1)], startedAt: new Date().toISOString(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    fixture: 'Synthetic ZIP/native text source map and PNG with fixture labels; byte/ownership proof, not Office/render qualification',
    transport: 'Actual startServer ephemeral loopback HTTP; no mocked package/media/validator layers',
    faultModel: 'Post-commit HTTP socket destruction and pass-through deferred publication/admission barriers; no process death',
    scopeLimitations: ['No validated-edited-export success or external Office validation',
      'No import-parser qualification or HTTP same-destination UUID collision claim',
      'Does not close any other P08 gate or mark phase complete'] }
  let root, server, service, ctx, failure, stage = 'source-before'
  const previous = { data: process.env.SLIDES_DATA_DIR, uploads: process.env.SLIDES_UPLOADS_DIR,
    nodeEnv: process.env.NODE_ENV }
  async function persist() {
    const bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`)
    let offset = 0
    while (offset < bytes.length) {
      const result = await handle.write(bytes, offset, bytes.length - offset, offset)
      assert(result.bytesWritten > 0, 'Receipt write made no progress')
      offset += result.bytesWritten
    }
    await handle.truncate(bytes.length)
    await handle.sync()
  }
  try {
    record.sourceBefore = await sourceIdentity()
    await persist() // Durable source binding precedes application module loading and operations.
    stage = 'startServer'
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-p08-concurrency-exit-'))
    record.fixtureRoot = root
    process.env.SLIDES_DATA_DIR = path.join(root, 'data')
    process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
    process.env.NODE_ENV = 'development' // Never use the test-only readable-store fallback.
    service = require('./index')
    server = await bounded(service.startServer(0, { host: '127.0.0.1' }), 'Actual server startup')
    const runtime = require('./services/pptx-import/package-store-runtime')
    ctx = { runtime, store: runtime.getPackageStore(), app: service.app,
      storage: require('./services/storage'), ownership: require('./services/media-placement-ownership'),
      base: `http://127.0.0.1:${server.address().port}` }
    assert.equal(ctx.storage.DATA_DIR, path.join(root, 'data'))
    assert.equal(ctx.storage.UPLOADS_DIR, path.join(root, 'uploads'))
    assert.equal(await ctx.store.ownsWriter(), true)
    record.httpReady = (await api(ctx.base, '/health/ready')).body
    assert.equal(record.httpReady.status, 'ready')
    for (const [label, file] of [['P08-07-current-durable-receipt', './pptx-concurrency-exit-retry.cjs'],
      ['P08-12-unrelated-decks', './pptx-concurrency-exit-unrelated.cjs'],
      ['same-destination-winner-late-loser', './pptx-concurrency-exit-winner.cjs']]) {
      stage = label
      await require(file)(ctx, record)
      await persist()
    }
    record.status = 'passed'
  } catch (error) {
    failure = error
    record.status = 'failed'
    record.failure = { stage, code: error.code || error.name, message: error.message,
      ...(error.httpStatus ? { httpStatus: error.httpStatus, applicationCode: error.applicationCode } : {}),
      ...(error.boundary ? { boundary: error.boundary } : {}),
      ...(error.barrierEvents ? { barrierEvents: error.barrierEvents } : {}) }
    if (ctx) record.failureAuthority = ctx.store.getState()
  } finally {
    try {
      if (server) await bounded(service.stopServer(server), 'Actual server shutdown')
      else if (service) await bounded(require('./services/pptx-import/package-store-runtime').shutdownPackageStore(), 'Partial startup shutdown')
      if (ctx) assert.equal(await ctx.store.ownsWriter(), false, 'Fixture writer lock not released')
    } catch (error) {
      failure ||= error
      record.status = 'failed'
      record.cleanupFailure = { code: error.code || error.name, message: error.message }
      server?.closeAllConnections?.()
      server?.navslidesIo?.disconnectSockets?.(true)
      server?.navslidesIo?.engine?.close()
    }
    for (const [key, value] of [['SLIDES_DATA_DIR', previous.data], ['SLIDES_UPLOADS_DIR', previous.uploads], ['NODE_ENV', previous.nodeEnv]]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    try {
      record.sourceAfter = await sourceIdentity()
      assert.deepEqual(record.sourceAfter, record.sourceBefore, 'Runtime source changed during execution')
      record.sourceUnchanged = true
    } catch (error) {
      failure ||= error
      record.status = 'failed'
      record.sourceBindingFailure = { code: error.code || error.name, message: error.message }
    }
    if (root && !failure) {
      try { await fs.rm(root, { recursive: true, force: true }); record.fixtureRemoved = true }
      catch (error) { failure = error; record.status = 'failed'; record.tempCleanupFailure = error.message }
    } else if (root) record.fixtureRetainedForFailureAnalysis = true
    record.finishedAt = new Date().toISOString()
    try { await persist() } finally { await handle.close() }
  }
  console.log(JSON.stringify({ status: record.status, receipt: receiptPath,
    sourceSha256: record.sourceBefore?.sha256, fixtureRetained: record.fixtureRetainedForFailureAnalysis === true }))
  if (failure) throw failure
}
main().catch(error => {
  console.error(JSON.stringify({ harnessFailure: { code: error.code || error.name, message: error.message } }))
  process.exitCode = 1
})
