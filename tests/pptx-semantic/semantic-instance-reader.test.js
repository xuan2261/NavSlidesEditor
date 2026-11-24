// @vitest-environment node
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import { geometryStyleFixture } from './geometry-style-fixture.js'

const require = createRequire(import.meta.url)
const core = require('../../shared/src/pptx-semantic-document.js')
const groups = require('../../shared/src/pptx-semantic-groups.js')
const render = require('../../shared/src/pptx-semantic-render-tree.js')

function fixture() {
  const model = geometryStyleFixture()
  model.definitions.group = {
    id: 'group',
    kind: 'group',
    source: {
      partUri: 'ppt/slides/slide1.xml',
      nativeId: '8',
      preconditionHash: 'a'.repeat(64),
    },
    components: [],
    content: {},
  }
  model.instances.g = {
    id: 'g',
    definitionId: 'group',
    slideId: 's1',
    parentInstanceId: null,
    localTransform: [-2, 0, 1, 0.5, 1000, -400],
    paintIndex: 0,
    overrides: {},
  }
  model.instances.i1.parentInstanceId = 'g'
  model.instances.i1.localTransform = [1, 0, 0, 1, 10, 20]
  return model
}

describe('operation scoped semantic instance reads', () => {
  it('provides validated linked world transforms and tree reads without changing the source', () => {
    const model = fixture()
    const before = structuredClone(model)
    const reader = groups.createSemanticInstanceReader(model)
    expect(reader.instanceWorldTransform('g')).toEqual([-2, 0, 1, 0.5, 1000, -400])
    expect(reader.instanceWorldTransform('i1')).toEqual([-2, 0, 1, 0.5, 1000, -390])
    expect(reader.instanceWorldTransform('i2')).toEqual([-1, 0, 0, 1, 952500, 0])
    const tree = reader.semanticInstanceTree('s1')
    expect(tree[0].instanceId).toBe('g')
    expect(tree[0].children.map((node) => node.instanceId)).toEqual(['i1'])
    expect(reader.document).not.toBe(model)
    expect(Object.isFrozen(reader.document.instances.i1.localTransform)).toBe(true)
    expect(model).toEqual(before)
  })

  it('owns a private immutable snapshot and never trusts a later mutation of the raw object', () => {
    const model = fixture()
    const reader = groups.createSemanticInstanceReader(model)
    const first = reader.instanceWorldTransform('i1')
    first[4] = 12
    const firstTree = reader.semanticInstanceTree('s1')
    firstTree[0].localTransform[4] = 50
    firstTree[0].children.length = 0
    model.instances.g.localTransform[4] = 2000
    expect(reader.instanceWorldTransform('i1')[4]).toBe(1000)
    expect(reader.semanticInstanceTree('s1')[0].children).toHaveLength(1)
    expect(reader.semanticInstanceTree('s1')[0].localTransform[4]).toBe(1000)
    expect(reader.document.instances.g.localTransform[4]).toBe(1000)
    expect(groups.createSemanticInstanceReader(model).instanceWorldTransform('i1')[4]).toBe(2000)
    model.instances.g.localTransform[0] = NaN
    expect(() => groups.createSemanticInstanceReader(model)).toThrow()
    expect(() => groups.instanceWorldTransform(model, 'i1')).toThrow()
    expect(reader.instanceWorldTransform('i1')[4]).toBe(1000)
  })

  it('reuses only trusted normalized documents without copying them again', () => {
    const document = core.normalizePptxSemanticDocument(fixture())
    const reader = groups.createSemanticInstanceReader(document)
    expect(reader.document).toBe(document)
    expect(groups.createSemanticInstanceReader(reader.document).document).toBe(document)
    expect(reader.instanceWorldTransform('i1')).toEqual([-2, 0, 1, 0.5, 1000, -390])
    const frozenLookalike = Object.freeze(structuredClone(document))
    const isolated = groups.createSemanticInstanceReader(frozenLookalike)
    expect(isolated.document).not.toBe(frozenLookalike)
    expect(isolated.document).toEqual(document)
    expect(Object.isFrozen(isolated.document.instances.g.localTransform)).toBe(true)
  })

  it('isolates standalone world and tree query results from source and later queries', () => {
    const model = fixture()
    const before = structuredClone(model)
    const world = groups.instanceWorldTransform(model, 'i1')
    const tree = groups.semanticInstanceTree(model, 's1')
    world[4] = 12
    tree[0].localTransform[4] = 50
    tree[0].children.length = 0
    expect(groups.instanceWorldTransform(model, 'i1')).toEqual([-2, 0, 1, 0.5, 1000, -390])
    const nextTree = groups.semanticInstanceTree(model, 's1')
    expect(nextTree[0].localTransform[4]).toBe(1000)
    expect(nextTree[0].children.map((node) => node.instanceId)).toEqual(['i1'])
    expect(model).toEqual(before)
  })

  it.each(['cycle', 'accessor', 'forged-source'])('rejects invalid read and mutation input: %s', (kind) => {
    const model = fixture()
    const getter = vi.fn(() => 2)
    if (kind === 'cycle') model.instances.g.parentInstanceId = 'i1'
    if (kind === 'accessor')
      Object.defineProperty(model.instances.i1, 'paintIndex', { enumerable: true, get: getter })
    if (kind === 'forged-source') model.styles.provider.source.preconditionHash = 'c'.repeat(64)
    const operations = [
      () => groups.createSemanticInstanceReader(model),
      () => groups.instanceWorldTransform(model, 'i1'),
      () => groups.semanticInstanceTree(model, 's1'),
      () => groups.pointerDeltaInParent(model, 'i1', { x: 1, y: 2 }),
      () => groups.moveSemanticInstance(model, 'i1', { x: 1, y: 2 }),
      () => groups.transformSemanticInstance(model, 'i1', [1, 0, 0, 1, 1, 2]),
      () => groups.ungroupSemanticInstance(model, 'g'),
      () => groups.regroupSemanticInstance(model, 'g', ['i1']),
    ]
    for (const operation of operations) expect(operation).toThrow()
    Object.freeze(model)
    for (const operation of operations) expect(operation).toThrow()
    expect(getter).not.toHaveBeenCalled()
  })

  it('preserves inactive and paint scope tree rules without sharing mutable query results', () => {
    const model = fixture()
    model.instances.i1.hidden = true
    model.instances.g.lineage = { paintOnly: true }
    model.instances.i2.lineage = { tombstone: true }
    const reader = groups.createSemanticInstanceReader(model)
    expect(reader.semanticInstanceTree('s1')[0].children[0].instanceId).toBe('i1')
    expect(reader.semanticInstanceTree('s2')).toEqual([])
    expect(() => reader.instanceWorldTransform('i2')).toThrow()
    expect(() => reader.instanceWorldTransform('missing')).toThrow()
    expect(reader.document.instances.g.lineage.paintOnly).toBe(true)
  })

  it('retains linked geometry and reflected nesting in a render operation', () => {
    const model = fixture()
    const tree = render.semanticRenderTree(model, {
      id: 's1',
      elements: [
        {
          id: 'i1',
          pptxInstanceId: 'i1',
          type: 'shape',
          shape: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 80,
        },
      ],
    })
    expect(tree[0].instanceId).toBe('g')
    expect(tree[0].children[0].element.pptxGeometry.style.fill.color.value).toBe('FF0000')
    expect(tree[0].children[0].transform).toBe(
      'matrix(1,0,0,1,0.0010498687664041995,0.002099737532808399)'
    )
  })
})
