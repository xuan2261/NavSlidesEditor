import { afterEach, describe, expect, it, vi } from 'vitest'
import { geometryProjectionFixture } from '../../../tests/pptx-semantic/geometry-projection-fixture'
import { normalizePptxSemanticDocument as normalize } from 'revealjs-shared/src/pptx-semantic-document.js'
import { replaceSemanticRecords, isCertifiedSemanticDocument, certifyImmutableSemanticDocument } from 'revealjs-shared/src/pptx-semantic-records.js'
import { compactSemanticGraph } from 'revealjs-shared/src/pptx-semantic-source-graph.js'
import { prepareEditorDraftBaseline, clearEditorDraft, createEditorDraft, readEditorDraft, writeEditorDraft } from './editor-draft-store'
import { migratePresentation } from './editor-presentation-migration'
import { draftMetadata, captureDraft, captureOwnedDraft, compactDraft, checkpointRecord, expandDraft, acceptCheckpoint } from './editor-draft-semantic-envelope'

function database() {
  const rows = new Map()
  const puts = []
  const gets = []
  const state = { abort: false, hold: false, commits: [] }
  const db = { close() {}, transaction() {
    const pending = []
    const tx = { objectStore: () => ({
      get: (key) => { gets.push(key); return request(() => rows.get(key)) },
      put: (record) => {
        const copy = structuredClone(record)
        puts.push(copy)
        pending.push(() => rows.set(copy.key, copy))
        return request(() => copy.key)
      },
      delete: (key) => { pending.push(() => rows.delete(key)); return request(() => undefined) },
    }) }
    let scheduled = false
    function request(result) {
      const req = {}
      queueMicrotask(() => {
        req.result = structuredClone(result())
        req.onsuccess?.()
        if (!scheduled) {
          scheduled = true
          queueMicrotask(() => {
            const finish = () => {
              if (state.abort) tx.onabort?.()
              else { pending.forEach(fn => fn()); tx.oncomplete?.() }
            }
            if (state.hold) state.commits.push(finish)
            else finish()
          })
        }
      })
      return req
    }
    return tx
  } }
  vi.stubGlobal('indexedDB', { open: () => {
    const req = { result: db }
    queueMicrotask(() => req.onsuccess())
    return req
  } })
  return { rows, puts, gets, state }
}
function semantic(wire = false, producer = false) {
  const raw = geometryProjectionFixture().pptxSemantic
  const def = raw.definitions.definition
  def.components.push(...['body', 'paragraph', 'run'].map((id, i) => ({
    id, kind: i === 2 ? 'run' : 'paragraph',
    locator: { path: [1, i], preconditionHash: 'a'.repeat(64) },
  })))
  def.content.textDocument = { schemaVersion: 1, componentId: 'body', body: {},
    paragraphs: [{ componentId: 'paragraph', properties: {}, runs: [
      { componentId: 'run', kind: 'text', text: 'Original', properties: {} },
    ] }] }
  const input = wire ? compactSemanticGraph(raw) : raw
  if (producer) {
    const freeze = value => {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
      }
      return value
    }
    return certifyImmutableSemanticDocument(freeze(input))
  }
  return certifyImmutableSemanticDocument(normalize(input))
}
function edit(doc, text) {
  // replaceSemanticRecords takes decoded IDs, but persistence must use wire keys.
  const source = JSON.parse(JSON.stringify(doc.schemaVersion === 3
    ? semantic().instances.i1 : doc.instances.i1))
  source.overrides.components = { body: { textDocument: {
    schemaVersion: 1, componentId: 'body', body: {}, paragraphs: [
      { componentId: 'paragraph', properties: {}, runs: [
        { componentId: 'run', kind: 'text', text, properties: {} },
      ] },
    ],
  } } }
  return replaceSemanticRecords(doc, { instances: { i1: source } })
}
it('preserves capture and v2 replay record/snapshot key order including semantic position', async () => {
  const doc = semantic()
  for (const position of ['first', 'middle', 'last']) {
    const snapshot = position === 'first' ? { pptxSemantic: doc, id: position, tail: 1 }
      : position === 'middle' ? { id: position, pptxSemantic: doc, tail: 1 }
        : { id: position, tail: 1, pptxSemantic: doc }
    snapshot[10] = 'ten'; snapshot[2] = 'two'
    const record = { before: 1, snapshot, key: `presentation:order-${position}`, after: 2 }
    const captured = captureDraft(record)
    expect(JSON.stringify(captured.record)).toBe(JSON.stringify(record))
    const checkpoint = checkpointRecord(captured)
    acceptCheckpoint(captured, checkpoint.key)
    const head = compactDraft(captureDraft(record))
    expect(head.semanticDraftVersion).toBe(2)
    const replayed = await expandDraft(JSON.parse(JSON.stringify(head)), async () => checkpoint)
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(record))
    if (position === 'last') expect(head).not.toHaveProperty('snapshotKeyOrder')
  }
})

