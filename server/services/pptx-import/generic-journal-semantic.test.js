import { describe, expect, it } from 'vitest'
import journalModule from './mutation-journal.js'
import portableModule from './package-store/portable-authority.js'
import mediaModule from '../project-import-presentation.js'
import schemaModule from './package-store/schemas.js'
import graphModule from '../../../shared/src/pptx-semantic-source-graph.js'
import plannerModule from './transactional-patch-planner.js'

const { canonicalEditableSnapshot, deriveMutationJournal, replayJournal } = journalModule
const { journalMediaProjections, rebindAuthorityResult } = portableModule
const { collectMediaUrls, rewritePresentationMedia } = mediaModule
const { hashRecord } = schemaModule
const options = { matrixAuthorityEpoch: 1 }
const fixture = () => ({ id: 'deck', slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text', content: 'before', pptxInstanceId: 'i1' }] }],
  pptxSemantic: { schemaVersion: 1, definitions: { d1: { id: 'd1', kind: 'text',
    source: { partUri: 'ppt/slides/slide1.xml', nativeId: '7', preconditionHash: 'a'.repeat(64) }, components: [], content: {} } },
  instances: { i1: { id: 'i1', slideId: 's1', definitionId: 'd1', parentInstanceId: null,
    localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } }, styles: {}, fonts: {} } })
const inverseJournal = (journal) => ({ ...journal, operations: [...journal.operations].reverse().map((operation) => ({
  ...operation, before: operation.after, after: operation.inverse.value, inverse: { value: operation.after },
})) })

