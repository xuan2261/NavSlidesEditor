import { afterEach, expect, it, vi } from 'vitest'
import { captureShell, captureOwnedShell, replayShell } from './editor-draft-shell-delta'
import { fullDraftEnvelope, draftMetadata, captureDraft, compactDraft, expandDraft, checkpointRecord, acceptCheckpoint } from './editor-draft-semantic-envelope'

it('replays own wire keys without prototype setters and preserves JSON null/deletion semantics', async () => {
  const instances = JSON.parse('{"__proto__":{"old":true},"constructor":null,"gone":{}}')
  const baseline = { key: 'base', draftKey: 'presentation:deck',
    semanticCheckpointVersion: 1, semantic: { schemaVersion: 3, instances } }
  const head = { key: 'presentation:deck', draftId: 'session:7', attemptId: 7,
    aggregateGeneration: 3, idempotencyKey: 'original-retry-key',
    snapshot: { id: 'deck', title: null }, semanticDraftVersion: 1,
    semanticBaseline: 'base', semanticPatch: {
      sets: [['__proto__', { value: null }], ['constructor', null]], deletes: ['gone'],
    } }
  const replayed = await expandDraft(head, async () => structuredClone(baseline))
  expect(Object.getPrototypeOf(replayed.snapshot.pptxSemantic.instances)).toBe(Object.prototype)
  expect(Object.hasOwn(replayed.snapshot.pptxSemantic.instances, '__proto__')).toBe(true)
  expect(replayed.snapshot.pptxSemantic.instances.__proto__).toEqual({ value: null })
  expect(Object.hasOwn(replayed.snapshot.pptxSemantic.instances, 'gone')).toBe(false)
  expect(replayed.idempotencyKey).toBe('original-retry-key')
  expect(replayed.aggregateGeneration).toBe(3)
  expect(replayed.draftId).toBe('session:7')
  expect(baseline.semantic.instances.gone).toEqual({})
  await expect(expandDraft(head, async () => ({ ...baseline, draftKey: 'foreign' }))).resolves.toBeNull()
  await expect(expandDraft({ ...head, semanticDraftVersion: 2 }, async () => baseline)).resolves.toBeNull()
})

it('separates full application metadata from strict storage structure and binds routes', async () => {
  const record = { key: 'presentation:metadata', snapshot: { id: 'metadata', title: 'full' },
    format: 'navslides-editor-draft', storageVersion: 3, kind: 'full', record: { forged: true } }
  const stored = fullDraftEnvelope(record)
  expect(draftMetadata(stored)).toBe(record)
  expect(draftMetadata(record)).toBe(record)
  await expect(expandDraft(stored, async () => null, record.key)).resolves.toBe(record)
  await expect(expandDraft(stored, async () => null, 'presentation:foreign')).resolves.toBeNull()
  for (const version of [99, 1, 2]) {
    const legacy = { ...record, semanticDraftVersion: version, semanticBaseline: 'ordinary',
      semanticPatch: { application: true }, shellPatch: null, snapshotKeyOrder: ['ordinary'] }
    await expect(expandDraft(legacy, async () => { throw Error('not transport') })).resolves.toBe(legacy)
    await expect(expandDraft({ ...legacy, snapshot: { id: 'metadata' } }, async () => null)).resolves.toBeNull()
  }
})

it('never trusts raw or shallow-frozen mutable semantic input by identity', () => {
  const semantic = Object.freeze({ schemaVersion: 1, instances: { i: { value: 1 } } })
  const input = { key: 'presentation:raw', snapshot: { id: 'raw', pptxSemantic: semantic } }
  const first = captureDraft(input)
  expect(first.semantic).toBeNull()
  semantic.instances.i.value = 2
  const second = captureDraft(input)
  expect(first.record.snapshot.pptxSemantic.instances.i.value).toBe(1)
  expect(second.record.snapshot.pptxSemantic.instances.i.value).toBe(2)
  expect(compactDraft(second)).toBeNull()
})

