import { describe, expect, it } from 'vitest'
import journalModule from './mutation-journal.js'
import plannerModule from './transactional-patch-planner.js'

const { canonicalEditableSnapshot, deriveMutationJournal, replayJournal } = journalModule
const text = (id, content = 'before') => ({ id, type: 'text', content })
const slide = (id, children = []) => ({ id, elements: [text('shared')], children })
const fixture = () => ({ id: 'deck', slides: [slide('parent', [slide('child-a', [slide('grandchild')]), slide('child-b')]), slide('other')] })
const options = { matrixAuthorityEpoch: 1 }
function roundtrip(before, after, extra = {}) {
  const left = canonicalEditableSnapshot(before)
  const right = canonicalEditableSnapshot(after)
  const journal = deriveMutationJournal(before, after, { ...options, ...extra })
  expect(replayJournal(left, journal)).toEqual(right)
  expect(replayJournal(replayJournal(left, journal), journal)).toEqual(right)
  expect(deriveMutationJournal(before, after, { ...options, ...extra })).toEqual(journal)
  expect(before).toEqual(left)
  return journal
}

describe('generic journal child slide consumer replay [cap:import.pptx]', () => {
  it('replays simultaneous parent, child and grandchild edits with per-slide provenance', () => {
    const before = fixture(); const after = structuredClone(before)
    const parent = after.slides[0]; const child = parent.children[0]
    parent.elements[0].content = 'parent after'
    child.elements[0].type = 'shape'
    child.children[0].elements = [{ id: 'group', type: 'shape', children: [text('nested', 'before')] }]
    before.slides[0].children[0].children[0].elements = structuredClone(child.children[0].elements)
    child.children[0].elements[0].children[0].content = 'nested after'
    const ref = { status: 'diagnostic', partUri: 'ppt/slides/slide2.xml', nativeId: '4', sourceHash: 'a'.repeat(64) }
    const journal = roundtrip(before, after, { sourceMap: { entries: { 'child-a:shared': ref } } })
    expect(journal.operations.find((operation) => operation.slideId === 'child-a')).toMatchObject({
      kind: 'property-change', elementId: 'shared', property: 'type', sourceRef: ref,
      impactClosure: ['ppt/slides/slide2.xml'], inverse: { value: 'text' },
    })
    expect(plannerModule.compilePatchPlan(journal, options).ok).toBe(false)
  })

  it.each([
    ['child add between siblings', (after) => after.slides[0].children.splice(1, 0, slide('new-child'))],
    ['multiple child adds in non-identity order', (after) => after.slides[0].children.splice(0, 0, slide('z-new'), slide('a-new'))],
    ['child delete including descendants', (after) => after.slides[0].children.splice(0, 1)],
    ['child sibling reorder', (after) => after.slides[0].children.reverse()],
    ['grandchild add', (after) => after.slides[0].children[0].children.push(slide('deep-new'))],
    ['grandchild delete', (after) => after.slides[0].children[0].children.splice(0, 1)],
    ['mixed child membership and reorder', (after) => { after.slides[0].children = [slide('z-new'), after.slides[0].children[1], slide('a-new')] }],
    ['child reparent to other top-level slide', (after) => { after.slides[1].children.push(after.slides[0].children.shift()) }],
    ['child reparent in reverse identity order', (after) => { after.slides[0].children.push(slide('z-child')); after.slides[1].children.push(after.slides[0].children.pop()) }],
    ['child promotion to top level', (after) => { after.slides.splice(1, 0, after.slides[0].children.shift()) }],
    ['top-level slide demotion', (after) => { after.slides[0].children.splice(1, 0, after.slides.pop()) }],
    ['reparent with simultaneous subtree edit', (after) => {
      const child = after.slides[0].children.shift(); child.elements[0].content = 'moved after'
      child.children[0].elements[0].type = 'shape'; after.slides[1].children.push(child)
    }],
  ])('replays %s exactly without authorizing native structure', (_label, mutate) => {
    const before = fixture(); const after = structuredClone(before); mutate(after)
    const journal = roundtrip(before, after)
    expect(journal.operations.length).toBeGreaterThan(0)
    expect(plannerModule.compilePatchPlan(journal, options).ok).toBe(false)
  })

  it('reparents existing child lineage when the destination sorts before its source', () => {
    const before = fixture(); before.slides[0].id = 'z-parent'; before.slides[1].id = 'a-parent'
    const after = structuredClone(before); after.slides[1].children.push(after.slides[0].children.shift())
    roundtrip(before, after)
  })

  it.each(['reorder', 'mixed membership', 'reparent'])('replays child nested element %s', (action) => {
    const before = fixture(); const child = before.slides[0].children[0]
    child.elements = [{ id: 'a-group', elements: [] }, { id: 'z-group', children: [text('one'), text('two')] }]
    const after = structuredClone(before); const groups = after.slides[0].children[0].elements
    if (action === 'reorder') groups[1].children.reverse()
    else if (action === 'mixed membership') groups[1].children = [text('z-new'), groups[1].children[1], text('a-new')]
    else { groups[0].elements.push(groups[1].children.shift()); groups[0].elements[0].type = 'shape' }
    roundtrip(before, after)
  })

  it('replays child edits from a recorded v1 property operation without new addressing fields', () => {
    const before = fixture(); const after = structuredClone(before)
    after.slides[0].children[0].elements[0].content = 'recorded after'
    const journal = { schemaVersion: 1, operations: [{ kind: 'property-change', slideId: 'child-a', elementId: 'shared', property: 'content', before: 'before', after: 'recorded after' }] }
    expect(replayJournal(before, journal)).toEqual(after)
  })

  it('preserves legacy top-level add/delete/reorder replay', () => {
    const before = { id: 'deck', slides: [{ id: 'first', elements: [] }, { id: 'deleted', elements: [] }] }
    const after = { id: 'deck', slides: [{ id: 'added', elements: [] }, before.slides[0]] }
    const journal = { schemaVersion: 1, operations: [
      { kind: 'slide-delete', slideId: 'deleted' },
      { kind: 'slide-add', slideId: 'added', after: after.slides[0] },
      { kind: 'slide-reorder', targetId: 'deck', before: ['first', 'added'], after: ['added', 'first'] },
    ] }
    expect(replayJournal(before, journal)).toEqual(after)
  })
})