it('preserves all reserved-looking outer metadata in full durable fallback', async () => {
  database()
  const doc = semantic()
  for (const key of ['shellPatch', 'semanticPatch', 'semanticBaseline', 'semanticDraftVersion',
    'semanticCheckpointVersion', 'snapshotKeyOrder']) {
    const record = { key: `presentation:collision-${key}`, snapshot: { id: `collision-${key}`, pptxSemantic: doc },
      [key]: { unknown: ['keep', null, { unicode: '漢字😀' }] } }
    const baseline = captureDraft({ key: record.key, snapshot: record.snapshot })
    acceptCheckpoint(baseline, checkpointRecord(baseline).key)
    expect(compactDraft(captureDraft(record))).toBeNull()
    const expected = JSON.stringify(record)
    expect(await writeEditorDraft(record)).toBe(true)
    expect(JSON.stringify(readStored(`navslides-editor-draft:${record.key}`))).toBe(expected)
    expect(JSON.stringify(await readEditorDraft(record.snapshot.id))).toBe(expected)
  }
})

it('round trips nonsemantic transport and wrapper collisions through both durable routes', async () => {
  database()
  for (const idbOnly of [false, true]) {
    const denied = idbOnly ? vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') }) : null
    for (const version of [99, 1, 2]) {
      const id = `plain-${idbOnly}-${version}`
      const record = { key: `presentation:${id}`, snapshot: { id, title: 'exact', slides: [{ unknown: null }] },
        semanticDraftVersion: version, semanticBaseline: 'application', semanticPatch: { own: true },
        shellPatch: { unknown: ['漢字😀', null] }, snapshotKeyOrder: ['application'],
        semanticCheckpointVersion: 99, format: 'navslides-editor-draft', storageVersion: 3,
        kind: 'full', record: { application: 'not transport' } }
      const expected = JSON.stringify(record)
      await expect(writeEditorDraft(record, { acknowledgeLocalPublication: true })).resolves.toBe(true)
      expect(JSON.stringify(await readEditorDraft(id))).toBe(expected)
      await clearEditorDraft(id, false, { attemptId: -1 }) // Drain without clearing.
    }
    denied?.mockRestore()
  }
})

it('captures true legacy heads as envelopes and replays v1 and v2 without order proofs', async () => {
  const doc = semantic()
  const record = { key: 'presentation:legacy-audit', snapshot: { id: 'legacy-audit', title: 'legacy', pptxSemantic: doc } }
  const captured = captureDraft(record)
  const checkpoint = checkpointRecord(captured)
  acceptCheckpoint(captured, checkpoint.key)
  const v2 = compactDraft(captureDraft(record))
  expect(v2).not.toHaveProperty('snapshotKeyOrder')
  const v1 = { ...v2, semanticDraftVersion: 1, snapshot: { id: 'legacy-audit', title: 'legacy' } }
  delete v1.shellPatch
  for (const head of [v1, v2]) {
    const copy = captureDraft(head)
    expect(copy.semantic).toBeNull()
    expect(compactDraft(copy)).toBeNull()
    expect(await expandDraft(copy.record, async () => checkpoint)).toEqual(record)
  }
})

let serial = 0
const draft = (doc, attemptId, extra = {}) => createEditorDraft({
  snapshot: { id: `semantic-${serial}`, pptxSemantic: doc, aggregateGeneration: 4,
    idempotencyKey: 'uncertain-original-key', slides: [{ elements: [] }], ...extra },
  attemptId, draftId: `session:${attemptId}`,
})
const readStored = key => draftMetadata(JSON.parse(localStorage.getItem(key)))
const localKey = record => `navslides-editor-draft:${record.key}`
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

