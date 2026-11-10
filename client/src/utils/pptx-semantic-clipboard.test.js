import { describe, expect, it } from 'vitest'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import groups from 'revealjs-shared/src/pptx-semantic-groups.js'
import styles from 'revealjs-shared/src/pptx-geometry-style-resolution.js'
import render from 'revealjs-shared/src/pptx-semantic-render-tree.js'
import { geometryGroupFillFixture } from '../../../tests/pptx-semantic/geometry-group-fill-fixture.js'
import { geometryProjectionFixture } from '../../../tests/pptx-semantic/geometry-projection-fixture.js'
import { linkedConnectorFixture } from '../../../tests/pptx-semantic/geometry-style-connector-fixture.js'
import { createSemanticClipboard, pasteSemanticClipboard } from './pptx-semantic-clipboard.js'
import { semanticInstance, semanticInstances } from 'revealjs-shared/src/pptx-semantic-records.js'

const fixture = () => semantic.normalizeSemanticPresentation({ ...geometryGroupFillFixture(), id: 'deck' })
const copy = (presentation, ids = ['g1'], effectiveElements) => createSemanticClipboard({
  presentation, slide: presentation.slides[0], selectedElementIds: ids, effectiveElements,
})
const paste = (presentation, clipboard = copy(presentation), slideId = 's1', pasteIndex = 0) =>
  pasteSemanticClipboard({ presentation, clipboard, slideId, pasteIndex })
const child = (document, root) => Array.from(semanticInstances(document), ([, i]) => i).find(i => i.parentInstanceId === root)

