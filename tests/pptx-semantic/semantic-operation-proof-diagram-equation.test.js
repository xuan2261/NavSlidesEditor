// @vitest-environment node
import { expect } from 'vitest'
import { copy, effective, family, kind, proofSuite, require, walk } from './semantic-operation-proof-helpers.js'
const { createOmmlStructure } = require('../../shared/src/pptx-omml-operations-presets')
const { createOmmlPropertyCommand, createOmmlMatrixCommand } = require('../../shared/src/pptx-omml-operations-structure')
const proof = proofSuite('feature-fixtures.js')
const diagram = c => effective(c.presentation, c)
const point = (d, modelId) => d.points.find(p => p.modelId === modelId)
const edge = (d, modelId) => d.connections.find(e => e.destinationId === modelId && e.type === 'parOf')
proof('diagram.label', kind('diagram'), c => {
  const target = point(diagram(c), 'node-51'), textDocument = copy(target.textDocument)
  textDocument.paragraphs[0].runs[0].text = 'Edited node 51'
  return family(c, { type: 'label', pointId: target.componentId, textDocument })
}, (p, c) => {
  const result = effective(p, c)
  expect(point(result, 'node-51').textDocument.paragraphs[0].runs[0].text).toBe('Edited node 51')
  expect(result.points).toHaveLength(52)
  expect(result.connections).toEqual(diagram(c).connections)
  expect(point(result, 'node-50')).toEqual(point(diagram(c), 'node-50'))
}, c => family(c, { type: 'label', pointId: 'missing-node', textDocument: point(diagram(c), 'node-51').textDocument }))
proof('diagram.insert-delete', kind('diagram'), c => {
  const d = diagram(c)
  let p = family(c, { type: 'add',
    point: { componentId: `${d.componentId}~authored:proof-node`, modelId: 'proof-node', type: 'node', properties: [] },
    connection: { componentId: `${d.componentId}~authored:proof-edge`, modelId: 'proof-edge', type: 'parOf',
      sourceId: 'root', destinationId: 'proof-node', sourceOrder: 1, destinationOrder: 0 } })
  expect(effective(p, c).points).toHaveLength(53)
  p = family(c, { type: 'delete', pointId: point(d, 'node-51').componentId }, p)
  return p
}, (p, c) => {
  const result = effective(p, c)
  expect(result.points).toHaveLength(52)
  expect(point(result, 'proof-node')).toMatchObject({ type: 'node' })
  expect(point(result, 'node-51')).toBeUndefined()
  expect(edge(result, 'proof-node').sourceId).toBe('root')
  expect(edge(result, 'node-51')).toBeUndefined()
  expect(point(result, 'node-50')).toEqual(point(diagram(c), 'node-50'))
}, c => family(c, { type: 'delete', pointId: point(diagram(c), 'node-1').componentId }))
proof('diagram.reparent-reorder', kind('diagram'), c => {
  const d = diagram(c), root = point(d, 'root'), leaf = point(d, 'node-51')
  let p = family(c, { type: 'reparent', pointId: leaf.componentId, parentId: root.componentId, connectionId: edge(d, 'node-51').componentId })
  p = family(c, { type: 'reorder', parentId: root.componentId, pointIds: [leaf.componentId, point(d, 'node-1').componentId] }, p)
  return p
}, (p, c) => {
  const d = effective(p, c)
  expect(edge(d, 'node-51')).toMatchObject({ sourceId: 'root', sourceOrder: 0 })
  expect(edge(d, 'node-1')).toMatchObject({ sourceId: 'root', sourceOrder: 1 })
  expect(d.points).toEqual(diagram(c).points)
  expect(edge(d, 'node-50')).toEqual(edge(diagram(c), 'node-50'))
}, c => family(c, { type: 'reparent', pointId: point(diagram(c), 'node-1').componentId,
  parentId: point(diagram(c), 'node-51').componentId, connectionId: edge(diagram(c), 'node-1').componentId }))
