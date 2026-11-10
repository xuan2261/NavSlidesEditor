import { describe, expect, it } from 'vitest'
import groups from '../../shared/src/pptx-semantic-groups.js'
import affine from '../../shared/src/pptx-affine.js'
import graph from '../../shared/src/pptx-semantic-source-graph.js'
import records from '../../shared/src/pptx-semantic-records.js'

function fixture() {
  const source = (nativeId) => ({
    partUri: 'ppt/slideMasters/slideMaster1.xml',
    nativeId,
    preconditionHash: 'a'.repeat(64),
  })
  const instance = (id, slideId, definitionId, parentInstanceId, localTransform, paintIndex) => ({
    id,
    slideId,
    definitionId,
    parentInstanceId,
    localTransform,
    paintIndex,
    overrides: {},
  })
  return {
    schemaVersion: 1,
    styles: {},
    fonts: {},
    definitions: {
      g: { id: 'g', kind: 'group', source: source('2'), components: [], content: {} },
      leaf: { id: 'leaf', kind: 'shape', source: source('3'), components: [], content: {} },
    },
    instances: {
      g1: instance('g1', 's1', 'g', null, [2, 0, 1, 3, 100, 200], 0),
      l1: instance('l1', 's1', 'leaf', 'g1', [0, 1, -1, 0, 5, 6], 1),
      g2: instance('g2', 's2', 'g', null, [1, 0, 0, 1, 0, 0], 0),
      l2: instance('l2', 's2', 'leaf', 'g2', [1, 0, 0, 1, 0, 0], 1),
    },
  }
}