it('captures a 39-slide v2 shell before serialization and restores every unknown field after reload', async () => {
  const { geometryProjectionFixture } = await import('../../../tests/pptx-semantic/geometry-projection-fixture')
  const { normalizePptxSemanticDocument } = await import('revealjs-shared/src/pptx-semantic-document.js')
  const { certifyImmutableSemanticDocument } = await import('revealjs-shared/src/pptx-semantic-records.js')
  const semantic = certifyImmutableSemanticDocument(normalizePptxSemanticDocument(geometryProjectionFixture().pptxSemantic))
  const snapshot = { id: 'shell39', pptxSemantic: semantic,
    unknown: { deleted: 'remove', kept: '漢字😀' },
    slides: Array.from({ length: 39 }, (_, i) => ({ id: `s${i}`, html: 'x'.repeat(55000), unknown: { i } })) }
  const first = captureDraft({ key: 'presentation:shell39', snapshot })
  const checkpoint = checkpointRecord(first)
  acceptCheckpoint(first, checkpoint.key)
  // Public receipts and inputs cannot mutate the installed checkpoint shell.
  first.shell.unknown.kept = 'outside mutation'
  delete snapshot.unknown.deleted
  snapshot.unknown.added = { unicode: 'é 中文 🚀' }
  snapshot.slides.reverse()
  snapshot.slides[0].unknown.i = 400
  snapshot.slides.push({ id: 'temporary' })
  snapshot.slides.pop()
  const stringify = vi.spyOn(JSON, 'stringify')
  const captured = captureDraft({ key: 'presentation:shell39', attemptId: 2, snapshot })
  const head = compactDraft(captured)
  expect(head.semanticDraftVersion).toBe(2)
  expect(stringify.mock.calls.some(([value]) => value?.slides || value?.snapshot?.slides)).toBe(false)
  const expected = JSON.parse(JSON.stringify(captured.record))
  snapshot.slides[0].unknown.i = -1
  snapshot.unknown.added.unicode = 'mutated after capture'
  const serializedHead = JSON.parse(JSON.stringify(head))
  expect(JSON.stringify(serializedHead).length).toBeLessThan(15000)
  vi.resetModules()
  const reloaded = await import('./editor-draft-semantic-envelope')
  expect(await reloaded.expandDraft(serializedHead, async () => structuredClone(checkpoint))).toEqual(expected)
  expect(checkpoint.shell.unknown.deleted).toBe('remove')
  expect(checkpoint.shell.slides[0].id).toBe('s0')
})

it('replaces structurally changed arrays, isolates payloads, and rejects unsafe paths and descriptors', () => {
  const base = { array: [{ id: 1 }], unknown: { remove: true } }
  const input = { array: [{ id: 2 }, { id: 1 }], unknown: {} }
  const { patch } = captureShell(input, base)
  expect(patch.sets).toEqual([[['array'], [{ id: 2 }, { id: 1 }]]])
  input.array[0].id = 99
  expect(replayShell(base, patch)).toEqual({ array: [{ id: 2 }, { id: 1 }], unknown: {} })
  expect(base.unknown.remove).toBe(true)
  for (const path of [['__proto__', 'polluted'], ['constructor'], ['array', '99'], ['absent', 'child']]) {
    expect(() => replayShell(base, { sets: [[path, 1]], deletes: [] })).toThrow()
  }
  let reads = 0
  const getter = { get unsafe() { reads++; return 1 } }
  expect(() => captureShell(getter, {})).toThrow()
  expect(reads).toBe(0)
  expect(() => captureShell(Object.create({ inherited: true }), {})).toThrow()
  expect(() => captureShell(JSON.parse('{"__proto__":1}'), {})).toThrow()
})

