// @vitest-environment node
import { test, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import { buildFeatureFixture } from './feature-fixtures.js'
import { commitSemanticText, resolveSemanticText } from '../../client/src/utils/pptx-semantic-text-bridge.js'
const require = createRequire(import.meta.url)
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const JSZip = require('jszip')
const base = '../../server/services/pptx-import/'
const { openPackageStore } = require(`${base}package-store`)
const { StateStore } = require(`${base}package-store/state-store`)
const { canonicalSaveSnapshot } = require(`${base}canonical-snapshot`)
const { deriveMutationJournal } = require(`${base}mutation-journal`)
const { rebindSourceMap } = require(`${base}source-map`)
const { hashRecord } = require(`${base}package-store/schemas`)
const { MUTATION_OPERATIONS } = require(`${base}mutation-operation-scope`)
const { preparePublication } = require(`${base}package-store/prepared-publication`)
const { captureProjectionSave, commitOwnedProjectionSave } = require(`${base}package-store/owned-projection-save`)
const cleanups = []
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() })

async function fixture(input) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'owned-projection-'))
  const store = await openPackageStore({ rootDir })
  await store.acquireWriter()
  cleanups.push(async () => {
    await store.releaseWriter()
    await fs.rm(rootDir, { recursive: true, force: true })
  })
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file('ppt/presentation.xml', '<p:presentation/>')
  await store.commitImport(await zip.generateAsync({ type: 'nodebuffer' }), {
    jobId: 'owned-job', presentationId: 'deck',
    projection: input?.projection || { id: 'deck', title: 'Original', slides: [] }, sourceMap: input?.sourceMap || { entries: {} },
  })
  const state = store.getOwnedAuthorityState()
  const head = state.heads[0]
  const authority = state.mutationResults.at(-1)
  const projection = canonicalSaveSnapshot({ ...authority.projection, title: 'Edited' })
  const journal = deriveMutationJournal(canonicalSaveSnapshot(authority.projection), projection, {
    baseRevisionId: head.packageRevisionId, sourceMap: authority.sourceMap,
    matrixAuthorityEpoch: state.matrixAuthorityEpoch,
  })
  const params = {
    expectedHead: structuredClone(head), expectedStoreGeneration: state.generation,
    expectedFencingEpoch: store.fencingEpoch, updatedAt: '2026-11-16T00:00:00.000Z',
    compatibility: { id: 'deck', title: 'Edited', slides: [] },
    result: {
      schemaVersion: 1, operation: MUTATION_OPERATIONS.PROJECTION_SAVE,
      presentationId: 'deck', idempotencyKey: 'save-key', requestHash: hashRecord(projection),
      generation: head.generation + 1, packageRevisionId: head.packageRevisionId,
      projection, journal, operationIds: journal.operations.map((item) => item.operationId),
      sourceMap: structuredClone(rebindSourceMap(authority.sourceMap, {
        presentationId: 'deck', revisionId: head.packageRevisionId, packageGeneration: head.generation + 1,
      })), state: 'pending-edited-export',
    },
  }
  return { store, params, rootDir }
}