proof('diagram.layout-style', kind('diagram'), c => {
  const d = diagram(c), declaration = d.layout.declarations.find(item => item.type === 'param' && item.attributes.type === 'linDir')
  const p = family(c, { type: 'layout', declarationId: declaration.componentId, attribute: 'val', value: 'fromL' })
  return family(c, { type: 'style', pointId: point(d, 'node-1').componentId, properties: [{ name: 'presStyleLbl', value: 'node0' }] }, p)
}, (p, c) => {
  const result = effective(p, c)
  expect(result.layout.declarations.find(item => item.type === 'param' && item.attributes.type === 'linDir').attributes.val).toBe('fromL')
  expect(point(result, 'node-1').properties).toContainEqual({ name: 'presStyleLbl', value: 'node0' })
  expect(result.connections).toEqual(diagram(c).connections)
  expect(result.sourceStyles).toEqual(diagram(c).sourceStyles)
}, c => family(c, { type: 'style', pointId: point(diagram(c), 'node-1').componentId, properties: [{ name: 'custSzX', value: 10 }] }))

const math = c => effective(c.presentation, c)
const atom = (d, type) => walk(d.root).find(n => n.type === type)
proof('equation.runs', kind('equation'), c => family(c, { type: 'setText', componentId: atom(math(c), 't').componentId, text: 'α + β' }), (p, c) => {
  const result = effective(p, c)
  expect(atom(result, 't').text).toBe('α + β')
  expect(walk(result.root).filter(n => n.type === 't').slice(1)).toEqual(walk(math(c).root).filter(n => n.type === 't').slice(1))
  expect(atom(result, 'f').componentId).toBe(atom(math(c), 'f').componentId)
}, c => family(c, { type: 'setText', componentId: atom(math(c), 'f').componentId, text: 'invalid target' }))
proof('equation.fraction-script', kind('equation'), c => {
  const d = math(c), fraction = atom(d, 'f')
  let p = family(c, createOmmlPropertyCommand(d, fraction.componentId, 'type', 'lin', 'proof-fraction'))
  const current = effective(p, c), parent = atom(current, 'oMath')
  const script = createOmmlStructure(current, 'sSubSup', 'proof-script')
  walk(script).filter(n => n.type === 't').forEach((n, index) => { n.text = ['x', 'i', '2'][index] })
  p = family(c, { type: 'insert', componentId: parent.componentId, index: parent.children.length, node: script }, p)
  return p
}, (p, c) => {
  const result = effective(p, c)
  expect(atom(result, 'f').children.find(n => n.type === 'fPr').children.find(n => n.type === 'type').attributes[0].value).toBe('lin')
  expect(walk(atom(result, 'sSubSup')).filter(n => n.type === 't').map(n => n.text)).toEqual(['x', 'i', '2'])
  expect(atom(result, 'num')).toEqual(atom(math(c), 'num'))
  expect(atom(result, 'den')).toEqual(atom(math(c), 'den'))
  expect(atom(result, 'm')).toEqual(atom(math(c), 'm'))
}, c => family(c, { type: 'remove', componentId: math(c).root.componentId }))
proof('equation.matrix', kind('equation'), c => {
  const d = math(c), matrix = atom(d, 'm')
  let p = family(c, createOmmlMatrixCommand(d, matrix.componentId, { axis: 'column', action: 'insert', index: 1 }, 'proof-column'))
  p = family(c, createOmmlMatrixCommand(effective(p, c), matrix.componentId, { axis: 'row', action: 'insert', index: 2 }, 'proof-row'), p)
  return p
}, (p, c) => {
  const rows = atom(effective(p, c), 'm').children.filter(n => n.type === 'mr')
  expect(rows).toHaveLength(3)
  expect(rows.map(row => row.children.length)).toEqual([3, 3, 3])
  expect(rows.slice(0, 2).map(row => row.children.filter((_, index) => index !== 1))).toEqual(atom(math(c), 'm').children.filter(n => n.type === 'mr').map(row => row.children))
  expect(atom(effective(p, c), 'f')).toEqual(atom(math(c), 'f'))
}, c => family(c, { type: 'replace', componentId: atom(math(c), 'm').componentId,
  node: { ...copy(atom(math(c), 'm')), children: [] } }))