it('preserves exact effective object order at root and inside arrays without changing baselines', () => {
  const base = { a: 1, b: 2, nested: [{ first: 1, second: 2 }], 10: 'ten', 2: 'two' }
  const baseline = JSON.stringify(base)
  const inputs = [
    { b: 2, a: 1, nested: [{ first: 1, second: 2 }], 2: 'two', 10: 'ten' },
    { a: 1, b: 2, nested: [{ second: 2, first: 1 }], 10: 'ten', 2: 'two' },
    { added: 3, a: 1, nested: [{ first: 1, second: 2 }], 1: 'one', 10: 'ten', 2: 'two' },
  ]
  for (const input of inputs) {
    const { patch } = captureShell(input, base)
    const replayed = replayShell(base, JSON.parse(JSON.stringify(patch)))
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(input))
    expect(Object.keys(replayed)).toEqual(Object.keys(input))
    expect(Object.keys(replayed.nested[0])).toEqual(Object.keys(input.nested[0]))
    expect(JSON.stringify(base)).toBe(baseline)
  }
  for (const patch of [
    { sets: [[[], {}], [['a'], 1]], deletes: [] },
    { sets: [[[], {}]], deletes: [['a']] },
    { sets: [[[], JSON.parse('{"__proto__":1}')]], deletes: [] },
    { sets: [], deletes: [[]] },
  ]) expect(() => replayShell(base, patch)).toThrow()
})

it('falls back to full JSON before metadata or snapshot getters and isolates their results', async () => {
  const { geometryProjectionFixture } = await import('../../../tests/pptx-semantic/geometry-projection-fixture')
  const { normalizePptxSemanticDocument } = await import('revealjs-shared/src/pptx-semantic-document.js')
  const { certifyImmutableSemanticDocument } = await import('revealjs-shared/src/pptx-semantic-records.js')
  const semantic = certifyImmutableSemanticDocument(normalizePptxSemanticDocument(geometryProjectionFixture().pptxSemantic))
  for (const snapshotGetter of [false, true]) {
    const make = () => {
      const calls = []
      const snapshot = { id: 'getter', title: 'before', pptxSemantic: semantic }
      const record = { key: 'presentation:getter', get metadata() {
        calls.push('metadata'); snapshot.title = 'after'; return { title: 'metadata' }
      } }
      Object.defineProperty(record, 'snapshot', snapshotGetter
        ? { enumerable: true, get() { calls.push('snapshot'); return snapshot } }
        : { enumerable: true, value: snapshot })
      return { record, snapshot, calls }
    }
    const historical = make()
    const expected = JSON.stringify(historical.record)
    const actual = make()
    const captured = captureDraft(actual.record)
    expect(actual.calls).toEqual(historical.calls)
    expect(JSON.stringify(captured.record)).toBe(expected)
    expect(captured.semantic).toBeNull()
    expect(compactDraft(captured)).toBeNull()
    actual.snapshot.title = 'later mutation'
    expect(captured.record.snapshot.title).toBe('after')
  }
  const record = { key: 'presentation:nonenum', snapshot: { id: 'getter', pptxSemantic: semantic },
    omitted: undefined, fn() {} }
  const hidden = vi.fn(() => 'ignored')
  Object.defineProperty(record, 'hidden', { get: hidden })
  const captured = captureDraft(record)
  expect(JSON.stringify(captured.record)).toBe(JSON.stringify(record))
  expect(hidden).not.toHaveBeenCalled()
  expect(compactDraft(captured)).toBeNull()
})

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('shares owned unchanged subtrees only after validating every raw descriptor', () => {
  const raw = { slides: [{ nested: { text: 'a' } }, { nested: { text: 'b' } }], meta: { a: 1 } }
  const base = captureOwnedShell(raw).copy
  const unchanged = captureOwnedShell(raw, base)
  expect(unchanged.copy).toBe(base)
  expect(unchanged.patch).toEqual({ sets: [], deletes: [] })
  raw.slides[0].nested.text = 'edited'
  const changed = captureOwnedShell(raw, base)
  expect(changed.copy).not.toBe(base)
  expect(changed.copy.slides).not.toBe(base.slides)
  expect(changed.copy.slides[1]).toBe(base.slides[1])
  expect(changed.copy.meta).toBe(base.meta)
  raw.slides[0].nested.text = 'later'
  expect(changed.copy.slides[0].nested.text).toBe('edited')
  const publicCopy = captureShell(changed.copy, base).copy
  publicCopy.slides[1].nested.text = 'public'
  expect(base.slides[1].nested.text).toBe('b')
  const shallow = Object.freeze({ nested: { value: 1 } })
  const owned = captureOwnedShell(shallow, shallow).copy
  expect(owned).not.toBe(shallow)
  shallow.nested.value = 2
  expect(owned.nested.value).toBe(1)
  const alias = { value: 1 }
  expect(captureOwnedShell({ a: alias, b: alias }).copy).toEqual({ a: { value: 1 }, b: { value: 1 } })
  // eslint-disable-next-line no-sparse-arrays
  for (const bad of [NaN, Infinity, new Date(), Object.create({ inherited: 1 }), [, 1]]) {
    expect(() => captureOwnedShell({ meta: bad }, base)).toThrow()
  }
  const cycle = {}; cycle.self = cycle
  expect(() => captureOwnedShell(cycle, base)).toThrow()
  let reads = 0
  Object.defineProperty(raw.slides[1].nested, 'text', { enumerable: true, get() { reads++; return 'b' } })
  expect(() => captureOwnedShell(raw, base)).toThrow()
  expect(reads).toBe(0)
})

