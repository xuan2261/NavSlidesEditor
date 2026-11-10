// @vitest-environment node
import { expect } from 'vitest'
import { apply, native, proofSuite, require } from './semantic-operation-proof-helpers.js'
const groups = require('../../shared/src/pptx-semantic-groups')
const { materializeGeometry } = require('../../shared/src/pptx-geometry-style-resolution')
const { deriveGeometryPaths } = require('../../shared/src/pptx-geometry-document')
const { multiply } = require('../../shared/src/pptx-affine')
const proof = proofSuite('geometry-fixtures.js')
const geometrySource = id => d => d.source?.nativeId === id && d.source.partUri === 'ppt/slides/slide2.xml'
const geometry = (p, c) => materializeGeometry(p.pptxSemantic, c.instance.id)
const edit = (c, command) => apply(c.presentation, { type: 'geometry.edit', instanceId: c.instance.id,
  componentId: geometry(c.presentation, c).componentId, command })
function moved(c, delta) {
  return { ...c.presentation, pptxSemantic: groups.moveSemanticInstance(c.presentation.pptxSemantic, c.instance.id, delta) }
}
function assertMove(p, c, x, y) {
  const before = groups.instanceWorldTransform(c.presentation.pptxSemantic, c.instance.id)
  const after = groups.instanceWorldTransform(p.pptxSemantic, c.instance.id)
  expect(after.slice(0, 4)).toEqual(before.slice(0, 4))
  expect(after[4] - before[4]).toBeCloseTo(x, 8)
  expect(after[5] - before[5]).toBeCloseTo(y, 8)
}
proof('geometry.transform', native('2'), c => ({ ...c.presentation,
  pptxSemantic: groups.transformSemanticInstance(c.presentation.pptxSemantic, c.instance.id, [0, 1, -1, 0, 13.25, -7.5]),
}), (p, c) => {
  const expected = multiply([0, 1, -1, 0, 13.25, -7.5], groups.instanceWorldTransform(c.presentation.pptxSemantic, c.instance.id))
  groups.instanceWorldTransform(p.pptxSemantic, c.instance.id).forEach((value, index) => expect(value).toBeCloseTo(expected[index], 8))
}, c => groups.transformSemanticInstance(c.presentation.pptxSemantic, c.instance.id, [1, 2, 2, 4, 0, 0]))
proof('geometry.path-control', geometrySource('501'), c => {
  const point = geometry(c.presentation, c).paths[0].commands[1].points[0]
  return edit(c, { type: 'control-point', componentId: point.componentId, x: 32000, y: 4500 })
}, (p, c) => {
  const result = geometry(p, c), before = geometry(c.presentation, c)
  expect(result.paths[0].commands[1].points[0]).toMatchObject({ x: 32000, y: 4500 })
  expect(result.paths[0].commands[1].points.slice(1)).toEqual(before.paths[0].commands[1].points.slice(1))
  expect(result.guides).toEqual(before.guides)
  expect(deriveGeometryPaths(result).paths[0].d).not.toBe(deriveGeometryPaths(before).paths[0].d)
}, c => edit(c, { type: 'control-point', componentId: 'foreign-point', x: 1, y: 2 }))
proof('geometry.preset-adjustment', geometrySource('502'), c => edit(c, { type: 'adjustment', name: 'adj1', value: 40000 }), (p, c) => {
  const result = geometry(p, c)
  expect(result.preset).toBe('rightArrow')
  expect(result.adjustments.find(a => a.name === 'adj1').formula).toBe('val 40000')
  expect(result.adjustments.find(a => a.name === 'adj2')).toEqual(geometry(c.presentation, c).adjustments.find(a => a.name === 'adj2'))
  expect(deriveGeometryPaths(result).paths).not.toEqual(deriveGeometryPaths(geometry(c.presentation, c)).paths)
}, c => edit(c, { type: 'adjustment', name: 'missing-adjustment', value: 1000 }))
proof('geometry.connector', geometrySource('503'), c => edit(c, { type: 'connector-detach', end: 'start' }), (p, c) => {
  const instance = p.pptxSemantic.instances[c.instance.id]
  expect(instance.connectorBindings.start).toBeNull()
  expect(instance.connectorBindings.end).toEqual(c.instance.connectorBindings.end)
  expect(geometry(p, c).connector).toEqual(geometry(c.presentation, c).connector)
}, c => edit(c, { type: 'connector-attach', end: 'start', targetInstanceId: 'missing-target', index: 0 }))
proof('group.child-edit', native('6'), c => moved(c, { x: -2.25, y: 4.5 }), (p, c) => {
  assertMove(p, c, -2.25, 4.5)
  expect(p.pptxSemantic.instances[c.instance.id].parentInstanceId).toBe(c.instance.parentInstanceId)
}, c => moved(c, { x: Infinity, y: 0 }))
proof('group.group-ungroup', native('5'), c => {
  const document = c.presentation.pptxSemantic
  const children = Object.values(document.instances).filter(i => i.parentInstanceId === c.instance.id).map(i => i.id)
  const ungrouped = groups.ungroupSemanticInstance(document, c.instance.id)
  return { presentation: { ...c.presentation, pptxSemantic: ungrouped }, affected: [c.instance.id, ...children] }
}, (p, c) => {
  expect(p.pptxSemantic.instances[c.instance.id].lineage.tombstone).toBe(true)
  const before = c.presentation.pptxSemantic
  const children = Object.values(before.instances).filter(i => i.parentInstanceId === c.instance.id).map(i => i.id)
  for (const childId of children) {
    expect(p.pptxSemantic.instances[childId].parentInstanceId).toBe(c.instance.parentInstanceId)
    groups.instanceWorldTransform(p.pptxSemantic, childId).forEach((v, index) => {
      expect(v).toBeCloseTo(groups.instanceWorldTransform(before, childId)[index], 8)
    })
  }
  const restored = groups.regroupSemanticInstance(p.pptxSemantic, c.instance.id, children)
  expect(restored.instances[c.instance.id].lineage.tombstone).toBe(false)
  for (const childId of children) {
    expect(restored.instances[childId].parentInstanceId).toBe(c.instance.id)
  }
}, c => groups.ungroupSemanticInstance(c.presentation.pptxSemantic, 'missing-group-instance'))