test('real canonical native text edit and semantic override mint whole-state save and ACK proofs', async () => {
  const { projectSemanticImport } = require(`${base}semantic-projector`)
  const { isSealedPublication } = require(`${base}package-store/publication-snapshot`)
  const { isOwnedProjectionSave } = require(`${base}package-store/owned-projection-save`)
  const { isOwnedOutboxSuccessor } = require(`${base}package-store/owned-outbox-ack`)
  const { buffer } = await buildFeatureFixture()
  const zip = await JSZip.loadAsync(buffer)
  const uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'owned-text-fixture-'))
  cleanups.push(() => fs.rm(uploadsDir, { recursive: true, force: true }))
  const imported = await projectSemanticImport({ zip, uploadsDir, geometryInheritance: true,
    presentation: { id: 'deck', slides: ['slide1', 'slide2'].map(id => ({ id, elements: [] })) } })
  const entries = Object.fromEntries(imported.presentation.slides.flatMap(slide => slide.elements.map(element => {
    const instance = imported.presentation.pptxSemantic.instances[element.pptxInstanceId]
    const definition = imported.presentation.pptxSemantic.definitions[instance.definitionId]
    return [`${slide.id}:${element.id}`, { status: 'diagnostic', packageGeneration: 1, revisionId: 'import',
      partUri: definition.source.partUri, kind: definition.kind, sourceHash: definition.source.preconditionHash,
      relationshipChain: [], groupAncestry: [], occurrencePath: [] }]
  })))
  const { store, params } = await fixture({ projection: imported.presentation, sourceMap: { entries } })
  const state = store.metadata.state
  assert.equal(isSealedPublication(state), true)
  const authority = state.mutationResults.at(-1), head = state.heads[0]
  const before = canonicalSaveSnapshot(authority.projection)
  const instance = Object.values(before.pptxSemantic.instances).find(item => {
    const source = before.pptxSemantic.definitions[item.definitionId].source
    return source.nativeId === '2' && source.partUri === 'ppt/slides/slide1.xml'
  })
  const element = before.slides.find(slide => slide.id === instance.slideId).elements
    .find(item => item.pptxInstanceId === instance.id)
  const document = structuredClone(resolveSemanticText(before, element).document)
  document.paragraphs[0].runs[0].text = 'Edited α & β'
  const after = canonicalSaveSnapshot(commitSemanticText(before, element, document, '<p>Edited α &amp; β</p>',
    (deck, callback) => ({ ...deck, slides: deck.slides.map(callback) })))
  assert.ok(after.pptxSemantic.instances[instance.id].overrides.components[document.componentId].textDocument)
  const journal = deriveMutationJournal(before, after, { baseRevisionId: head.packageRevisionId,
    sourceMap: authority.sourceMap, matrixAuthorityEpoch: state.matrixAuthorityEpoch })
  // This real fixture replaces projected content and the whole instance record;
  // its nested override addition does not create an undefined journal operand.
  assert.ok(journal.operations.every(op => op.before !== undefined && op.after !== undefined))
  assert.ok(journal.operations.some(op => op.property === 'pptxSemantic' && op.path[0] === 'instances'))
  params.result = { ...params.result, projection: after, journal, requestHash: hashRecord(after),
    operationIds: journal.operations.map(op => op.operationId) }
  params.compatibility = after
  await store.commitProjectionSave(params)
  const saved = store.metadata.state
  assert.equal(isSealedPublication(saved), true)
  assert.equal(isOwnedProjectionSave(saved), true, 'closed save transaction minted proof')
  assert.equal(preparePublication(saved, store.metadata.root).state, saved)
  assert.equal(saved.revisions, state.revisions, 'whole-state save did not clone history')
  await store.acknowledgeCompatibilityWrites(store.getCompatibilityState().compatibilityOutbox)
  const acked = store.metadata.state
  assert.equal(isSealedPublication(acked), true)
  assert.equal(isOwnedOutboxSuccessor(acked), true, 'closed ACK transaction minted proof')
  assert.equal(preparePublication(acked, store.metadata.root).state, acked)
  assert.equal(acked.mutationResults, saved.mutationResults)
  assert.equal(acked.compatibilityOutbox.length, 0)
})

