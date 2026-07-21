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

  it('blocks ambiguous source claims', () => {
    const after = structuredClone(base)
    after.slides[0].elements[0].content = 'after'
    expect(() => deriveMutationJournal(base, after, {
      sourceMap: { entries: { 's1:e1': { ...source, status: 'ambiguous' } } },
      baseRevisionId: 'r0',
    })).toThrow(/not authoritative/i)
  })
})
