// P07 operator-run native fixture proof. All mutation is confined to an owned temp root.
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const launch = require('./publication-acceptance-driver.cjs')
const sourceIdentity = require('./recovery-source-manifest.cjs')
const { hashCanonical } = require('./services/pptx-import/evidence/canonical-hash')
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
async function request(url, target, observations, options = {}, sensitive = false) {
  const response = await fetch(url + target, { ...options, signal: AbortSignal.timeout(90000) })
  const bytes = Buffer.from(await response.arrayBuffer())
  // Admission returns a capability: never hash or persist those response bytes or headers.
  observations.push({ method: options.method || 'GET', target, status: response.status,
    ...(sensitive ? { credentialResponseOmitted: true } : { sha256: sha(bytes), byteLength: bytes.length }) })
  return { status: response.status, bytes, contentType: response.headers.get('content-type'),
    contentDisposition: response.headers.get('content-disposition'), json: () => JSON.parse(bytes.toString('utf8')) }
}
async function main() {
  if (!process.argv[2]) throw new Error('Usage: node server/publication-acceptance-smoke.cjs <receipt.json>')
  const output = path.resolve(process.argv[2])
  const fixture = path.resolve(__dirname, '../PPTX/Bai_2_2.pptx')
  const originalBytes = await fs.readFile(fixture)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-p07-native-http-'))
  const receipt = { phase: 7, kind: 'native-fixture-production-startServer-http-paused-real-drain',
    scenarioIds: ['P07-01', 'P07-07', 'P07-10', 'P07-11', 'P07-12'],
    command: [process.execPath, ...process.argv.slice(1)], startedAt: new Date().toISOString(),
    toolVersions: { node: process.version }, platform: process.platform,
    fixture: { path: 'PPTX/Bai_2_2.pptx', sha256: sha(originalBytes), byteLength: originalBytes.length },
    sourceBefore: await sourceIdentity(), fixtureRoot: root, http: [], cleanup: false,
    limits: 'Source-runtime HTTP publication proof; not native Office rendering or power-loss qualification. Edited availability observed, not promoted to verified editability.' }
  const child = launch(root)
  try {
    const { url } = await child.next('ready')
    const get = (target, options, sensitive) => request(url, target, receipt.http, options, sensitive)
    const form = new FormData()
    form.append('file', new Blob([originalBytes]), 'Bai_2_2.pptx')
    const admission = await get('/api/pptx/import', { method: 'POST', body: form }, true)
    assert.equal(admission.status, 202)
    const { jobId, capability } = admission.json()
    assert.equal(typeof capability, 'string')
    const jobTarget = `/api/pptx/jobs/${jobId}`
    const jobOptions = { headers: { 'X-Pptx-Job-Capability': capability } }
    const { presentationId } = await child.next('paused')
    const base = `/api/presentations/${presentationId}`
    const pausedJob = await get(jobTarget, jobOptions)
    assert.equal(pausedJob.status, 200)
    assert.notEqual(pausedJob.json().status, 'done')
    assert.ok(!pausedJob.json().presentationId)
    assert.ok(!pausedJob.json().result?.presentationId)
    const pausedList = await get('/api/presentations')
    assert.equal(pausedList.status, 200)
    assert.ok(!pausedList.json().some((row) => row.id === presentationId))
    for (const suffix of ['', '/pptx-original', '/pptx-fidelity']) {
      assert.equal((await get(base + suffix)).status, 404)
    }
    assert.equal((await get(base + '/pptx-edited', { method: 'POST', headers: {
      'Idempotency-Key': 'p07-paused-edited', 'If-Pptx-Generation': '1',
    } })).status, 404)
    receipt.paused = { jobId, presentationId, jobStatus: pausedJob.json().status, openable: false }
    child.send({ type: 'release' })
    assert.equal((await child.next('completed')).jobId, jobId)
    const completed = await get(jobTarget, jobOptions)
    assert.equal(completed.status, 200)
    assert.equal(completed.json().status, 'done')
    assert.equal(completed.json().result.presentationId, presentationId)
    const listed = await get('/api/presentations')
    assert.equal(listed.status, 200)
    assert.ok(listed.json().some((row) => row.id === presentationId))
    const opened = await get(base)
    assert.equal(opened.status, 200)
    assert.equal(opened.json().id, presentationId)
    const original = await get(base + '/pptx-original')
    assert.equal(original.status, 200)
    assert.equal(sha(original.bytes), receipt.fixture.sha256)
    const fidelity = await get(base + '/pptx-fidelity')
    assert.equal(fidelity.status, 200)
    assert.equal(fidelity.json().exports.original.available, true)
    assert.equal(typeof fidelity.json().exports.validatedEdited.available, 'boolean')
    assert.equal(fidelity.json().exports.validatedEdited.available, false,
      'This local negative smoke requires unavailable validated-edited qualification')
    const sourceGeneration = opened.json().aggregateGeneration
    receipt.editedRefusals = []
    for (const generation of [sourceGeneration, sourceGeneration + 1]) {
      const refused = await get(base + '/pptx-edited', { method: 'POST', headers: {
        'Idempotency-Key': `p07-unavailable-${generation}`, 'If-Pptx-Generation': String(generation),
      } })
      assert.equal(refused.status, 422)
      assert.equal(refused.json().code, fidelity.json().exports.validatedEdited.reasonCode)
      assert.match(refused.contentType, /^application\/json/)
      assert.equal(refused.contentDisposition, null)
      assert.notEqual(refused.bytes.subarray(0, 2).toString(), 'PK')
      assert.deepEqual((await get(base)).json(), opened.json())
      assert.equal(sha((await get(base + '/pptx-original')).bytes), receipt.fixture.sha256)
      receipt.editedRefusals.push({ requestedGeneration: generation, status: refused.status,
        code: refused.json().code, availabilityPrecedesGeneration: true, originalPreserved: true })
    }
    receipt.completed = { jobStatus: completed.json().status, presentationId,
      originalSha256: sha(original.bytes), exports: fidelity.json().exports }
    const jsonPost = (target, value) => get(target, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
    const template = await jsonPost(base + '/save-as-template', { title: 'P07 native package template' })
    assert.equal(template.status, 201)
    const destination = await jsonPost('/api/presentations', {
      templateId: template.json().id, title: 'P07 native destination',
    })
    assert.equal(destination.status, 201)
    const destinationId = destination.json().id
    const destinationBase = `/api/presentations/${destinationId}`
    const destinationOpen = await get(destinationBase)
    assert.equal(destinationOpen.status, 200)
    assert.equal(destinationOpen.json().id, destinationId)
    child.send({ type: 'authority', presentationId: destinationId })
    const authority = await child.next('authority')
    assert.equal(authority.head.presentationId, destinationId)
    assert.equal(authority.sourceMap.presentationId, destinationId)
    assert.equal(authority.sourceMap.packageGeneration, authority.head.generation)
    assert.equal(authority.sourceMap.revisionId, authority.head.packageRevisionId)
    assert.equal(authority.head.sourceMapRevisionId, hashCanonical(authority.sourceMap))
    for (const revisionId of [authority.head.originalRevisionId, authority.head.packageRevisionId]) {
      assert.ok(authority.owners.some((owner) => owner.ownerId === destinationId && owner.revisionId === revisionId))
    }
    const destinationOriginal = await get(destinationBase + '/pptx-original', { headers: {
      'If-Pptx-Generation': String(authority.head.generation),
      'If-Pptx-Package-Revision': authority.head.packageRevisionId,
      'If-Pptx-Package-Head-Hash': hashCanonical(authority.head),
    } })
    assert.equal(destinationOriginal.status, 200)
    assert.equal(sha(destinationOriginal.bytes), receipt.fixture.sha256)
    receipt.template = { templateId: template.json().id, destinationId, head: authority.head,
      sourceMapSha256: hashCanonical(authority.sourceMap), sourceMapPresentationId: authority.sourceMap.presentationId,
      owners: authority.owners, originalSha256: sha(destinationOriginal.bytes) }
    // Re-open the source: template instantiation must not replace the imported winner.
    assert.equal((await get(base)).status, 200)
    assert.equal(sha((await get(base + '/pptx-original')).bytes), receipt.fixture.sha256)
    receipt.sourceAfter = await sourceIdentity()
    assert.deepEqual(receipt.sourceAfter, receipt.sourceBefore)
    assert.equal(sha(await fs.readFile(fixture)), receipt.fixture.sha256)
    receipt.status = 'passed'
  } catch (error) {
    receipt.status = 'failed'; receipt.failure = error.message; process.exitCode = 1
  } finally {
    receipt.childExit = await child.kill()
    if (receipt.status === 'passed') {
      await fs.rm(root, { recursive: true, force: true }); receipt.cleanup = true
    }
    receipt.completedAt = new Date().toISOString()
    receipt.exitCode = process.exitCode || 0
    await fs.writeFile(output, JSON.stringify(receipt, null, 2), { flag: 'wx' })
  }
  console.log(JSON.stringify({ status: receipt.status, receipt: output }))
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