for (const removal of [false, true]) test(`property ${removal ? 'removal' : 'addition'} preserves whole-state save and ACK fast paths`, async () => {
  const { isSealedPublication } = require(`${base}package-store/publication-snapshot`)
  const { isOwnedProjectionSave } = require(`${base}package-store/owned-projection-save`)
  const { isOwnedOutboxSuccessor } = require(`${base}package-store/owned-outbox-ack`)
  const { store, params } = await fixture()
  const before = store.metadata.state
  const projection = structuredClone(before.mutationResults.at(-1).projection)
  if (removal) delete projection.title
  else projection.newEditableField = 'added'
  const journal = deriveMutationJournal(before.mutationResults.at(-1).projection, projection,
    { matrixAuthorityEpoch: before.matrixAuthorityEpoch })
  assert.ok(journal.operations.some(op => removal ? op.after === undefined : op.before === undefined))
  params.result = { ...params.result, projection, journal, requestHash: hashRecord(projection),
    operationIds: journal.operations.map(op => op.operationId) }
  await store.commitProjectionSave(params)
  const saved = store.metadata.state
  assert.equal(isSealedPublication(saved), true)
  assert.equal(isOwnedProjectionSave(saved), true)
  assert.equal(preparePublication(saved, store.metadata.root).state, saved)
  assert.equal(saved.revisions, before.revisions)
  await store.acknowledgeCompatibilityWrites(store.getCompatibilityState().compatibilityOutbox)
  const acked = store.metadata.state
  assert.equal(isSealedPublication(acked), true)
  assert.equal(isOwnedOutboxSuccessor(acked), true)
  assert.equal(preparePublication(acked, store.metadata.root).state, acked)
  assert.equal(acked.mutationResults, saved.mutationResults)
})

test('closed capture isolates callers, shares sealed history and avoids preparation clone', async () => {
  const { store, params } = await fixture()
  const before = store.metadata.state
  let release
  store.mutationTail = new Promise((resolve) => { release = resolve })
  const pending = store.commitProjectionSave(params)
  params.result.sourceMap.entries.forged = {}
  params.result.operationIds.push('forged')
  params.compatibility.title = 'Caller changed'
  params.expectedHead.generation = 999
  release()
  await pending
  const after = store.metadata.state
  assert.equal(after.revisions, before.revisions)
  assert.equal(after.mutationResults[0], before.mutationResults[0])
  assert.equal(after.mutationResults.at(-1).projection.title, 'Edited')
  assert.equal(after.mutationResults.at(-1).sourceMap.entries.forged, undefined)
  assert.ok(!after.mutationResults.at(-1).operationIds.includes('forged'))
  assert.equal(after.compatibilityOutbox.at(-1).presentation.title, 'Edited')
  assert.ok(Object.isFrozen(after.compatibilityOutbox.at(-1).presentation))
  assert.equal(preparePublication(after, store.metadata.root).state, after)
  const editable = store.getState()
  editable.mutationResults.at(-1).projection.title = 'Public edit'
  assert.equal(after.mutationResults.at(-1).projection.title, 'Edited')
})

test('concurrent saves publish once, replay exactly, and reject conflicting keys', async () => {
  const { store, params } = await fixture()
  const competitor = structuredClone(params)
  competitor.result.idempotencyKey = 'competitor'
  const outcomes = await Promise.allSettled([
    store.commitProjectionSave(params), store.commitProjectionSave(competitor),
  ])
  assert.equal(outcomes[0].status, 'fulfilled')
  assert.equal(outcomes[1].reason.code, 'STALE_GENERATION')
  assert.deepEqual(await store.commitProjectionSave(params), { idempotent: true })
  const conflict = structuredClone(params)
  conflict.result.projection.title = 'Conflict'
  await assert.rejects(store.commitProjectionSave(conflict), { code: 'IDEMPOTENCY_KEY_CONFLICT' })
})

for (const field of ['head', 'store', 'fence', 'matrix']) {
  test(`rejects stale ${field} without publication`, async () => {
    const { store, params } = await fixture()
    if (field === 'head') params.expectedHead.predecessorId = 'changed'
    if (field === 'store') params.expectedStoreGeneration -= 1
    if (field === 'fence') params.expectedFencingEpoch += 1
    if (field === 'matrix') await store.advanceMatrixAuthorityEpoch()
    const before = store.metadata.state
    await assert.rejects(store.commitProjectionSave(params), { code: 'STALE_GENERATION' })
    assert.equal(store.metadata.state, before)
  })
}

