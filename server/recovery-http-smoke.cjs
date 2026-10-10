// Phase09 operator-run proof; isolates all children and writes no user data.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { fork } = require('node:child_process')
const { hashCanonical } = require('./services/pptx-import/evidence/canonical-hash')
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const boundaries = ['project-placement', 'project-checkpoint', 'project-committing', 'project-row',
  'project-committed', 'pptx-media', 'pptx-blob', 'pptx-root', 'pptx-json', 'pptx-visible', 'pptx-rollback']
const sourceIdentity = require('./recovery-source-manifest.cjs')
function launch(root, mode) {
  const child = fork(path.join(__dirname, 'recovery-test-child.cjs'), [mode], {
    execArgv: [], silent: true, windowsHide: true,
    env: { ...process.env, NODE_ENV: 'test', NAVSLIDES_CRASH_TEST_HARNESS: '1',
      SLIDES_DATA_DIR: path.join(root, 'data'), SLIDES_UPLOADS_DIR: path.join(root, 'uploads') },
  })
  let stderr = ''
  let exit
  let failure
  const messages = []
  const waiters = new Set()
  child.stdout.resume()
  child.stderr.on('data', (bytes) => { stderr = (stderr + bytes).slice(-4000) })
  const closed = new Promise((resolve) => child.once('close', (code, signal) => {
    exit = { code, signal }
    resolve(exit)
    for (const waiter of waiters) waiter.reject(new Error(`Child exited ${code}/${signal}: ${stderr}`))
  }))
  child.on('error', (error) => { failure = error; for (const waiter of waiters) waiter.reject(error) })
  child.on('message', (message) => {
    if (message?.type === 'failure') {
      failure = new Error(`Child failed: ${message.code}`)
      for (const waiter of waiters) waiter.reject(failure)
    } else { messages.push(message); for (const waiter of waiters) waiter.deliver() }
  })
  return {
    next(type) {
      return new Promise((resolve, reject) => {
        const waiter = {
          reject(error) { clearTimeout(timer); waiters.delete(waiter); reject(error) },
          deliver() {
            const index = messages.findIndex((message) => message?.type === type)
            if (index < 0) return
            clearTimeout(timer); waiters.delete(waiter); resolve(messages.splice(index, 1)[0])
          },
        }
        const timer = setTimeout(() => waiter.reject(new Error(`Checkpoint deadline: ${type}`)), 20000)
        waiters.add(waiter)
        if (failure) waiter.reject(failure)
        else if (exit) waiter.reject(new Error('Child already exited'))
        else waiter.deliver()
      })
    },
    async kill() {
      if (!exit && !child.kill('SIGKILL')) throw new Error('Termination was rejected')
      return closed
    },
  }
}
async function json(root, file) {
  return JSON.parse(await fs.readFile(path.join(root, 'data', file), 'utf8'))
}
async function request(url, target, observations, options) {
  const response = await fetch(url + target, { ...options, signal: AbortSignal.timeout(10000) })
  const bytes = Buffer.from(await response.arrayBuffer())
  observations.push({ method: options?.method || 'GET', target, status: response.status,
    sha256: sha(bytes), byteLength: bytes.length })
  return { status: response.status, bytes, json: () => JSON.parse(bytes.toString('utf8')) }
}
async function preserved(root) {
  const files = []
  for (const directory of ['uploads', 'data/blobs']) {
    let entries
    try { entries = await fs.readdir(path.join(root, directory)) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      continue
    }
    for (const file of entries.sort()) {
      const filename = path.join(directory, file)
      const bytes = await fs.readFile(path.join(root, filename))
      files.push({ filename, sha256: sha(bytes), byteLength: bytes.length })
    }
  }
  return files
}
async function scenario(boundary, receipt) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-p09-http-'))
  const children = []; let restoreRoot
  const result = { boundary, fixtureRoot: root, restarts: [], cleanup: false }
  receipt.scenarios.push(result)
  try {
    const crashing = launch(root, boundary); children.push(crashing)
    assert.equal((await crashing.next('checkpoint')).boundary, boundary)
    result.exit = await crashing.kill()
    assert.ok(result.exit.code === null || result.exit.code !== 0)
    const intent = JSON.parse(await fs.readFile(path.join(root, 'receipt.json'), 'utf8'))
    result.intent = intent
    result.preservedBefore = await preserved(root)
    let previous
    for (let restart = 0; restart < 3; restart += 1) {
      if (restart === 2) {
        restoreRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-p09-restore-'))
        await fs.cp(root, restoreRoot, { recursive: true }); result.backupRestoreRoot = restoreRoot
      }
      const fixture = restoreRoot || root
      const child = launch(fixture, 'restart'); children.push(child)
      const { url } = await child.next('ready')
      const observations = []
      const sample = { restart, backupRestore: restart === 2, http: observations }
      result.restarts.push(sample)
      const uncertain = ['project-placement', 'project-checkpoint', 'pptx-media', 'pptx-rollback'].includes(boundary)
      const health = await request(url, '/health/ready', observations)
      assert.equal(health.status, uncertain ? 503 : 200)
      const listed = await request(url, '/api/presentations', observations)
      assert.equal(listed.status, 200)
      assert.equal(listed.json().filter((row) => row.id === 'retained-winner').length, 1)
      const media = await request(url, '/api/media', observations)
      assert.equal(media.status, 200)
      for (const [mediaUrl, digest] of [[intent.sharedUrl, intent.sharedSha256], [intent.mediaUrl, intent.mediaSha256]]) {
        assert.ok(media.json().some((entry) => entry.url === mediaUrl))
        const downloaded = await request(url, mediaUrl, observations)
        assert.equal(downloaded.status, 200); assert.equal(sha(downloaded.bytes), digest)
      }
      if (boundary === 'pptx-blob') await require('./recovery-preroot-proof.cjs').assertRestart({ root: fixture, url, intent, sample,
        request: (target, options) => request(url, target, observations, options) })
      if (intent.presentationId && boundary !== 'pptx-blob') {
        const opened = await request(url, `/api/presentations/${intent.presentationId}`, observations)
        assert.equal(opened.status, 200)
        assert.equal(listed.json().filter((row) => row.id === intent.presentationId).length, 1)
        if (boundary.startsWith('pptx-')) {
          const stateRoot = await json(fixture, 'state-root.json')
          const state = await json(fixture, stateRoot.stateFile)
          const head = state.heads.find((entry) => entry.presentationId === intent.presentationId)
          const job = state.jobs.find((entry) => entry.id === intent.jobId)
          sample.authority = { presentationId: head.presentationId, generation: head.generation,
            originalRevisionId: head.originalRevisionId, packageRevisionId: head.packageRevisionId,
            headHash: hashCanonical(head), rootStateHash: stateRoot.stateHash,
            outcomeRevisionId: job.outcomeRevisionId, outcomeGeneration: job.outcomeGeneration,
            outcomeHeadHash: job.outcomeHeadHash, reconcileRequired: job.reconcileRequired === true }
          assert.equal(job.outcomeRevisionId, head.packageRevisionId)
          assert.equal(job.outcomeGeneration, head.generation)
          assert.equal(job.outcomeHeadHash, sample.authority.headHash)
          assert.equal(sha(await fs.readFile(path.join(fixture, 'original.pptx'))), intent.originalSha256)
          const original = await request(url, `/api/presentations/${intent.presentationId}/pptx-original`, observations,
            { headers: { 'If-Pptx-Generation': String(head.generation), 'If-Pptx-Package-Revision': head.packageRevisionId,
              'If-Pptx-Package-Head-Hash': hashCanonical(head) } })
          assert.equal(original.status, 200); assert.equal(sha(original.bytes), intent.originalSha256)
          sample.packageStateSha256 = sha(JSON.stringify(state))
        } else assert.equal((await json(fixture, 'project-import-sessions.json'))[intent.sessionId].state, 'committed')
      }
      if (uncertain) assert.equal((await request(url, '/api/project-imports/preflight', observations, { method: 'POST' })).status, 503)
      sample.preservedFiles = await preserved(fixture)
      for (const retained of result.preservedBefore) assert.ok(sample.preservedFiles.some((file) =>
        file.filename === retained.filename && file.sha256 === retained.sha256))
      sample.uploadLedgerSha256 = sha(JSON.stringify(await json(fixture, 'upload-hashes.json')))
      const identity = JSON.stringify([sample.preservedFiles, sample.uploadLedgerSha256, sample.packageStateSha256])
      if (previous) assert.equal(identity, previous)
      previous = identity
      sample.exit = await child.kill()
    }
    result.status = 'passed'
  } catch (error) { result.status = 'failed'; result.failure = error.message; throw error }
  finally {
    for (const child of children) await child.kill()
    if (result.status === 'passed') { await fs.rm(root, { recursive: true, force: true }); await fs.rm(restoreRoot, { recursive: true, force: true }); result.cleanup = true }
  }
}
async function main() {
  if (!process.argv[2]) throw new Error('Usage: node server/recovery-http-smoke.cjs <receipt.json>')
  const output = path.resolve(process.argv[2])
  const receipt = { phase: 9, kind: 'actual-startServer-process-death-http', artifactKind: 'source',
    scenarioIds: ['P09-01', 'P09-02', 'P09-03', 'P09-04', 'P09-05', 'P09-06', 'P09-07', 'P09-08', 'P09-11', 'P09-14', 'P09-15'],
    command: [process.execPath, ...process.argv.slice(1)], startedAt: new Date().toISOString(),
    toolVersions: { node: process.version }, platform: process.platform,
    limits: 'Process kill, not power-loss durability. Controlled injected importer; no native source-lineage claim.',
    sourceBefore: await sourceIdentity(), scenarios: [] }
  try {
    for (const boundary of boundaries) await scenario(boundary, receipt)
    receipt.sourceAfter = await sourceIdentity()
    assert.deepEqual(receipt.sourceAfter, receipt.sourceBefore)
    receipt.status = 'passed'
  } catch (error) { receipt.status = 'failed'; receipt.failure = error.message; process.exitCode = 1 }
  finally {
    receipt.completedAt = new Date().toISOString()
    receipt.exitCode = process.exitCode || 0
    await fs.writeFile(output, JSON.stringify(receipt, null, 2), { flag: 'wx' })
  }
  console.log(JSON.stringify({ status: receipt.status, receipt: output }))
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