it('canonicalizes proxy integer keys while retaining string insertion and array order', () => {
  const target = { 2: 'two', 10: 'ten', a: 1, b: 2 }
  const proxy = new Proxy(target, { ownKeys: () => ['b', '10', 'a', '2'] })
  const base = captureOwnedShell({ 2: 'old', a: 1, b: 2 }).copy
  const result = captureOwnedShell(proxy, base)
  expect(Object.keys(result.copy)).toEqual(['2', '10', 'b', 'a'])
  expect(JSON.stringify(replayShell(base, result.patch))).toBe(JSON.stringify(result.copy))
  const array = new Proxy([{ b: 2, a: 1 }, -0], { ownKeys: () => ['1', 'length', '0'] })
  const captured = captureShell(array)
  expect(Object.keys(captured.copy)).toEqual(['0', '1'])
  expect(Object.keys(captured.copy[0])).toEqual(['b', 'a'])
  expect(Object.is(captured.copy[1], -0)).toBe(false)
  captured.copy[0].a = 3
  expect(array[0].a).toBe(1)
})

it('checks array accessors, hidden and symbol fields on each capture without reading getters', () => {
  const raw = { list: [{ value: 1 }] }
  const base = captureOwnedShell(raw).copy
  const getter = vi.fn(() => ({ value: 1 }))
  Object.defineProperty(raw.list, '0', { enumerable: true, configurable: true, get: getter })
  expect(() => captureOwnedShell(raw, base)).toThrow()
  expect(getter).not.toHaveBeenCalled()
  for (const key of ['hidden', Symbol('hidden')]) {
    const list = [1]
    Object.defineProperty(list, key, { value: 2 })
    expect(() => captureShell(list)).toThrow()
  }
  const list = [1, 2]
  delete list[0]
  expect(() => captureShell(list)).toThrow()
})

it('collects proxy descriptors before descending into values and isolates repeated captures', () => {
  const events = []
  const child = new Proxy({ value: 1 }, { ownKeys(target) {
    events.push('child'); return Reflect.ownKeys(target)
  } })
  const target = { child, later: [1] }
  const proxy = new Proxy(target, { getOwnPropertyDescriptor(target, key) {
    events.push(key); return Object.getOwnPropertyDescriptor(target, key)
  } })
  const first = captureShell(proxy).copy
  expect(events.slice(0, 3)).toEqual(['child', 'later', 'child'])
  target.later.push(2)
  const second = captureShell(proxy, first).copy
  first.later.push(3)
  second.later.push(4)
  expect(target.later).toEqual([1, 2])
  expect(first.later).toEqual([1, 3])
  expect(second.later).toEqual([1, 2, 4])
})

it('replays owned replacements with exact nested integer order, deletions and new array items', () => {
  const base = captureOwnedShell({ list: [{ a: 1, b: 2 }], meta: { 2: 'two', a: 1, b: 2 } }).copy
  for (const input of [
    { list: [{ b: 2, a: 1 }], meta: { 1: 'one', 2: 'two', b: 2 } },
    { list: [{ a: 1, b: 2 }, { fresh: [1, 2] }], meta: { b: 2, a: 1, 2: 'two' } },
    { list: [], meta: {} },
  ]) {
    const result = captureOwnedShell(input, base)
    expect(JSON.stringify(replayShell(base, result.patch))).toBe(JSON.stringify(input))
    expect(JSON.stringify(result.copy)).toBe(JSON.stringify(input))
  }
})