test('matrix authority and private token cannot be forged', async () => {
  const { store, params } = await fixture()
  assert.throws(() => commitOwnedProjectionSave(store.metadata.state, {}, store.fencingEpoch), TypeError)
  const raw = store.getState()
  raw.matrixAuthorityEpoch += 1
  const token = captureProjectionSave(params)
  assert.throws(() => commitOwnedProjectionSave(raw, token, store.fencingEpoch), { code: 'STALE_MATRIX_AUTHORITY' })
})

for (const boundary of ['faultAfterIndex', 'faultAfterPrepare', 'faultAfterRoot', 'faultAfterCompletion']) {
  test(`crash recovery preserves durable outbox at ${boundary}`, async () => {
    const { store, params, rootDir } = await fixture()
    const before = store.metadata.state
    await assert.rejects(store.commitProjectionSave(params, { [boundary]: true }), /Injected fault/)
    const published = ['faultAfterRoot', 'faultAfterCompletion'].includes(boundary)
    const recovered = new StateStore(rootDir)
    await recovered.init()
    assert.equal(recovered.state.generation, before.generation + Number(published))
    assert.equal(recovered.state.heads[0].generation, published ? 2 : 1)
    assert.equal(recovered.state.compatibilityOutbox.length, before.compatibilityOutbox.length + Number(published))
    assert.equal(store.metadata.state.generation, recovered.state.generation)
    if (published) assert.deepEqual(await store.commitProjectionSave(params), { idempotent: true })
    else await store.commitProjectionSave(params)
  })
}

test('raw shallow-frozen fallback cannot alias retained history', async () => {
  const { store, params } = await fixture()
  const raw = store.getState()
  Object.freeze(raw)
  store.metadata.state = raw
  await store.commitProjectionSave(params)
  raw.mutationResults[0].projection.title = 'Retained tamper'
  assert.equal(store.metadata.state.mutationResults[0].projection.title, 'Original')
  assert.notEqual(store.metadata.state.revisions, raw.revisions)
})

test('compatibility derives all editable root fields and retains publication metadata', async () => {
  const { store, params } = await fixture()
  params.result.projection = {
    ...params.result.projection, theme: { color: 'blue' }, settings: { loop: true },
    futureEditableField: { value: 'admitted' },
  }
  params.compatibility = {
    ...params.compatibility, title: 'Contradiction', theme: { color: 'red' },
    settings: { loop: false }, futureEditableField: { value: 'forged' },
    compatibilityOnlyEditable: 'must not survive', createdAt: 'publication-created',
    _pptxImportReport: { warnings: ['preserved'] }, pptxOriginal: { revision: 'original' },
  }
  await store.commitProjectionSave(params)
  const presentation = store.metadata.state.compatibilityOutbox.at(-1).presentation
  assert.equal(presentation.title, 'Edited')
  assert.deepEqual(presentation.theme, { color: 'blue' })
  assert.deepEqual(presentation.settings, { loop: true })
  assert.deepEqual(presentation.futureEditableField, { value: 'admitted' })
  assert.equal(presentation.compatibilityOnlyEditable, undefined)
  assert.equal(presentation.createdAt, 'publication-created')
  assert.deepEqual(presentation._pptxImportReport, { warnings: ['preserved'] })
  assert.deepEqual(presentation.pptxOriginal, { revision: 'original' })
})

test('capture still performs canonical admission before any publication', async () => {
  const { store, params } = await fixture()
  const before = store.metadata.state
  params.result.projection = { slides: [], pptxSemantic: { schemaVersion: 999 } }
  await assert.rejects(store.commitProjectionSave(params), /semantic schema/)
  assert.equal(store.metadata.state, before)
})

test('aborted queued save leaves queue usable and publication unchanged', async () => {
  const { store, params } = await fixture()
  const controller = new AbortController()
  const before = store.metadata.state
  let release
  store.mutationTail = new Promise((resolve) => { release = resolve })
  const pending = store.commitProjectionSave(params, { signal: controller.signal })
  controller.abort(new Error('cancel save'))
  release()
  await assert.rejects(pending, /cancel save/)
  assert.equal(store.metadata.state, before)
  await store.commitProjectionSave(params)
})