describe('durable semantic draft checkpoints', () => {
  it('reuses only privately owned frozen shells and leaves public captures mutable and detached', async () => {
    serial++
    const input = draft(semantic(), 1, { unknown: { values: [1] } })
    const owned = captureOwnedDraft(input)
    const checkpoint = checkpointRecord(owned)
    expect(checkpoint.shell).toBe(owned.shell)
    expect(Object.isFrozen(owned.record.snapshot)).toBe(true)
    expect(Object.isFrozen(checkpoint.shell.unknown.values)).toBe(true)
    expect(Object.isFrozen(input.snapshot.unknown)).toBe(false)
    acceptCheckpoint(owned, checkpoint.key)
    input.snapshot.unknown.values.push(2)
    const next = captureDraft(input)
    const head = compactDraft(next)
    expect(await expandDraft(head, async () => structuredClone(checkpoint))).toEqual(next.record)
    const publicCheckpoint = checkpointRecord(next)
    expect(publicCheckpoint.shell).not.toBe(next.shell)
    acceptCheckpoint(next, publicCheckpoint.key)
    next.shell.unknown.values.push(3)
    publicCheckpoint.shell.unknown.values.push(4)
    const unchanged = compactDraft(captureDraft(input))
    expect(unchanged.shellPatch).toEqual({ sets: [], deletes: [] })
  })

  it.each([false, true])('expands only the metadata winner across independent heads (indexed winner %s)', async (indexedWinner) => {
    serial++
    const { rows, gets } = database()
    const base = semantic()
    const first = draft(base, 1)
    await writeEditorDraft(first)
    await writeEditorDraft(draft(edit(base, 'Winner'), 2))
    const compact = readStored(localKey(first))
    const older = { ...compact, attemptId: 1, draftId: 'other-tab:1', semanticBaseline: 'loser-checkpoint' }
    // Equal timestamps exercise attempt ordering, not expansion-dependent data.
    older.updatedAt = compact.updatedAt
    rows.set(first.key, indexedWinner ? compact : older)
    localStorage.setItem(localKey(first), JSON.stringify(indexedWinner ? older : compact))
    gets.length = 0
    expect((await readEditorDraft(first.id)).attemptId).toBe(2)
    expect(gets).toEqual([first.key, compact.semanticBaseline])
  })

  it.each([false, true])('falls back from invalid winning heads (indexed winner %s)', async (indexedWinner) => {
    serial++
    const { rows } = database()
    const base = semantic()
    const first = draft(base, 1)
    await writeEditorDraft(first)
    await writeEditorDraft(draft(edit(base, 'Valid fallback'), 2))
    const valid = readStored(localKey(first))
    const checkpoint = rows.get(valid.semanticBaseline)
    const full = JSON.parse(JSON.stringify(first))
    // Full, historical v1, and v2 remain readable; foreign/missing baselines,
    // malformed patches, and future versions cannot suppress a valid fallback.
    const v1 = { ...valid, semanticDraftVersion: 1, snapshot: { id: first.id, title: 'legacy' } }
    for (const fallback of [full, v1, valid]) {
      for (const invalid of [
        { semanticDraftVersion: 99 },
        { semanticBaseline: 'missing' },
        { semanticBaseline: 'foreign' },
        { semanticPatch: { sets: null, deletes: [] } },
        { shellPatch: null },
      ]) {
        rows.set('foreign', { ...checkpoint, key: 'foreign', draftKey: 'presentation:other' })
        const winner = { ...valid, ...invalid, attemptId: 3, draftId: 'other-tab:3' }
        winner.updatedAt = fallback.updatedAt
        rows.set(first.key, indexedWinner ? winner : fallback)
        localStorage.setItem(localKey(first), JSON.stringify(indexedWinner ? fallback : winner))
        const recovered = await readEditorDraft(first.id)
        expect(recovered.attemptId).toBe(fallback.attemptId)
        expect(recovered.snapshot.id).toBe(first.id)
        expect(recovered.snapshot.pptxSemantic).toBeTruthy()
      }
    }
  })

  it('reads a pre-upgrade v1 head with a semantic-only persisted baseline unchanged', async () => {
    serial++
    const { rows } = database()
    const base = semantic()
    const next = draft(edit(base, 'Legacy recovered text'), 2, {
      unknown: { preserved: [null, { value: '漢字😀' }] },
    })
    const expected = JSON.parse(JSON.stringify(next))
    const baselineKey = `legacy-checkpoint:${serial}`
    // Historical checkpoints had no shell. Do not retrofit a v2 baseline.
    rows.set(baselineKey, { key: baselineKey, draftKey: next.key,
      semanticCheckpointVersion: 1, semantic: JSON.parse(JSON.stringify(base)) })
    const { pptxSemantic, ...shell } = expected.snapshot
    const head = { ...expected, snapshot: shell, semanticDraftVersion: 1,
      semanticBaseline: baselineKey, semanticPatch: {
        sets: [['i1', pptxSemantic.instances.i1]], deletes: [],
      } }
    localStorage.setItem(localKey(next), JSON.stringify(head))
    vi.resetModules()
    const upgraded = await import('./editor-draft-store')
    await expect(upgraded.readEditorDraft(next.id)).resolves.toEqual(expected)
    expect(readStored(localKey(next))).toEqual(head)
    expect(rows.get(baselineKey).shell).toBeUndefined()
  })

  it('keeps public capture isolated and refuses v2 with a semantic-only baseline', () => {
    serial++
    const base = semantic()
    const loaded = draft(base, 1, { unknown: { values: [1, 2] } })
    const captured = captureDraft(loaded)
    // Model an old accepted checkpoint: semantic identity is insufficient.
    acceptCheckpoint({ record: captured.record, semantic: captured.semantic }, 'old-base')
    const next = draft(edit(base, 'Requires full shell'), 2, { unknown: { values: [3] } })
    const publicCapture = captureDraft(next)
    expect(compactDraft(publicCapture)).toBeNull()
    expect(publicCapture.record).toEqual(next)
    next.snapshot.unknown.values.push(4)
    expect(publicCapture.record.snapshot.unknown.values).toEqual([3])
    publicCapture.record.snapshot.unknown.values.push(5)
    expect(next.snapshot.unknown.values).toEqual([3, 4])
  })

  it('prepares without a phantom draft and compacts the first edit only after commit', async () => {
    serial++
    const { state, rows, puts } = database()
    const base = semantic()
    const loaded = draft(base, 1)
    state.hold = true
    const preparing = prepareEditorDraftBaseline(loaded.snapshot)
    await vi.waitFor(() => expect(state.commits).toHaveLength(1))
    expect(localStorage.getItem(localKey(loaded))).toBeNull()
    expect(rows.size).toBe(0)
    state.hold = false
    state.commits.shift()()
    await expect(preparing).resolves.toBe(true)
    expect(await readEditorDraft(loaded.id)).toBeNull()
    expect(rows.has(loaded.key)).toBe(false)
    const first = draft(edit(base, 'First typed edit'), 7)
    await writeEditorDraft(first)
    expect(readStored(localKey(first)).semanticDraftVersion).toBe(2)
    expect(await readEditorDraft(first.id)).toEqual(JSON.parse(JSON.stringify(first)))
    expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(1)
  })

  it.each([false, true])('keeps invalid oversized certified wire %s full and rejects actual recovery', async (wire) => {
    serial++
    const { puts } = database()
    const original = semantic(wire)
    // Certification permits sharing, but cannot authorize a compact checkpoint.
    // Preserve the entire invalid snapshot for predictable recovery rejection.
    const base = certifyImmutableSemanticDocument(Object.freeze({ ...original,
      fonts: Object.freeze({ payload: 'x'.repeat(9 * 1024 * 1024) }),
    }))
    expect(() => normalize(base)).toThrow(/byte budget/)
    await expect(prepareEditorDraftBaseline(draft(base, 1).snapshot)).resolves.toBe(false)
    expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(0)
    const stringify = vi.spyOn(JSON, 'stringify')
    let expected
    for (let attempt = 2; attempt <= 4; attempt++) {
      const next = draft(edit(base, `Typed ${attempt}`), attempt)
      stringify.mockClear()
      const writing = writeEditorDraft(next, { acknowledgeLocalPublication: true })
      const calls = stringify.mock.calls.slice()
      expect(calls.some(([value]) =>
        draftMetadata(value)?.snapshot?.pptxSemantic === next.snapshot.pptxSemantic)).toBe(true)
      await expect(writing).resolves.toBe(true)
      // The deliberately oversized full record can exceed localStorage quota;
      // IndexedDB must still retain every invalid byte without compaction.
      const stored = await readEditorDraft(next.id)
      expect(stored.semanticDraftVersion).toBeUndefined()
      expect(stored).toEqual(JSON.parse(JSON.stringify(next)))
      expected = next
      // Drain maintenance without deleting the accepted head.
      await clearEditorDraft(next.id, false, { attemptId: 0, draftId: 'session:0' })
      expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(0)
    }
    stringify.mockRestore()
    // A reloaded module has no in-memory baseline; replay depends exclusively
    // on the committed checkpoint and synchronously published compact head.
    vi.resetModules()
    const reloaded = await import('./editor-draft-store')
    const restored = await reloaded.readEditorDraft(`semantic-${serial}`)
    expect(restored).toEqual(JSON.parse(JSON.stringify(expected)))
    expect(() => migratePresentation(restored.snapshot, { draft: true })).toThrow(/byte budget/)
  })

  it('keeps first writes full while preparation is pending and fences stale acceptance', async () => {
    serial++
    const { state } = database()
    const base = semantic()
    state.hold = true
    let current = true
    const preparing = prepareEditorDraftBaseline(draft(base, 1).snapshot, false, () => current)
    await vi.waitFor(() => expect(state.commits).toHaveLength(1))
    const next = draft(edit(base, 'Before commit'), 2)
    const writing = writeEditorDraft(next, { acknowledgeLocalPublication: true })
    expect(readStored(localKey(next)).semanticDraftVersion).toBeUndefined()
    await expect(writing).resolves.toBe(true)
    current = false
    state.hold = false
    for (const commit of state.commits.splice(0)) commit()
    await expect(preparing).resolves.toBe(false)
    await clearEditorDraft(next.id) // Drain maintenance.
  })

  it('does not trust raw identity and keeps mutable edits on the full fallback', async () => {
    serial++
    database()
    const raw = JSON.parse(JSON.stringify(semantic()))
    const loaded = draft(raw, 1)
    await expect(prepareEditorDraftBaseline(loaded.snapshot)).resolves.toBe(false)
    expect(await readEditorDraft(loaded.id)).toBeNull()
    const base = semantic()
    await expect(prepareEditorDraftBaseline(draft(base, 1).snapshot)).resolves.toBe(true)
    raw.instances.i1.paintIndex = 123
    const first = draft(raw, 2)
    await writeEditorDraft(first)
    expect(readStored(localKey(first)).semanticDraftVersion).toBeUndefined()
    expect(await readEditorDraft(first.id)).toEqual(JSON.parse(JSON.stringify(first)))
  })

  it.each([false, true])('reconstructs exact full snapshots and metadata with wire format %s', async (wire) => {
    serial++
    const { puts } = database()
    const base = semantic(wire)
    expect(isCertifiedSemanticDocument(base)).toBe(true)
    await expect(writeEditorDraft(draft(base, 1))).resolves.toBe(true)
    expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(1)
    const edited = edit(base, 'Typed')
    normalize(edited)
    const next = draft(edited, 2, { title: null, omitted: undefined,
      slides: [{ elements: [null, undefined] }] })
    const writing = writeEditorDraft(next)
    const envelope = readStored(localKey(next))
    // Undefined shell values require historical JSON capture, not v2 admission.
    expect(envelope.semanticDraftVersion).toBeUndefined()
    expect(envelope.snapshot.pptxSemantic).toEqual(JSON.parse(JSON.stringify(edited)))
    next.snapshot.title = 'Mutated after capture'
    next.snapshot.slides.length = 0
    next.aggregateGeneration = 99
    await expect(writing).resolves.toBe(true)
    const restored = await readEditorDraft(next.id)
    expect(restored).toEqual(JSON.parse(JSON.stringify({ ...next,
      aggregateGeneration: 4, snapshot: { ...next.snapshot, title: null,
        slides: [{ elements: [null, null] }] } })))
    expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(1)
    await clearEditorDraft(next.id, false, { ...next, attemptId: 1, draftId: 'session:1', updatedAt: '' })
    expect((await readEditorDraft(next.id)).attemptId).toBe(2)
  })

  it.each([false, true])('retains the original certified producer root and compacts wire %s edits', async (wire) => {
    serial++
    const { puts } = database()
    const base = semantic(wire, true)
    const receipt = normalize(base)
    expect(receipt).not.toBe(base)
    await expect(prepareEditorDraftBaseline(draft(base, 1).snapshot)).resolves.toBe(true)
    const stringify = vi.spyOn(JSON, 'stringify')
    for (let attempt = 2; attempt <= 4; attempt++) {
      const next = draft(edit(base, `Producer edit ${attempt}`), attempt)
      stringify.mockClear()
      const writing = writeEditorDraft(next, { acknowledgeLocalPublication: true })
      expect(readStored(localKey(next)).semanticDraftVersion).toBe(2)
      expect(stringify.mock.calls.some(([value]) =>
        value?.snapshot?.pptxSemantic === next.snapshot.pptxSemantic)).toBe(false)
      await expect(writing).resolves.toBe(true)
      expect(await readEditorDraft(next.id)).toEqual(JSON.parse(JSON.stringify(next)))
      await clearEditorDraft(next.id, false, { attemptId: 0, draftId: 'session:0' })
    }
    expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(1)
  })

  it('acknowledges full local recovery before delayed cleanup and checkpoint commits', async () => {
    serial++
    const { state, puts, rows } = database()
    state.hold = true
    const first = draft(semantic(), 1)
    const settled = vi.fn()
    const writing = writeEditorDraft(first, { acknowledgeLocalPublication: true }).then(settled)
    await vi.waitFor(() => expect(state.commits).toHaveLength(1))
    expect(settled).toHaveBeenCalledWith(true)
    expect(puts).toHaveLength(0)
    expect(readStored(localKey(first))).toEqual(JSON.parse(JSON.stringify(first)))
    state.commits.shift()() // Cleanup commits; the checkpoint still must not block acknowledgement.
    await vi.waitFor(() => expect(state.commits).toHaveLength(1))
    expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(1)
    expect(rows.size).toBe(0)
    await writing
    const idb = indexedDB
    vi.stubGlobal('indexedDB', undefined)
    await expect(readEditorDraft(first.id)).resolves.toEqual(JSON.parse(JSON.stringify(first)))
    vi.stubGlobal('indexedDB', idb)
    state.hold = false
    state.commits.shift()()
    // A default write drains maintenance, proving it continued in writeChain.
    const next = draft(edit(first.snapshot.pptxSemantic, 'After maintenance'), 2)
    await expect(writeEditorDraft(next)).resolves.toBe(true)
    expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(1)
    expect(await readEditorDraft(next.id)).toEqual(JSON.parse(JSON.stringify(next)))
  })

  it('publishes a full certified snapshot when a cached baseline exists but IndexedDB is unavailable', async () => {
    serial++
    const { puts } = database()
    const base = semantic()
    await writeEditorDraft(draft(base, 1))
    expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(1)
    const compact = draft(edit(base, 'Compact'), 2)
    await writeEditorDraft(compact)
    expect(readStored(localKey(compact)).semanticDraftVersion).toBe(2)

    vi.stubGlobal('indexedDB', undefined)
    // A persisted v2 head alone is not a recoverable snapshot.
    await expect(readEditorDraft(compact.id)).resolves.toBeNull()
    const next = draft(edit(base, 'Offline full recovery'), 3)
    await expect(writeEditorDraft(next, { acknowledgeLocalPublication: true })).resolves.toBe(true)
    const local = readStored(localKey(next))
    expect(local.semanticDraftVersion).toBeUndefined()
    expect(local.snapshot.pptxSemantic).toEqual(JSON.parse(JSON.stringify(next.snapshot.pptxSemantic)))
    await expect(readEditorDraft(next.id)).resolves.toEqual(JSON.parse(JSON.stringify(next)))
    await clearEditorDraft(next.id) // Drain queued maintenance before restoring globals.
  })

  it('writes compact quota fallback bytes, not the immutable multi-megabyte graph', async () => {
    serial++
    const { puts } = database()
    const base = semantic()
    await writeEditorDraft(draft(base, 1))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
    const next = draft(edit(base, 'durable'), 2)
    await expect(writeEditorDraft(next)).resolves.toBe(true)
    const head = puts.at(-1)
    expect(head.semanticDraftVersion).toBe(2)
    expect(JSON.stringify(head).length).toBeLessThan(JSON.stringify(next).length / 2)
    expect(await readEditorDraft(next.id)).toEqual(JSON.parse(JSON.stringify(next)))
    await clearEditorDraft(next.id, false, next)
    expect(await readEditorDraft(next.id)).toBeNull()
    expect(puts.filter(p => p.semanticCheckpointVersion)).toHaveLength(1)
  })

  it('does not publish compact heads before commit or after an aborted checkpoint', async () => {
    serial++
    const { state } = database()
    state.abort = true
    const base = semantic()
    await expect(writeEditorDraft(draft(base, 1))).resolves.toBe(true)
    const next = draft(edit(base, 'Second'), 2)
    const writing = writeEditorDraft(next)
    expect(readStored(localKey(next)).semanticDraftVersion).toBeUndefined()
    await writing
    expect((await readEditorDraft(next.id)).snapshot.pptxSemantic).toEqual(next.snapshot.pptxSemantic)
  })

  it('contains checkpoint preparation errors and still settles subsequent fallback acknowledgements', async () => {
    serial++
    database()
    const base = semantic()
    const first = draft(base, 1)
    vi.stubGlobal('crypto', { randomUUID: () => { throw Error('checkpoint nonce unavailable') } })
    await expect(writeEditorDraft(first)).resolves.toBe(true)
    expect(await readEditorDraft(first.id)).toEqual(JSON.parse(JSON.stringify(first)))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
    const next = draft(edit(base, 'Fallback after maintenance failure'), 2)
    await expect(writeEditorDraft(next, { acknowledgeLocalPublication: true })).resolves.toBe(true)
    expect(await readEditorDraft(next.id)).toEqual(JSON.parse(JSON.stringify(next)))
    await clearEditorDraft(next.id)
  })

  it('captures mutable fallback data synchronously and fails when neither backend exists', async () => {
    serial++
    database()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
    const pending = draft(JSON.parse(JSON.stringify(semantic())), 1, { title: 'captured' })
    const writing = writeEditorDraft(pending)
    pending.snapshot.title = 'later'
    await expect(writing).resolves.toBe(true)
    expect((await readEditorDraft(pending.id)).snapshot.title).toBe('captured')
    vi.stubGlobal('indexedDB', undefined)
    await expect(writeEditorDraft(pending)).resolves.toBe(false)
  })

  it('retains the prior recoverable envelope when an IDB successor aborts', async () => {
    serial++
    const { state } = database()
    const base = semantic()
    const first = draft(base, 1)
    await writeEditorDraft(first)
    const second = draft(edit(base, 'Second'), 2)
    await writeEditorDraft(second)
    const accepted = localStorage.getItem(localKey(first))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota') })
    state.abort = true
    await expect(writeEditorDraft(draft(edit(base, 'Lost'), 3))).resolves.toBe(false)
    expect(localStorage.getItem(localKey(first))).toBe(accepted)
    state.abort = false
    expect((await readEditorDraft(first.id)).attemptId).toBe(2)
  })

  it('falls back full for nontext graph changes and fails closed with a missing base', async () => {
    serial++
    const { rows } = database()
    const base = semantic()
    await writeEditorDraft(draft(base, 1))
    const changed = replaceSemanticRecords(base, { instances: { i1: {
      ...base.instances.i1, paintIndex: 20,
    } } })
    const next = draft(changed, 2)
    await writeEditorDraft(next)
    expect(readStored(localKey(next)).semanticDraftVersion).toBeUndefined()
    const third = draft(edit(changed, 'After rebase'), 3)
    await writeEditorDraft(third)
    const envelope = readStored(localKey(third))
    expect(envelope.semanticDraftVersion).toBe(2)
    rows.delete(envelope.semanticBaseline)
    await expect(readEditorDraft(third.id)).resolves.toBeNull()
  })
})
