const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const { sha } = require('./portable-process-fixture.cjs')
const { request, snapshot, safeSnapshot } = require('./portable-process-runtime.cjs')
const { hashRecord } = require('./services/pptx-import/package-store/schemas')
async function exists(name) {
  try { await fs.access(name); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}
function retained(state, baseline) {
  for (const row of baseline.rows) assert.deepEqual(state.rows.find((item) => item.id === row.id), row)
  for (const [key, record] of Object.entries(baseline.hashes.global)) assert.deepEqual(state.hashes.global[key], record)
  for (const file of baseline.files) assert.deepEqual(state.files.find((item) => item.name === file.name), file)
}
async function boundary(root, mode, sessionId, fixture, baseline) {
  const current = await snapshot(root, sessionId)
  const { session, state, id, rows, hashes } = current
  retained(current, baseline)
  assert.equal(session.state, 'committing')
  assert.equal(session.archiveDigest, fixture.archiveSha256)
  assert.ok(session.packageOutcome)
  assert.equal(session.packageOutcome.originalSha256, fixture.originalSha256)
  assert.equal(session.packageOutcome.originalByteLength, fixture.originalByteLength)
  const heads = state.heads.filter((head) => head.presentationId === id)
  const raw = rows.filter((row) => row.id === id)
  const outbox = state.compatibilityOutbox.filter((item) => item.presentationId === id)
  if (mode === 'prepublication') {
    assert.equal(current.pointer, null, 'No root is published before the first publication')
    assert.equal(heads.length, 0); assert.equal(raw.length, 0); assert.equal(outbox.length, 0)
  } else {
    assert.ok(current.pointer, 'Published authority requires a validated state root')
    assert.equal(heads.length, 1); assert.deepEqual(heads[0], session.packageOutcome.head)
    assert.equal(raw.length, mode === 'root-committed' ? 0 : 1)
    assert.equal(outbox.length, ['root-committed', 'raw-applied'].includes(mode) ? 1 : 0)
  }
  assert.equal(sha(await fs.readFile(path.join(session.packageBundlePath, 'manifest.json'))), fixture.packageManifestSha256)
  for (const blob of fixture.blobs) {
    const bytes = await fs.readFile(path.join(root, 'data/blobs', `${blob.sha256}.blob`))
    assert.equal(sha(bytes), blob.sha256); assert.equal(bytes.length, blob.byteLength)
  }
  const owned = Object.values(hashes.global).filter((item) => item.sha256 === fixture.media[1].sha256)
  assert.equal(owned.length, 1)
  assert.equal(owned[0].state, ['owner-committed', 'cleanup-partial'].includes(mode) ? 'committed' : 'pending')
  if (owned[0].state === 'committed') assert.equal(owned[0].presentationId, id)
  else assert.equal(owned[0].placementOwner, `project-import:${sessionId}`)
  assert.equal(session.placements[0].ownership, 'reused')
  assert.equal(session.placements[1].ownership, 'new')
  for (const item of session.placements) {
    const bytes = await fs.readFile(item.absolutePath)
    assert.equal(sha(bytes), item.sha256); assert.equal(bytes.length, item.byteLength)
  }
  assert.equal(await exists(session.media[0].stagingPath), mode !== 'cleanup-partial')
  assert.equal(await exists(session.media[1].stagingPath), true)
  assert.equal(await exists(path.join(session.packageBundlePath, 'manifest.json')), true)
  return current
}
async function observe(root, url, sessionId, fixture, baseline, http) {
  const health = await request(url, '/health/ready', http)
  assert.equal(health.status, 200)
  const listed = await request(url, '/api/presentations', http)
  assert.equal(listed.status, 200)
  const current = await snapshot(root, sessionId)
  retained(current, baseline)
  assert.equal(current.session.state, 'committed')
  assert.equal(current.session.capabilityHash, undefined)
  assert.equal(current.session.packageBundlePath, undefined)
  assert.equal(current.session.packageBundleDigest, undefined)
  assert.equal(current.session.media, undefined)
  assert.equal(await exists(path.join(root, 'data/project-import-staging', sessionId, 'package')), false)
  assert.equal(current.rows.length, baseline.rows.length + 1)
  assert.equal(listed.json().filter((row) => row.id === current.id).length, 1)
  assert.equal(current.state.compatibilityOutbox.length, 0)
  assert.equal((current.state.compatibilityDeadLetter || []).length, 0)
  const heads = current.state.heads.filter((head) => head.presentationId === current.id)
  for (const media of fixture.media) assert.equal(await exists(path.join(root, 'data/project-import-staging', sessionId, media.archivePath)), false)
  for (const blob of fixture.blobs) {
    const bytes = await fs.readFile(path.join(root, 'data/blobs', `${blob.sha256}.blob`))
    assert.equal(sha(bytes), blob.sha256); assert.equal(bytes.length, blob.byteLength)
  }
  assert.equal(heads.length, 1)
  assert.deepEqual(heads[0], current.session.packageOutcome.head)
  const opened = await request(url, `/api/presentations/${current.id}`, http)
  assert.equal(opened.status, 200)
  const deck = opened.json()
  assert.equal(deck.pptxSourceAvailable, true)
  assert.equal(deck.aggregateGeneration, heads[0].generation)
  const original = await request(url, `/api/presentations/${current.id}/pptx-original`, http, { headers: {
    'If-Pptx-Generation': String(heads[0].generation), 'If-Pptx-Package-Revision': heads[0].packageRevisionId,
    'If-Pptx-Package-Head-Hash': hashRecord(heads[0]),
  } })
  assert.equal(original.status, 200); assert.equal(sha(original.bytes), fixture.originalSha256)
  assert.equal(original.bytes.length, fixture.originalByteLength)
  const mediaList = await request(url, '/api/media', http)
  assert.equal(mediaList.status, 200)
  for (let index = 0; index < fixture.media.length; index += 1) {
    const src = deck.slides[0].elements[index].src
    assert.notEqual(src, fixture.media[index].originalUrl)
    const media = await request(url, src, http)
    assert.equal(media.status, 200); assert.equal(sha(media.bytes), fixture.media[index].sha256)
    assert.equal(media.bytes.length, fixture.media[index].byteLength)
    assert.ok(mediaList.json().some((entry) => entry.url === src))
    assert.ok(Object.values(current.hashes.global).some((entry) => entry.state === 'committed' &&
      entry.sha256 === fixture.media[index].sha256 && `/uploads/${entry.filename}` === src))
  }
  for (const row of baseline.rows) {
    const openedRetained = await request(url, `/api/presentations/${row.id}`, http)
    assert.equal(openedRetained.status, 200)
    assert.equal(openedRetained.json().title, row.title)
    const bytes = await request(url, row.slides[0].elements[0].src, http)
    assert.equal(bytes.status, 200)
    const expected = baseline.wire.find((item) => item.id === row.id && item.src === row.slides[0].elements[0].src)
    assert.ok(expected, 'Exact retained media has a prepublication HTTP baseline')
    assert.equal(sha(bytes.bytes), expected.sha256)
    assert.equal(bytes.bytes.length, expected.byteLength)
  }
  const fidelity = await request(url, `/api/presentations/${current.id}/pptx-fidelity`, http)
  assert.equal(fidelity.status, 200); assert.equal(fidelity.json().exports.original.available, true)
  const evidence = safeSnapshot(current)
  evidence.deckSha256 = sha(opened.bytes)
  evidence.fidelitySha256 = sha(fidelity.bytes)
  return evidence
}
module.exports = { boundary, observe, exists }
