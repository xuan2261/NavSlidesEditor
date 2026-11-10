import { describe, expect, it } from 'vitest'
import journalModule from './mutation-journal.js'
import plannerModule from './transactional-patch-planner.js'

const { canonicalEditableSnapshot, deriveCanonicalPlainTextJournal, deriveMutationJournal, replayJournal } = journalModule
const { compilePatchPlan: rawCompilePatchPlan } = plannerModule
const compilePatchPlan = (input) => rawCompilePatchPlan(input, { matrixAuthorityEpoch: 1 })
const source = {
  status: 'authoritative',
  partUri: 'ppt/slides/slide1.xml',
  nativeId: '4',
  sourceHash: 'a'.repeat(64),
}
const base = {
  id: 'deck',
  _pptxEdited: true,
  packageRevisionId: 'forged',
  slides: [
    { id: 's1', elements: [{ id: 'e1', type: 'text', content: 'before', _pptxSource: source }] },
    { id: 's2', elements: [] },
  ],
}

describe('canonical mutation journal', () => {
  it('strips forged authority recursively and enforces budgets before cloning', () => {
    const clean = canonicalEditableSnapshot(base)
    expect(clean).not.toHaveProperty('_pptxEdited')
    expect(clean).not.toHaveProperty('packageRevisionId')
    expect(clean.slides[0].elements[0]).not.toHaveProperty('_pptxSource')
    const enriched = canonicalEditableSnapshot({
      ...base,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      designTokens: { background: '#fff' },
      pluginData: { createdAt: 'plugin-data', updatedAt: 'plugin-data' },
    })
    expect(enriched).not.toMatchObject({
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    })
    expect(enriched.designTokens).toEqual({ background: '#fff' })
    expect(enriched.pluginData).toEqual({ createdAt: 'plugin-data', updatedAt: 'plugin-data' })
    expect(() => canonicalEditableSnapshot(base, { maxSlides: 1 })).toThrow(/budget/i)
  })

  it('keeps legacy geometry echoes out of canonical no-op and text journals', () => {
    const before = canonicalEditableSnapshot({ ...base, resolution: { width: 960, height: 540 } })
    const echoed = { ...before, _pptxMeta: { originalSize: { width: 960, height: 540 } } }
    expect(canonicalEditableSnapshot(echoed)).toEqual(before)
    expect(deriveMutationJournal(before, echoed, { matrixAuthorityEpoch: 1 }).operations).toEqual([])
    const edited = structuredClone(echoed)
    edited.slides[0].elements[0].content = 'after'
    const journal = deriveMutationJournal(before, edited, { matrixAuthorityEpoch: 1 })
    expect(journal.operations.map(({ property }) => property)).toEqual(['content'])
    expect(replayJournal(before, journal)).toEqual(canonicalEditableSnapshot(edited))
  })

  it('keeps ordinary geometry through canonicalization and journal replay without retaining authority', () => {
    const presentation = {
      ...base,
      resolution: { width: 720, height: 540 },
      _pptxMeta: {
        originalSize: { width: 960, height: 720, packageRevisionId: 'forged' },
        geometryPolicy: 'native-aspect-v1',
        packageRevisionId: 'forged',
      },
    }
    const canonical = canonicalEditableSnapshot(presentation)
    expect(canonical._pptxMeta).toEqual({
      originalSize: { width: 960, height: 720 }, geometryPolicy: 'native-aspect-v1',
    })
    expect(canonicalEditableSnapshot(canonical)).toEqual(canonical)
    const edited = structuredClone(canonical)
    edited.slides[0].elements[0].content = 'after'
    const journal = deriveMutationJournal(canonical, edited, { matrixAuthorityEpoch: 1 })
    expect(replayJournal(canonical, journal)).toEqual(edited)
    expect(journal.operations).toHaveLength(1)
    expect(journal.operations[0]).toMatchObject({ property: 'content', after: 'after' })
    expect(presentation._pptxMeta).toHaveProperty('packageRevisionId', 'forged')
  })

  it.each(['native-aspect-v2', true, null])('drops unrecognized canonical geometry policy: %j', (geometryPolicy) => {
    expect(canonicalEditableSnapshot({ ...base, _pptxMeta: {
      originalSize: { width: 720, height: 540 }, geometryPolicy,
    } })).not.toHaveProperty('_pptxMeta')
  })

  it('derives deterministic property operations with inverse and impact closure', () => {
    const after = structuredClone(base)
    after.slides[0].elements[0].content = 'after'
    const options = {
      sourceMap: { entries: { 's1:e1': source } },
      baseRevisionId: 'r0',
      matrixAuthorityEpoch: 1,
    }
    const first = deriveMutationJournal(base, after, options)
    const second = deriveMutationJournal(base, after, options)
    expect(first.operations).toEqual(second.operations)
    expect(first.operations[0]).toMatchObject({
      kind: 'property-change',
      property: 'content',
      before: 'before',
      after: 'after',
      impactClosure: ['ppt/slides/slide1.xml'],
      inverse: { value: 'before' },
    })
    expect(replayJournal(canonicalEditableSnapshot(base), first).slides[0].elements[0].content)
      .toBe('after')
    expect(replayJournal(replayJournal(canonicalEditableSnapshot(base), first), first))
      .toEqual(replayJournal(canonicalEditableSnapshot(base), first))
  })

  it('supports add, delete, and stable reorder while compacting net-zero edits', () => {
    const after = structuredClone(base)
    after.slides.reverse()
    after.slides[1].elements = [{ id: 'e2', type: 'text', content: 'new' }]
    const journal = deriveMutationJournal(base, after, {
      sourceMap: { entries: { 's1:e1': source } },
      baseRevisionId: 'r0',
      matrixAuthorityEpoch: 1,
    })
    expect(journal.operations.map((operation) => operation.kind)).toEqual(
      expect.arrayContaining(['slide-reorder', 'element-delete', 'element-add'])
    )
    expect(deriveMutationJournal(base, structuredClone(base), {
      baseRevisionId: 'r0',
      matrixAuthorityEpoch: 1,
    }).operations)
      .toEqual([])
  })

  it('produces an exact matrix-bound canonical plain-text handoff without request identity in operation scope', () => {
    const canonicalBase = structuredClone(base)
    canonicalBase.slides[0].elements[0].content = '<p>before</p>'
    const after = structuredClone(canonicalBase)
    after.slides[0].elements[0].content = '<p>after</p>'
    const textTransport = {
      format: 'tiptap-json', schemaVersion: 1, document: { type: 'doc', content: [{
        type: 'paragraph', content: [{ type: 'text', text: 'after' }],
      }] },
    }
    const authoritative = {
      ...source, kind: 'text-run', packageGeneration: 1, revisionId: 'r0',
      matchMethod: 'native-id', confidence: 1, relationshipChain: ['ppt/_rels/presentation.xml.rels'],
      groupAncestry: [], occurrencePath: [0],
    }
    const journal = deriveCanonicalPlainTextJournal(canonicalBase, after, {
      sourceMap: { schemaVersion: 1, presentationId: 'deck', revisionId: 'r0', packageGeneration: 1, entries: { 's1:e1': authoritative } },
      textTransports: { 's1:e1': textTransport }, baseRevisionId: 'r0', requestIdentity: 'request-42',
      matrixAuthorityEpoch: 1,
    })
    expect(journal.featureMatrixHash).toMatch(/^[a-f0-9]{64}$/)
    expect(journal.operations).toHaveLength(1)
    expect(journal.operations[0]).toMatchObject({
      kind: 'property-change', rowId: 'primitive.text.run.plain-replacement', objectKind: 'text-run',
      slideId: 's1', elementId: 'e1', propertyId: 'text', operationId: 'replace',
      before: 'before', after: 'after', textTransport,
      sourceRef: authoritative, impactClosure: ['ppt/slides/slide1.xml'],
    })
    expect(journal.operations[0].operationId).toBe('replace')
    expect(compilePatchPlan(journal)).toMatchObject({ ok: true, level4Promoted: false })
    expect(journal.metadata.requestHash).toMatch(/^[a-f0-9]{64}$/)
    textTransport.document.content[0].content[0].text = 'mutated'
    authoritative.relationshipChain.push('mutated')
    expect(journal.operations[0].textTransport.document.content[0].content[0].text).toBe('after')
    expect(journal.operations[0].sourceRef.relationshipChain).toEqual(['ppt/_rels/presentation.xml.rels'])
    expect(journal.level4Promoted).toBe(false)
  })

  it.each([
    ['deck metadata', (after) => { after.title = 'Unsupported title' }],
    ['slide metadata', (after) => { after.slides[0].background = { type: 'color', color: '#fff' } }],
  ])('rejects %s combined with a valid text edit', (_label, mutate) => {
    const before = {
      id: 'deck',
      title: 'Original',
      slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: '<p>before</p>' }] }],
    }
    const after = structuredClone(before)
    after.slides[0].elements[0].content = '<p>after</p>'
    mutate(after)
    const authoritative = {
      ...source,
      kind: 'text-run',
      packageGeneration: 1,
      revisionId: 'r0',
      matchMethod: 'native-id',
      confidence: 1,
      relationshipChain: ['ppt/_rels/presentation.xml.rels'],
      groupAncestry: [],
      occurrencePath: [0],
    }

    expect(() => deriveCanonicalPlainTextJournal(before, after, {
      baseRevisionId: 'r0',
      sourceMap: { schemaVersion: 1, presentationId: 'deck', revisionId: 'r0', packageGeneration: 1, entries: { 's1:e1': authoritative } },
      textTransports: { 's1:e1': { format: 'tiptap-html', schemaVersion: 1, html: '<p>after</p>' } },
      matrixAuthorityEpoch: 1,
    })).toThrow(/canonical plain-text journal/i)
  })

  it('derives a canonical text operation for a vertical child slide [cap:import.pptx]', () => {
    const vertical = { id: 'deck', slides: [{ id: 'parent', elements: [], children: [{ id: 'child', elements: [{ id: 'text', type: 'text', content: '<p>before</p>' }] }] }] }
    const after = structuredClone(vertical); after.slides[0].children[0].elements[0].content = '<p>after</p>'
    const ref = { ...source, kind: 'text-run', packageGeneration: 1, revisionId: 'r0', matchMethod: 'native-id', confidence: 1, relationshipChain: ['ppt/_rels/presentation.xml.rels'], groupAncestry: [], occurrencePath: [0] }
    const journal = deriveCanonicalPlainTextJournal(vertical, after, { baseRevisionId: 'r0', sourceMap: { schemaVersion: 1, presentationId: 'deck', revisionId: 'r0', packageGeneration: 1, entries: { 'child:text': ref } }, textTransports: { 'child:text': { format: 'tiptap-html', schemaVersion: 1, html: '<p>after</p>' } }, matrixAuthorityEpoch: 1 })
    expect(journal.operations[0]).toMatchObject({ slideId: 'child', elementId: 'text', operationId: 'replace' })
  })

  it('rejects non-canonical, hostile, and incomplete plain-text inputs without executing getters', () => {
    const after = structuredClone(base)
    after.slides[0].elements[0].content = 'after'
    const hostile = Object.create(null)
    Object.defineProperty(hostile, 's1:e1', { enumerable: true, get() { throw new Error('getter ran') } })
    expect(() => deriveCanonicalPlainTextJournal(base, after, { sourceMap: { entries: hostile } })).toThrow(/canonical/i)
    expect(() => deriveCanonicalPlainTextJournal(base, after, {
      sourceMap: { entries: { 's1:e1': source } }, textTransports: { 's1:e1': 'after' },
    })).toThrow(/canonical/i)
  })

  it('rejects duplicate identities and replays nested legacy mutations safely [cap:import.pptx]', () => {
    const duplicate = structuredClone(base)
    duplicate.slides.push({ id: 's1', elements: [] })
    expect(() => deriveMutationJournal(duplicate, duplicate)).toThrow(/duplicate/i)
    const nested = structuredClone(base)
    nested.slides[0].elements = [{ id: 'group', type: 'shape', elements: [{ id: 'e1', type: 'text', content: 'before' }] }]
    const after = structuredClone(nested)
    after.slides[0].elements[0].elements[0].content = 'after'
    const journal = deriveMutationJournal(nested, after, {
      sourceMap: { entries: { 's1:e1': source } },
      matrixAuthorityEpoch: 1,
    })
    expect(replayJournal(nested, journal).slides[0].elements[0].elements[0].content).toBe('after')
  })

  it.each(['ambiguous', 'diagnostic', null])('persists projection edits without native patch authority: %s', (status) => {
    const before = canonicalEditableSnapshot(base)
    before.slides[0].elements[0].content = '<p>before</p>'
    const after = structuredClone(before)
    after.slides[0].elements[0].content = '<p>after</p>'
    const options = {
      sourceMap: { schemaVersion: 1, presentationId: 'deck', revisionId: 'r0', packageGeneration: 1,
        entries: status ? { 's1:e1': { ...source, status, revisionId: 'r0', packageGeneration: 1 } } : {} },
      baseRevisionId: 'r0', matrixAuthorityEpoch: 1,
      textTransports: { 's1:e1': { format: 'tiptap-html', schemaVersion: 1, html: '<p>after</p>' } },
    }
    const edited = deriveMutationJournal(before, after, options)
    expect(replayJournal(before, edited)).toEqual(after)
    expect(compilePatchPlan(edited).ok).toBe(false)
    expect(() => deriveCanonicalPlainTextJournal(before, after, options)).toThrow(TypeError)
    const deleted = structuredClone(after)
    deleted.slides[0].elements = []
    expect(replayJournal(after, deriveMutationJournal(after, deleted, options))).toEqual(deleted)
  })

  it('replays semantic overrides exactly without copying an unchanged multi-megabyte graph', () => {
    const before = {
      id: 'deck',
      slides: [{ id: 'slide1', elements: [{ id: 'e1', type: 'text', pptxInstanceId: 'i1', content: 'before' }] }],
      pptxSemantic: {
        schemaVersion: 1,
        definitions: {
          d1: { id: 'd1', kind: 'text', source: { partUri: 'ppt/slides/slide1.xml', nativeId: '7', preconditionHash: 'a'.repeat(64) }, components: [], content: { retained: 'x'.repeat(6 * 1024 * 1024) } },
        },
        instances: {
          i1: { id: 'i1', slideId: 'slide1', definitionId: 'd1', parentInstanceId: null, localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} },
        },
        styles: {},
        fonts: {},
      },
    }
    const after = structuredClone(before)
    after.slides[0].elements[0].content = 'after'
    after.pptxSemantic.instances.i1.overrides = { text: 'override' }

    const canonicalBefore = canonicalEditableSnapshot(before)
    const canonicalAfter = canonicalEditableSnapshot(after)
    const options = { matrixAuthorityEpoch: 1, budgets: { maxJournalBytes: 8192, maxInverseBytes: 2048 } }
    const journal = deriveMutationJournal(canonicalBefore, canonicalAfter, options)
    const replayed = replayJournal(canonicalBefore, journal)
    expect(replayed).toEqual(canonicalAfter)
    expect(replayJournal(replayed, journal)).toEqual(canonicalAfter)
    expect(deriveMutationJournal(canonicalBefore, canonicalAfter, options)).toEqual(journal)
    expect(journal.operations.find((operation) => operation.property === 'pptxSemantic')).toMatchObject({
      kind: 'property-change', targetKind: 'presentation', path: ['instances', 'i1'],
      before: canonicalBefore.pptxSemantic.instances.i1,
      after: canonicalAfter.pptxSemantic.instances.i1,
      inverse: { value: canonicalBefore.pptxSemantic.instances.i1 },
    })
    expect(() => deriveMutationJournal(canonicalBefore, canonicalAfter, {
      ...options, budgets: { maxJournalBytes: 100 },
    })).toThrow(/aggregate storage budget/i)
    expect(() => deriveMutationJournal(canonicalBefore, canonicalAfter, {
      ...options, budgets: { maxInverseBytes: 32 },
    })).toThrow(/inverse budget/i)
    const largeEdit = structuredClone(canonicalBefore)
    largeEdit.pptxSemantic.definitions.d1.content.retained = 'y'.repeat(6 * 1024 * 1024)
    expect(() => deriveMutationJournal(canonicalBefore, largeEdit, {
      matrixAuthorityEpoch: 1,
    })).toThrow(/aggregate storage budget/i)
  })
})
