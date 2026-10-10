// P10-08 source-bound operator proof. Not executed by production or ordinary unit tests.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const sourceIdentity = require('./recovery-source-manifest.cjs')
const { build, sha } = require('./portable-process-fixture.cjs')
const { launch, request, editor, json, safeSnapshot } = require('./portable-process-runtime.cjs')
const { boundary, observe } = require('./portable-process-observation.cjs')
const boundaries = ['prepublication', 'root-committed', 'raw-applied', 'owner-committed', 'cleanup-partial']
async function baseline(root, url, observations) {
  const files = []
  for (const name of (await fs.readdir(path.join(root, 'uploads'))).sort()) {
    const bytes = await fs.readFile(path.join(root, 'uploads', name))
    files.push({ name, sha256: sha(bytes), byteLength: bytes.length })
  }
  const rows = await json(root, 'presentations.json'), wire = []
  for (const row of rows) {
    const src = row.slides[0].elements[0].src
    const response = await request(url, src, observations)
    assert.equal(response.status, 200)
    wire.push({ id: row.id, src, sha256: sha(response.bytes), byteLength: response.bytes.length })
  }
  return { rows, hashes: await json(root, 'upload-hashes.json'), files, wire }
}
async function scenario(mode, receipt) {
  assert.deepEqual(await sourceIdentity(), receipt.sourceBefore, 'Source changed before scenario')
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-p10-process-'))
  const result = { boundary: mode, fixtureRoot: root, http: [], restarts: [], cleanup: false }
  receipt.scenarios.push(result)
  const children = []
  let publishController, publication
  let stage = 'fixture-build'
  try {
    result.fixture = await build(root)
    const child = launch(root, mode); children.push(child)
    const { url } = await child.next('ready')
    const retained = await baseline(root, url, result.http)
    result.retained = { rows: retained.rows.map(({ id }) => id), files: retained.files,
      rowsSha256: sha(JSON.stringify(retained.rows)), ownershipSha256: sha(JSON.stringify(retained.hashes)) }
    result.retained.wire = retained.wire
    const form = new FormData()
    stage = 'private-admission'
    form.append('file', new Blob([await fs.readFile(path.join(root, 'fixture.navslides'))]), 'fixture.navslides')
    const admitted = await request(url, '/api/project-imports/preflight', result.http,
      { method: 'POST', headers: editor(url), body: form })
    assert.equal(admitted.status, 201)
    const admission = admitted.json()
    assert.equal(admission.mediaCount, 2)
    const staged = await request(url, `/api/project-imports/${admission.sessionId}/media`, result.http,
      { method: 'POST', headers: editor(url, admission.capability) })
    assert.equal(staged.status, 200); assert.equal(staged.json().placed, 2)
    child.arm(admission.sessionId); await child.next('armed')
    publishController = new AbortController()
    publication = request(url, `/api/project-imports/${admission.sessionId}/publish`, result.http, {
      method: 'POST', headers: { ...editor(url, admission.capability), 'Content-Type': 'application/json' },
      body: JSON.stringify({ trustedAuthorActiveContentAcknowledged: false }), signal: publishController.signal,
    }).then((response) => ({ response }), (error) => ({ error }))
    stage = 'waiting-for-persisted-boundary'
    const checkpoint = await Promise.race([child.next('checkpoint'), publication.then(({ response, error }) => {
      throw new Error(`Publication ended before persisted barrier: ${response ? response.status : error.name}`)
    })])
    assert.equal(checkpoint.boundary, mode)
    assert.equal(checkpoint.sessionId, admission.sessionId)
    stage = 'verifying-persisted-boundary'
    const before = await boundary(root, mode, admission.sessionId, result.fixture, retained)
    result.beforeKill = safeSnapshot(before)
    if (mode === 'prepublication') {
      const list = await request(url, '/api/presentations', result.http)
      assert.equal(list.status, 200); assert.equal(list.json().some((row) => row.id === before.id), false)
      const ghost = await request(url, `/api/presentations/${before.id}`, result.http)
      assert.equal(ghost.status, 404)
    }
    stage = 'owned-process-kill'
    result.kill = await child.kill()
    if (process.platform !== 'win32') assert.equal(result.kill.signal, 'SIGKILL')
    else assert.notEqual(result.kill.code, 0) // Windows TerminateProcess, not POSIX signal delivery.
    publishController.abort()
    const interrupted = await publication
    assert.ok(interrupted.error, 'HTTP publish must be interrupted, not a typed failure/success response')
    result.publicationInterrupted = true
    let prior
    for (let restart = 0; restart < 2; restart += 1) {
      stage = `restart-${restart + 1}`
      const recovered = launch(root, 'restart'); children.push(recovered)
      const ready = await recovered.next('ready')
      const sample = { restart: restart + 1, http: [] }
      result.restarts.push(sample)
      sample.durable = await observe(root, ready.url, admission.sessionId, result.fixture, retained, sample.http)
      if (prior) assert.deepEqual(sample.durable, prior, 'Second restart changed authority/ownership/digests')
      prior = sample.durable
      sample.exit = await recovered.kill()
    }
    result.sourceAfter = await sourceIdentity()
    assert.deepEqual(result.sourceAfter, receipt.sourceBefore, 'Source changed during scenario')
    result.status = 'passed'
  } catch (error) {
    result.status = 'failed'; result.failure = error.message
    result.failureStage = stage; result.failureStack = error.stack; throw error
  }
  finally {
    publishController?.abort()
    if (publication) await publication
    for (const child of children) await child.kill()
  }
}
async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--receipt') {
    throw new Error('Usage: node server/portable-process-kill-proof.cjs --receipt <relative-existing-directory/fresh.json>')
  }
  const relative = process.argv[3]
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new Error('Receipt must be a relative path without parent traversal')
  const output = path.resolve(relative)
  const directory = await fs.realpath(path.dirname(output))
  const cwd = await fs.realpath(process.cwd())
  const inside = path.relative(cwd, directory)
  if (inside.startsWith('..') || path.isAbsolute(inside)) throw new Error('Receipt directory escapes working directory')
  const handle = await fs.open(output, 'wx')
  const receipt = { phase: 10, scenarioIds: ['P10-08'], kind: 'actual-portable-ZIPv2-startServer-process-kill-http',
    artifactKind: 'source', command: [process.execPath, ...process.argv.slice(1)], platform: process.platform,
    toolVersions: { node: process.version }, startedAt: new Date().toISOString(), scenarios: [],
    limits: ['Process termination, not power-loss/fsync qualification.',
      'Windows uses owned TerminateProcess through SIGKILL request; POSIX requires observed SIGKILL.',
      'Genuine package-store import from repository PPTX corpus; not native OfficeCLI conversion or Edited validation.',
      'No fake validators, package/media API substitution, sleeps, external apps, or user roots.',
      'Cleanup-partial pauses after first owned staged media unlink, before package cleanup and terminal ledger.'] }
  try {
    receipt.sourceBefore = await sourceIdentity()
    for (const mode of boundaries) await scenario(mode, receipt)
    receipt.sourceAfter = await sourceIdentity()
    assert.deepEqual(receipt.sourceAfter, receipt.sourceBefore, 'Source changed during proof')
    receipt.status = 'passed'
  } catch (error) { receipt.status = 'failed'; receipt.failure = error.message; process.exitCode = 1 }
  finally {
    try {
      receipt.sourceAfter = await sourceIdentity()
      if (receipt.sourceBefore) assert.deepEqual(receipt.sourceAfter, receipt.sourceBefore, 'Source changed before receipt')
    } catch (error) { receipt.status = 'failed'; receipt.failure = error.message; process.exitCode = 1 }
    if (receipt.status === 'passed') {
      for (const result of receipt.scenarios) {
        await fs.rm(result.fixtureRoot, { recursive: true, force: true }); result.cleanup = true
      }
    }
    receipt.completedAt = new Date().toISOString(); receipt.exitCode = process.exitCode || 0
    try { await handle.writeFile(JSON.stringify(receipt, null, 2)) } finally { await handle.close() }
  }
  console.log(JSON.stringify({ status: receipt.status, receipt: relative }))
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