describe('semantic hierarchy geometry commands', () => {
  it('ungroups composite opacity into a non-authoring paint container and regroups without changing child coordinates', () => {
    const input = fixture()
    input.definitions.g.content.opacity = 0.5
    const before = groups.instanceWorldTransform(input, 'l1')
    const result = groups.ungroupSemanticInstance(input, 'g1')
    expect(result.instances.g1.lineage.paintOnly).toBe(true)
    expect(result.instances.g1.lineage.tombstone).not.toBe(true)
    expect(result.instances.l1.parentInstanceId).toBe('g1')
    expect(result.instances.l1.localTransform).toEqual(input.instances.l1.localTransform)
    expect(groups.instanceWorldTransform(result, 'l1')).toEqual(before)
    expect(() => groups.moveSemanticInstance(result, 'g1', { x: 1, y: 2 })).toThrow(/paint/i)
    expect(() => groups.regroupSemanticInstance(result, 'g1', ['l2'])).toThrow()
    const regrouped = groups.regroupSemanticInstance(result, 'g1', ['l1'])
    expect(regrouped.instances.g1.lineage.paintOnly).toBe(false)
    expect(groups.instanceWorldTransform(regrouped, 'l1')).toEqual(before)
    expect(regrouped.definitions).toEqual(input.definitions)
    expect(regrouped.instances.g2).toEqual(input.instances.g2)
  })
  it('composes right-first ancestry and keeps shared definitions/other occurrences unchanged', () => {
    const input = fixture()
    expect(groups.instanceWorldTransform(input, 'l1')).toEqual([1, 3, -2, 0, 116, 218])
    const moved = groups.moveSemanticInstance(input, 'l1', { x: 20, y: 30 })
    expect(moved.instances.l1.localTransform).toEqual([0, 1, -1, 0, 10, 16])
    expect(moved.instances.l2).toEqual(input.instances.l2)
    expect(moved.definitions).toEqual(input.definitions)
    expect(input.instances.l1.localTransform).toEqual([0, 1, -1, 0, 5, 6])
  })
  it('ungroups without changing any child world matrix and retains tombstoned source lineage', () => {
    const input = fixture()
    const before = groups.instanceWorldTransform(input, 'l1')
    const result = groups.ungroupSemanticInstance(input, 'g1')
    expect(groups.instanceWorldTransform(result, 'l1')).toEqual(before)
    expect(result.instances.l1.parentInstanceId).toBe(null)
    expect(result.instances.g1.lineage.tombstone).toBe(true)
    expect(result.definitions).toEqual(input.definitions)
    expect(groups.semanticInstanceTree(result, 's1').map((n) => n.instanceId)).toEqual(['l1'])
  })
  it('maps world pointer vectors through ancestor inverse, not the leaf rotation or an AABB', () => {
    const input = fixture()
    expect(groups.pointerDeltaInParent(input, 'l1', { x: 20, y: 30 })).toEqual({ x: 5, y: 10 })
    const moved = groups.moveSemanticInstance(input, 'l1', { x: -0.25, y: 1.5 })
    const before = affine.transformPoint(groups.instanceWorldTransform(input, 'l1'), { x: 0, y: 0 })
    const after = affine.transformPoint(groups.instanceWorldTransform(moved, 'l1'), { x: 0, y: 0 })
    expect(after.x - before.x).toBeCloseTo(-0.25, 10)
    expect(after.y - before.y).toBeCloseTo(1.5, 10)
  })
  it('rejects singular/missing/invalid commands without partial state changes', () => {
    const input = fixture(),
      original = JSON.stringify(input)
    expect(() => groups.moveSemanticInstance(input, 'absent', { x: 1, y: 2 })).toThrow()
    expect(() => groups.ungroupSemanticInstance(input, 'l1')).toThrow()
    expect(() => groups.moveSemanticInstance(input, 'l1', { x: NaN, y: 0 })).toThrow()
    expect(JSON.stringify(input)).toBe(original)
    input.instances.g1.localTransform = [1, 2, 2, 4, 0, 0]
    expect(() => groups.moveSemanticInstance(input, 'l1', { x: 1, y: 2 })).toThrow()
  })
  it.each([
    [0, 1, -1, 0, 300, -20],
    [0.5, 0, 0, 2, -100, 17.25],
  ])('applies a world rotation/resize through the ancestor inverse: %j', (...coefficients) => {
    const operation = coefficients.slice(0, 6)
    const input = fixture()
    const before = groups.instanceWorldTransform(input, 'l1')
    const result = groups.transformSemanticInstance(input, 'l1', operation)
    const expected = affine.multiply(operation, before)
    const actual = groups.instanceWorldTransform(result, 'l1')
    actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 10))
    expect(result.definitions).toEqual(input.definitions)
    expect(result.instances.l2).toEqual(input.instances.l2)
    expect(input.instances.l1.localTransform).toEqual([0, 1, -1, 0, 5, 6])
  })
  it('regroups an explicitly selected promoted child with unchanged world placement and source identity', () => {
    const input = fixture()
    const before = groups.instanceWorldTransform(input, 'l1')
    const ungrouped = groups.ungroupSemanticInstance(input, 'g1')
    const moved = groups.moveSemanticInstance(ungrouped, 'l1', { x: 5, y: -8 })
    const restored = groups.regroupSemanticInstance(moved, 'g1', ['l1'])
    expect(restored.instances.l1.parentInstanceId).toBe('g1')
    expect(restored.instances.g1.lineage.tombstone).toBe(false)
    const expected = [...before]
    expected[4] += 5
    expected[5] -= 8
    // Inverting the authored 3x parent scale requires a non-exact 1/3.
    groups
      .instanceWorldTransform(restored, 'l1')
      .forEach((value, index) => expect(value).toBeCloseTo(expected[index], 10))
    expect(restored.instances.l2).toEqual(input.instances.l2)
    expect(restored.definitions).toEqual(input.definitions)
    expect(groups.semanticInstanceTree(restored, 's1')[0].children[0].instanceId).toBe('l1')
  })
  it('rejects singular operations and invalid regroup selection without mutation', () => {
    const input = fixture()
    const snapshot = JSON.stringify(input)
    expect(() => groups.transformSemanticInstance(input, 'g1', [1, 2, 2, 4, 0, 0])).toThrow()
    expect(() => groups.regroupSemanticInstance(input, 'g1', ['l1'])).toThrow()
    const ungrouped = groups.ungroupSemanticInstance(input, 'g1')
    const ungroupedSnapshot = JSON.stringify(ungrouped)
    for (const ids of [[], ['l1', 'l1'], ['l2'], ['absent'], ['g1']]) {
      expect(() => groups.regroupSemanticInstance(ungrouped, 'g1', ids)).toThrow()
    }
    expect(JSON.stringify(ungrouped)).toBe(ungroupedSnapshot)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  it('performs move, ungroup, and regroup on schemaVersion 3 documents preserving COW', () => {
    const input = graph.compactSemanticGraph(fixture())
    const snapshot = JSON.stringify(input)
    const beforeWorld = groups.instanceWorldTransform(input, 'l1')
    const moved = groups.moveSemanticInstance(input, 'l1', { x: 10, y: -20 })
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(moved.schemaVersion).toBe(3)
    const movedWorld = groups.instanceWorldTransform(moved, 'l1')
    expect(movedWorld[4]).toBeCloseTo(beforeWorld[4] + 10, 8)
    expect(movedWorld[5]).toBeCloseTo(beforeWorld[5] - 20, 8)

    const ungrouped = groups.ungroupSemanticInstance(input, 'g1')
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(records.semanticInstance(ungrouped, 'g1').lineage.tombstone).toBe(true)
    expect(records.semanticInstance(ungrouped, 'l1').parentInstanceId).toBe(null)

    const regrouped = groups.regroupSemanticInstance(ungrouped, 'g1', ['l1'])
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(records.semanticInstance(regrouped, 'g1').lineage.tombstone).toBe(false)
    expect(records.semanticInstance(regrouped, 'l1').parentInstanceId).toBe('g1')
  })
})