describe('semantic property journal consumer contract [cap:import.pptx]', () => {
  it('replays record membership, definitions, catalogs and inverse values exactly after JSON transport', () => {
    const before = canonicalEditableSnapshot(fixture())
    const after = structuredClone(before)
    after.pptxSemantic.definitions.d1.content.authored = 'retained source change'
    after.pptxSemantic.instances.i1.overrides.hidden = true
    after.pptxSemantic.fonts.body = { family: 'Arial' }
    const journal = deriveMutationJournal(before, after, options)
    expect(plannerModule.compilePatchPlan(journal, options).ok).toBe(false)
    expect(journal.operations.map((operation) => operation.path)).toEqual([
      ['definitions', 'd1'], ['fonts', 'body'], ['instances', 'i1'],
    ])
    expect(replayJournal(before, JSON.parse(JSON.stringify(journal)))).toEqual(after)
    expect(replayJournal(after, inverseJournal(journal))).toEqual(before)
    expect(replayJournal(before, inverseJournal(journal))).toEqual(before)
    expect(replayJournal(after, journal)).toEqual(after)
    const deletion = deriveMutationJournal(after, before, options)
    expect(replayJournal(after, deletion)).toEqual(before)
    expect(replayJournal(before, inverseJournal(deletion))).toEqual(after)
    expect(() => deriveMutationJournal(before, after, { ...options, budgets: { maxJournalOperations: 2 } })).toThrow(/operation budget/i)
  })
  it('replays schema3 wire records and catalogs with deterministic hashes and inverse preconditions', () => {
    const input = fixture()
    input.pptxSemantic = graphModule.compactSemanticGraph(input.pptxSemantic)
    const before = canonicalEditableSnapshot(input)
    const after = structuredClone(before)
    const instanceId = Object.keys(after.pptxSemantic.instances)[0]
    after.pptxSemantic.instances[instanceId].overrides.hidden = true
    after.pptxSemantic.partUris.push('ppt/slides/unused.xml')
    const journal = deriveMutationJournal(before, after, options)
    expect(journal.operations.map((operation) => operation.path)).toEqual([
      ['instances', instanceId], ['partUris'],
    ])
    expect(replayJournal(before, JSON.parse(JSON.stringify(journal)))).toEqual(after)
    expect(replayJournal(after, inverseJournal(journal))).toEqual(before)
    expect(replayJournal(after, journal)).toEqual(after)
    const reordered = { ...after, pptxSemantic: Object.fromEntries(Object.entries(after.pptxSemantic).reverse()) }
    expect(deriveMutationJournal(before, reordered, options)).toEqual(journal)
  })

  it('replays definition and instance additions and deletions together with their projected leaf', () => {
    const before = canonicalEditableSnapshot(fixture()); const after = structuredClone(before)
    const definition = structuredClone(after.pptxSemantic.definitions.d1)
    after.pptxSemantic.definitions.d2 = { ...definition, id: 'd2', source: { ...definition.source, nativeId: '8' } }
    after.pptxSemantic.instances.i2 = { ...structuredClone(after.pptxSemantic.instances.i1), id: 'i2', definitionId: 'd2', paintIndex: 1 }
    after.slides[0].elements.push({ id: 'e2', type: 'text', content: 'new', pptxInstanceId: 'i2' })
    for (const [left, right] of [[before, after], [after, before]]) {
      const journal = deriveMutationJournal(left, right, options)
      expect(replayJournal(left, journal)).toEqual(right)
      expect(replayJournal(right, journal)).toEqual(right)
    }
  })

  it('retains root semantic addition and removal and legacy whole-property replay', () => {
    const after = canonicalEditableSnapshot(fixture())
    const before = structuredClone(after)
    delete before.pptxSemantic
    delete before.slides[0].elements[0].pptxInstanceId
    for (const [left, right] of [[before, after], [after, before]]) {
      const journal = deriveMutationJournal(left, right, options)
      expect(replayJournal(left, journal)).toEqual(right)
      expect(replayJournal(right, journal)).toEqual(right)
    }
    const legacyAfter = structuredClone(after)
    legacyAfter.pptxSemantic.instances.i1.overrides.hidden = true
    expect(replayJournal(after, { operations: [{ kind: 'property-change', targetKind: 'presentation',
      property: 'pptxSemantic', before: after.pptxSemantic, after: legacyAfter.pptxSemantic }] })).toEqual(legacyAfter)
  })

  it('does not overwrite a divergent semantic record or walk an absent/inherited owner', () => {
    const before = canonicalEditableSnapshot(fixture()); const after = structuredClone(before)
    after.pptxSemantic.instances.i1.overrides.hidden = true
    const journal = deriveMutationJournal(before, after, options)
    const divergent = structuredClone(before)
    divergent.pptxSemantic.instances.i1.overrides.locked = true
    expect(replayJournal(divergent, journal)).toEqual(divergent)
    const unrelated = { id: 'deck', slides: [] }
    expect(replayJournal(unrelated, journal)).toEqual(unrelated)
  })

  it.each([
    [], ['instances', 'i1', 'overrides'], ['instances', '__proto__'], ['constructor'],
    ['prototype'], ['definitions', 'constructor'], ['not-a-dictionary', 'id'], ['instances', 1],
  ])('rejects unsafe or unbounded semantic addresses: %j', (path) => {
    expect(() => replayJournal(fixture(), { operations: [{ kind: 'property-change', targetKind: 'presentation',
      property: 'pptxSemantic', path, before: null, after: {} }] })).toThrow(/invalid generic journal/i)
  })

  it('rejects path and nested payload accessors without executing them', () => {
    const operation = { kind: 'property-change', targetKind: 'presentation', property: 'pptxSemantic', path: ['instances', 'i1'], before: null, after: {} }
    const getter = () => { throw new Error('getter executed') }
    const accessor = { ...operation }
    Object.defineProperty(accessor, 'path', { get: getter })
    expect(() => replayJournal(fixture(), { operations: [accessor] })).toThrow(/invalid generic journal/i)
    const path = ['instances', 'i1']
    Object.defineProperty(path, '1', { get: getter })
    expect(() => replayJournal(fixture(), { operations: [{ ...operation, path }] })).toThrow(/invalid generic journal/i)
    const payload = {}
    Object.defineProperty(payload, 'hidden', { enumerable: true, get: getter })
    expect(() => replayJournal(fixture(), { operations: [{ ...operation, after: payload }] })).toThrow(/invalid record field/i)
  })

  it('inventories and rebinds semantic media before/after/inverse without changing source identity or text', () => {
    const before = fixture()
    before.slides[0].elements[0].type = 'image'
    before.slides[0].elements[0].src = '/uploads/old.png'
    before.pptxSemantic.definitions.d1.kind = 'image'
    before.pptxSemantic.definitions.d1.content.media = { src: '/uploads/old.png', partUri: 'ppt/media/source.png', relationshipId: 'rId1' }
    before.pptxSemantic.definitions.d1.content.caption = '/uploads/old.png'
    const after = structuredClone(before)
    after.slides[0].elements[0].src = '/uploads/new.png'
    after.pptxSemantic.definitions.d1.content.media.src = '/uploads/new.png'
    const journal = deriveMutationJournal(before, after, { ...options, baseRevisionId: 'r0' })
    const urls = journalMediaProjections(journal, after).flatMap(collectMediaUrls)
    expect(urls).toContain('/uploads/old.png')
    expect(urls).toContain('/uploads/new.png')
    const result = { presentationId: 'deck', generation: 2, packageRevisionId: 'r0', projection: after,
      sourceMap: { schemaVersion: 1, presentationId: 'deck', revisionId: 'r0', packageGeneration: 2, entries: {} },
      journal, operationIds: journal.operations.map((operation) => operation.operationId) }
    const mediaUrlMap = { '/uploads/old.png': '/uploads/destination-old.png', '/uploads/new.png': '/uploads/destination-new.png' }
    const rebound = rebindAuthorityResult(result, { presentationId: 'destination', matrixAuthorityEpoch: 1 }, (generation) => generation, mediaUrlMap)
    const expectedBefore = rewritePresentationMedia(before, mediaUrlMap, 'destination')
    expect(replayJournal(expectedBefore, rebound.journal)).toEqual(rebound.projection)
    expect(replayJournal(rebound.projection, inverseJournal(rebound.journal))).toEqual(expectedBefore)
    const semantic = rebound.journal.operations.find((operation) => operation.path)
    expect(semantic.before.content.media.src).toBe('/uploads/destination-old.png')
    expect(semantic.after.content.media.src).toBe('/uploads/destination-new.png')
    expect(semantic.inverse.value.content.media.src).toBe('/uploads/destination-old.png')
    expect(semantic.after.content.caption).toBe('/uploads/old.png')
    expect(semantic.after.source).toEqual(before.pptxSemantic.definitions.d1.source)
    expect(semantic.operationId).toBe(`op-${hashRecord(Object.fromEntries(Object.entries(semantic).filter(([key]) => !['schemaVersion', 'operationId'].includes(key)))).slice(0, 24)}`)
    expect(rebound.journal).toEqual(deriveMutationJournal(expectedBefore, rebound.projection, { ...options, baseRevisionId: 'r0' }))
  })
})
