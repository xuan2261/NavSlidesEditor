import { describe, expect, it } from 'vitest'
import journalModule from './mutation-journal.js'

const { canonicalEditableSnapshot, deriveMutationJournal, replayJournal } = journalModule
const text = (id) => ({ id, type: 'text', content: 'before' })
const fixture = () => ({ id: 'deck', slides: [
  { id: 'parent', elements: [text('shared')], children: [
    { id: 'child', elements: [text('shared')], children: [{ id: 'grandchild', elements: [] }] },
  ] },
] })

describe('generic journal child identity safety [cap:import.pptx]', () => {
  it.each([
    ['root-child collision', (snapshot) => { snapshot.slides[0].children[0].id = 'parent' }],
    ['child-grandchild collision', (snapshot) => { snapshot.slides[0].children[0].children[0].id = 'child' }],
    ['separate branches collision', (snapshot) => { snapshot.slides.push({ id: 'other', elements: [], children: [{ id: 'child', elements: [] }] }) }],
    ['duplicate child element', (snapshot) => { snapshot.slides[0].children[0].elements.push(text('shared')) }],
    ['nested duplicate child element', (snapshot) => { snapshot.slides[0].children[0].elements.push({ id: 'group', elements: [text('shared')] }) }],
  ])('rejects %s before deriving or replaying ambiguous targets', (_label, corrupt) => {
    const snapshot = fixture(); corrupt(snapshot)
    expect(() => deriveMutationJournal(snapshot, snapshot)).toThrow(/duplicate/i)
    expect(() => replayJournal(snapshot, { schemaVersion: 1, operations: [] })).toThrow(/invalid generic journal/i)
  })

  it.each([
    ['non-array child slides', (snapshot) => { snapshot.slides[0].children = {} }],
    ['child missing identity', (snapshot) => { delete snapshot.slides[0].children[0].id }],
    ['empty child identity', (snapshot) => { snapshot.slides[0].children[0].id = '' }],
    ['non-array child elements', (snapshot) => { snapshot.slides[0].children[0].elements = {} }],
  ])('rejects %s at the consumer boundary', (_label, corrupt) => {
    const snapshot = fixture(); corrupt(snapshot)
    expect(() => deriveMutationJournal(snapshot, snapshot)).toThrow(/invalid generic journal/i)
    expect(() => replayJournal(snapshot, { schemaVersion: 1, operations: [] })).toThrow(/invalid generic journal/i)
  })

  it('allows reused element identities in distinct child slides without editing the parent target', () => {
    const before = fixture(); const after = structuredClone(before)
    after.slides[0].children[0].elements[0].content = 'child after'
    const journal = deriveMutationJournal(before, after)
    expect(replayJournal(canonicalEditableSnapshot(before), journal)).toEqual(canonicalEditableSnapshot(after))
    expect(journal.operations).toHaveLength(1)
    expect(journal.operations[0]).toMatchObject({ slideId: 'child', elementId: 'shared' })
  })

  it('counts child mutations against the operation and inverse/storage budgets', () => {
    const before = fixture(); const after = structuredClone(before)
    after.slides[0].children[0].elements[0].content = 'first after'
    after.slides[0].children[0].elements[0].type = 'shape'
    expect(() => deriveMutationJournal(before, after, { budgets: { maxJournalOperations: 1 } })).toThrow(/operation budget/i)
    expect(() => deriveMutationJournal(before, after, { budgets: { maxJournalBytes: 1 } })).toThrow(/storage budget/i)
    expect(() => deriveMutationJournal(before, after, { budgets: { maxInverseBytes: 1 } })).toThrow(/inverse budget/i)
  })

  it('counts vertical child slides against the existing slide budget', () => {
    const snapshot = fixture()
    expect(() => deriveMutationJournal(snapshot, snapshot, { budgets: { maxSlides: 2 } })).toThrow(/slide budget/i)
  })

  it('rejects child trees beyond snapshot depth bounds rather than silently omitting edits', () => {
    const before = fixture(); const after = structuredClone(before)
    after.slides[0].children[0].elements[0].type = 'shape'
    expect(() => deriveMutationJournal(before, after, { budgets: { maxDepth: 3 } })).toThrow(/invalid generic journal/i)
    const deep = { id: 'deep', slides: [] }; let items = deep.slides
    for (let index = 0; index < 20; index += 1) {
      const child = { id: `s-${index}`, elements: [], children: [] }; items.push(child); items = child.children
    }
    expect(() => replayJournal(deep, { schemaVersion: 1, operations: [] })).toThrow(/invalid generic journal/i)
  })
})
