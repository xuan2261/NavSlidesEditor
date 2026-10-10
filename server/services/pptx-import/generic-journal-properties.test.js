import { describe, expect, it } from 'vitest'
import journalModule from './mutation-journal.js'
import plannerModule from './transactional-patch-planner.js'

const { canonicalEditableSnapshot, deriveMutationJournal, replayJournal } = journalModule
const fixture = () => ({
  id: 'deck', title: 'Before', theme: 'light', designTokens: { color: '#111' },
  slides: [{ id: 'parent', notes: 'parent notes', background: { color: '#fff' }, elements: [
    { id: 'text', type: 'text', content: 'before', fill: '#000' },
  ], children: [{ id: 'child', notes: 'child notes', layout: 'wide', elements: [] }] }],
})
function exact(before, after) {
  const journal = deriveMutationJournal(before, after, { matrixAuthorityEpoch: 1 })
  const result = replayJournal(canonicalEditableSnapshot(before), journal)
  expect(result).toEqual(canonicalEditableSnapshot(after))
  expect(replayJournal(result, journal)).toEqual(result)
  expect(plannerModule.compilePatchPlan(journal, { matrixAuthorityEpoch: 1 }).ok).toBe(false)
  return journal
}

describe('generic journal canonical property consumer contract [cap:import.pptx]', () => {
  it.each([
    ['presentation title', (after) => { after.title = 'After' }],
    ['presentation theme', (after) => { after.theme = 'dark' }],
    ['presentation nested design tokens', (after) => { after.designTokens.color = '#eee' }],
    ['presentation property addition', (after) => { after.custom = { nested: ['captured'] } }],
    ['presentation property deletion', (after) => { delete after.designTokens }],
    ['parent slide notes', (after) => { after.slides[0].notes = 'new parent notes' }],
    ['parent slide background', (after) => { after.slides[0].background.color = '#123' }],
    ['child slide notes', (after) => { after.slides[0].children[0].notes = 'new child notes' }],
    ['child slide layout', (after) => { after.slides[0].children[0].layout = 'portrait' }],
    ['slide property addition', (after) => { after.slides[0].transition = { type: 'fade' } }],
    ['slide property deletion', (after) => { delete after.slides[0].background }],
    ['element property addition', (after) => { after.slides[0].elements[0].custom = null }],
    ['element property deletion', (after) => { delete after.slides[0].elements[0].fill }],
  ])('replays %s without omitting captured canonical state', (_label, mutate) => {
    const before = fixture(); const after = structuredClone(before); mutate(after)
    expect(exact(before, after).operations).toHaveLength(1)
  })

  it('discriminates root, slide and element targets sharing a property name and identity', () => {
    const before = fixture(); before.id = 'parent'; before.slides[0].elements[0].id = 'parent'
    before.content = 'root before'; before.slides[0].content = 'slide before'
    const after = structuredClone(before); after.content = 'root after'
    after.slides[0].content = 'slide after'; after.slides[0].elements[0].content = 'element after'
    expect(exact(before, after).operations).toHaveLength(3)
  })

  it.each([
    ['optional empty child collection addition', (after) => { after.slides[0].children[0].children = [] }],
    ['optional empty child collection deletion', (after) => { delete after.slides[0].children[0].children }],
    ['child creation under a slide without children', (after) => { after.slides[0].children[0].children = [{ id: 'new', elements: [] }] }],
    ['last child deletion removes collection', (after) => { delete after.slides[0].children }],
  ])('replays %s with exact collection presence', (label, mutate) => {
    const before = fixture()
    if (label === 'optional empty child collection deletion') before.slides[0].children[0].children = []
    const after = structuredClone(before); mutate(after); exact(before, after)
  })

  it('replays nested element collection changes and preserves unrelated passthrough state', () => {
    const before = fixture()
    before.slides[0].children[0].elements = [{ id: 'group', type: 'shape', elements: [{ id: 'nested', type: 'text', content: 'before' }], pluginData: { children: 'opaque data' } }]
    const after = structuredClone(before); const group = after.slides[0].children[0].elements[0]
    group.children = group.elements; delete group.elements; group.children[0].content = 'after'
    exact(before, after)
  })

  it('preserves captured own properties without interpreting prototype member names', () => {
    const before = fixture(); const after = structuredClone(before)
    Object.defineProperty(after, '__proto__', { value: { custom: true }, enumerable: true })
    after.slides[0].constructor = { custom: 'slide' }
    after.slides[0].elements[0].toString = 'custom element'
    exact(before, after)
  })
})