describe('source-bound semantic clipboard', () => {
  it.each(['s1', 's2'])('copies the full red group to %s without adopting the green owner', slideId => {
    const before = fixture(), snapshot = structuredClone(before), clipboard = copy(before, ['g1', 'i1'])
    expect(clipboard).toMatchObject({ kind: 'pptx-semantic-selection', version: 1,
      source: { presentationId: 'deck', slideId: 's1' }, rootInstanceIds: ['g1'] })
    expect(clipboard.elements.map(e => e.id)).toEqual(['i1'])
    const result = paste(before, JSON.parse(JSON.stringify(clipboard)), slideId)
    const document = result.presentation.pptxSemantic, root = semanticInstance(document, result.selectedIds[0])
    const leaf = child(document, root.id)
    expect(root.definitionId).toBe('group')
    expect(root.sourceBinding).toEqual(before.pptxSemantic.instances.g1.sourceBinding)
    expect(root.relationshipChain).toEqual(before.pptxSemantic.instances.g1.relationshipChain)
    expect(leaf.localTransform).toEqual(before.pptxSemantic.instances.i1.localTransform)
    expect(styles.materializeGeometry(document, leaf.id).style.fill.color.value).toBe('FF0000')
    expect(styles.materializeGeometry(document, 'i2').style.fill.color.value).toBe('00FF00')
    expect(styles.geometryFillFrame(document, leaf.id).ownerInstanceId).toBe(root.id)
    expect(document.definitions).toEqual(before.pptxSemantic.definitions)
    expect(document.styles).toEqual(before.pptxSemantic.styles)
    const added = result.presentation.slides.find(s => s.id === slideId).elements.at(-1)
    expect(added.pptxInstanceId).toBe(leaf.id)
    expect(added.id).not.toBe('i1')
    expect(Array.from(semanticInstances(document))).toHaveLength(6)
    expect(semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(result.presentation))))
      .toEqual(result.presentation)
    expect(before).toEqual(snapshot)
  })

  it('displaces nested rotated, flipped, nonuniform roots once per cascade', () => {
    const before = structuredClone(fixture()), d = before.pptxSemantic
    d.definitions.outer = { id: 'outer', origin: 'project', kind: 'group', source: null, components: [], content: {} }
    d.instances.outer = { id: 'outer', definitionId: 'outer', slideId: 's1', parentInstanceId: null,
      localTransform: [0, -2, -3, 0, 400, 900], paintIndex: 0, overrides: {} }
    d.instances.g1.parentInstanceId = 'outer'
    const clipboard = copy(before), world = groups.instanceWorldTransform(d, 'g1')
    for (const cascade of [0, 1]) {
      const result = paste(before, clipboard, 's1', cascade), next = result.presentation.pptxSemantic
      const root = semanticInstance(next, result.selectedIds[0]), actual = groups.instanceWorldTransform(next, root.id)
      expect(root.parentInstanceId).toBe('outer')
      expect(actual.slice(0, 4)).toEqual(world.slice(0, 4))
      expect((actual[4] - world[4]) * render.EMU_TO_CSS).toBeCloseTo(20 * (cascade + 1))
      expect((actual[5] - world[5]) * render.EMU_TO_CSS).toBeCloseTo(20 * (cascade + 1))
      expect(child(next, root.id).localTransform).toEqual(d.instances.i1.localTransform)
    }
    before.pptxSemantic.instances.outer.localTransform[4]++
    expect(() => paste(before, clipboard)).toThrow(/context.*changed/i)
    expect(() => paste(before, clipboard, 's2')).toThrow(/external.*ancestor/i)
  })

  it('retains hidden and paint-only scopes, sparse overrides, and remaps internal lineage', () => {
    const before = structuredClone(fixture()), d = before.pptxSemantic
    d.instances.scope = { ...structuredClone(d.instances.g1), id: 'scope', parentInstanceId: 'g1',
      lineage: { paintOnly: true }, overrides: { hidden: true } }
    d.instances.i1.parentInstanceId = 'scope'
    d.instances.i1.lineage = { ungroupedFrom: 'scope', ungroupHidden: { groupId: 'scope', hadOverride: false, hidden: false } }
    d.instances.g1.lineage = { ungroupedFrom: 'external-history' }
    const result = paste(before), next = result.presentation.pptxSemantic
    const root = semanticInstance(next, result.selectedIds[0]), scope = child(next, root.id), leaf = child(next, scope.id)
    expect(scope.lineage.paintOnly).toBe(true)
    expect(scope.overrides).toEqual({ hidden: true })
    expect(leaf.lineage.ungroupedFrom).toBe(scope.id)
    expect(leaf.lineage.ungroupHidden.groupId).toBe(scope.id)
    expect(root.lineage.ungroupedFrom).toBeUndefined()
  })

  it('captures effective actions and remaps mixed legacy and semantic references together', () => {
    const before = structuredClone(fixture())
    before.slides[0].elements.push({ id: 'answer', type: 'text', x: 10, y: 20, groupId: 'legacy-group' })
    const effective = [{ id: 'i1', action: { kind: 'show', targetElementId: 'answer' } }]
    const result = paste(before, copy(before, ['g1', 'answer'], effective))
    const added = result.presentation.slides[0].elements.slice(-2)
    expect(added[0].action.targetElementId).toBe(added[1].id)
    expect(added[1]).toMatchObject({ x: 30, y: 40 })
    expect(added[1].groupId).toBeUndefined()
    expect(result.selectedIds).toEqual([expect.any(String), added[1].id])
  })

  it('copies snapshot overrides after original edits and deletion without importing source records', () => {
    const before = structuredClone(fixture()), clipboard = copy(before)
    before.pptxSemantic.instances.g1.overrides.hidden = true
    before.pptxSemantic.instances.g1.lineage = { tombstone: true }
    before.pptxSemantic.instances.i1.lineage = { tombstone: true }
    before.slides[0].elements = []
    const result = paste(before, clipboard)
    expect(semanticInstance(result.presentation.pptxSemantic, result.selectedIds[0]).overrides).toEqual({})
  })

  it.each(['deck', 'styles', 'definitions', 'leaves', 'roots', 'binding', 'placement', 'locked', 'unsupported'])(
    'rejects %s changes atomically', alteration => {
      const before = structuredClone(fixture()), clipboard = structuredClone(copy(before))
      if (alteration === 'deck') before.id = 'another'
      if (alteration === 'styles') clipboard.document.styles.groupProvider.payload.properties = {}
      if (alteration === 'definitions') clipboard.document.definitions.group.content.extent.cx++
      if (alteration === 'leaves') clipboard.elements = []
      if (alteration === 'roots') clipboard.rootInstanceIds = ['g2']
      if (alteration === 'binding') clipboard.document.instances.g1.sourceBinding.contextId = 'groupContext2'
      if (alteration === 'placement') {
        clipboard.document.instances.g1.sourceBinding = clipboard.document.instances.g2.sourceBinding
        clipboard.document.instances.g1.relationshipChain = clipboard.document.instances.g2.relationshipChain
      }
      if (alteration === 'locked') before.slides[0].locked = true
      if (alteration === 'unsupported') {
        delete clipboard.document.instances.g1.sourceBinding
        delete clipboard.document.instances.g1.relationshipChain
      }
      const untouched = structuredClone(before)
      expect(() => paste(before, clipboard)).toThrow()
      expect(before).toEqual(untouched)
    }
  )

  it('supports schema one and vertical slide destinations; Copy preserves locks', () => {
    const before = { ...geometryProjectionFixture(), id: 'deck' }
    before.slides[0].locked = true
    const clipboard = copy(before, ['i1'])
    before.slides = [{ ...before.slides[0], locked: false, children: [before.slides[1]] }]
    const result = paste(before, clipboard, 's2')
    expect(result.presentation.slides[0].children[0].elements).toHaveLength(2)
    expect(result.selectedIds).toEqual([result.presentation.slides[0].children[0].elements[1].id])
  })

  it('returns null for legacy-only selection and rejects stale semantic selection', () => {
    const before = fixture()
    expect(copy(before, [])).toBeNull()
    before.slides[0].elements.push({ id: 'legacy', type: 'text' })
    expect(copy(before, ['legacy'])).toBeNull()
    expect(() => copy(before, ['g1', 'missing'])).toThrow(/selection/i)
    expect(() => copy(before, ['g2'])).toThrow(/selection/i)
  })

  it.each([true, false])('remaps internal or retains owned external connector targets (%s)', internal => {
    const before = { ...geometryProjectionFixture(), id: 'deck', pptxSemantic: linkedConnectorFixture() }
    before.slides[0].elements.push({ id: 'connector-dto', pptxInstanceId: 'connector', type: 'shape' })
    const clipboard = copy(before, internal ? ['i1', 'connector-dto'] : ['connector-dto'])
    const result = paste(before, clipboard), next = result.presentation.pptxSemantic
    const added = result.presentation.slides[0].elements.slice(internal ? -2 : -1)
    const connector = semanticInstance(next, added.at(-1).pptxInstanceId)
    expect(connector.connectorBindings.start.targetInstanceId).toBe(internal ? added[0].pptxInstanceId : 'i1')
    expect(next.definitions).toEqual(before.pptxSemantic.definitions)
    if (!internal) {
      expect(() => paste(before, clipboard, 's2')).toThrow(/external.connector/i)
      const stale = structuredClone(before)
      stale.pptxSemantic.instances.i1.localTransform[4]++
      expect(() => paste(stale, clipboard)).not.toThrow()
      stale.pptxSemantic.instances.i1.sourceBinding = stale.pptxSemantic.instances.i2.sourceBinding
      expect(() => paste(stale, clipboard)).toThrow()
    }
  })

  it('retains sparse group gradient overrides and each descendant fill frame', () => {
    const before = structuredClone(fixture()), d = before.pptxSemantic
    d.instances.g1.overrides = { components: { 'group:group-properties': { geometryStyle: { fill: {
      gradient: { kind: 'linear', angle: 0, scaled: true, rotWithShape: true, stops: [
        { pos: 0, color: { kind: 'srgb', value: 'FF0000' } },
        { pos: 100000, color: { kind: 'srgb', value: '0000FF' } },
      ] },
    } } } } }
    d.instances.other = { ...structuredClone(d.instances.i1), id: 'other', paintIndex: 2,
      localTransform: [1, 0, 0, 1, 1000, 0] }
    before.slides[0].elements.push({ ...before.slides[0].elements[0], id: 'other', pptxInstanceId: 'other' })
    const partial = copy(before, ['i1']), changed = structuredClone(before)
    changed.pptxSemantic.instances.other.localTransform[4]++
    expect(() => paste(changed, partial)).toThrow(/context.*changed/i)
    const result = paste(before, copy(before), 's2'), next = result.presentation.pptxSemantic
    const root = semanticInstance(next, result.selectedIds[0])
    expect(root.overrides).toEqual(d.instances.g1.overrides)
    const leaves = Array.from(semanticInstances(next), ([, i]) => i).filter(i => i.parentInstanceId === root.id)
    expect(leaves).toHaveLength(2)
    for (const leaf of leaves) {
      expect(styles.geometryFillFrame(next, leaf.id).ownerInstanceId).toBe(root.id)
      expect(styles.materializeGeometry(next, leaf.id).style.fill.gradient.stops).toHaveLength(2)
    }
  })

  it('appends roots in source paint order, not dictionary order', () => {
    const before = structuredClone(fixture()), d = before.pptxSemantic
    d.instances.later = { ...structuredClone(d.instances.g1), id: 'later', paintIndex: 1 }
    d.instances.g1.paintIndex = 8
    const result = paste(before, copy(before, ['g1', 'later'])), next = result.presentation.pptxSemantic
    expect(semanticInstance(next, result.selectedIds[0]).paintIndex).toBeLessThan(semanticInstance(next, result.selectedIds[1]).paintIndex)
  })
})
