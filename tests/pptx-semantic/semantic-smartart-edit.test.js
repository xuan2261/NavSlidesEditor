import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fixture } from './smartart-layout-fixture.js'
const require = createRequire(import.meta.url)
const edit = (document, command) =>
  require('../../shared/src/pptx-smartart-operations').applySmartArtOperation(document, command)
const render = (document, bounds = { x: 0, y: 0, width: 200, height: 100 }) =>
  require('../../shared/src/pptx-smartart-render').createSmartArtRenderModel(document, bounds)
const text = (value) => ({
  schemaVersion: 1, componentId: 'data~authored:body',
  paragraphs: [{ componentId: 'data~authored:body~authored:p', runs: [
    { componentId: 'data~authored:body~authored:r', kind: 'text', text: value, properties: { bold: true } },
  ] }],
})
async function siblings(count = 3) {
  const { document } = await fixture({ count })
  const d = JSON.parse(JSON.stringify(document))
  d.connections.forEach((c, i) => { c.sourceId = '0'; c.sourceOrder = i })
  return d
}

describe('typed SmartArt occurrence edits and authored placement', () => {
  it('edits rich labels and style without changing source or layout identities', async () => {
    const d = await siblings(), before = JSON.stringify(d)
    const labelled = edit(d, { type: 'label', pointId: 'p1', textDocument: text('Edited') })
    const styled = edit(labelled, {
      type: 'style', pointId: 'p1', properties: [{ name: 'presStyleLbl', value: 'accent' }],
    })
    expect(styled.points[1].textDocument).toEqual(text('Edited'))
    expect(styled.points[1].properties).toEqual([{ name: 'presStyleLbl', value: 'accent' }])
    expect(styled.layout).toEqual(d.layout)
    expect(styled.relationships).toEqual(d.relationships)
    expect(Object.isFrozen(styled.points[1])).toBe(true)
    expect(JSON.stringify(d)).toBe(before)
    expect(render(styled).nodes[0]).toMatchObject({ componentId: 'p1', x: 0, width: 40 })
  })
  it('inserts, reorders, reparents and deletes exact logical IDs with reevaluation', async () => {
    const d = await siblings()
    const added = edit(d, {
      type: 'add',
      point: { componentId: 'data~authored:new', modelId: '100', type: 'node', properties: [] },
      connection: { componentId: 'data~authored:edge', modelId: '101', type: 'parOf',
        sourceId: '0', destinationId: '100', sourceOrder: 3, destinationOrder: 0 },
    })
    expect(render(added).nodes.map((n) => n.x)).toEqual([0, 50, 100, 150])
    const reordered = edit(added, {
      type: 'reorder', parentId: 'p0', pointIds: ['data~authored:new', 'p3', 'p2', 'p1'],
    })
    expect(render(reordered).nodes.map((n) => n.componentId)).toEqual(['data~authored:new', 'p3', 'p2', 'p1'])
    const reparented = edit(reordered, {
      type: 'reparent', pointId: 'p1', parentId: 'p2', connectionId: 'c0',
    })
    expect(reparented.connections.find((c) => c.componentId === 'c0').sourceId).toBe('2')
    const deleted = edit(reparented, { type: 'delete', pointId: 'data~authored:new' })
    expect(render(deleted).nodes).toHaveLength(3)
    expect(render(JSON.parse(JSON.stringify(deleted)))).toEqual(render(deleted))
    expect(d.points).toHaveLength(4)
  })
  it('adds and deletes explicit connections without mutating endpoints', async () => {
    const d = await siblings()
    const connection = { componentId: 'data~authored:association', modelId: '100', type: 'presOf',
      sourceId: '1', destinationId: '2', sourceOrder: 0, destinationOrder: 0 }
    const added = edit(d, { type: 'connection', action: 'add', connection })
    expect(added.connections.at(-1)).toEqual(connection)
    expect(edit(added, { type: 'connection', action: 'delete', connectionId: connection.componentId })).toEqual(d)
  })
  it('rejects cycles, ID theft, incomplete permutations and hidden payloads atomically', async () => {
    const d = await siblings(), before = JSON.stringify(d)
    for (const command of [
      { type: 'reparent', pointId: 'p1', parentId: 'p1', connectionId: 'c0' },
      { type: 'reorder', parentId: 'p0', pointIds: ['p1', 'p2'] },
      { type: 'delete', pointId: 'missing' },
      { type: 'style', pointId: 'p1', properties: [{ name: 'custSzX', value: 20 }] },
      { type: 'label', pointId: 'p1', textDocument: { ...text('x'), componentId: 'p2' } },
      { type: 'delete', pointId: 'p1', layout: {} },
      { type: 'connection', action: 'add', connection: { ...d.connections[0], componentId: 'stolen' } },
    ]) expect(() => edit(d, command)).toThrow()
    expect(JSON.stringify(d)).toBe(before)
  })
  it('preserves existing rich text identity kinds and refuses dangling references', async () => {
    const d = await siblings()
    d.points[1].textDocument = text('first')
    const replacement = text('second')
    replacement.paragraphs[0].runs[0].componentId = replacement.paragraphs[0].componentId
    expect(() => edit(d, { type: 'label', pointId: 'p1', textDocument: replacement })).toThrow()
    d.points[2].properties.push({ name: 'presAssocID', value: '1' })
    expect(() => edit(d, { type: 'delete', pointId: 'p1' })).toThrow(/association/)
  })
  it('preserves sibling order when reparenting to the existing exact parent', async () => {
    const d = await siblings(), before = JSON.stringify(d)
    const result = edit(d, { type: 'reparent', pointId: 'p1', parentId: 'p0', connectionId: 'c0' })
    expect(result).toEqual(d)
    expect(render(result)).toEqual(render(d))
    expect(JSON.stringify(d)).toBe(before)
  })
  it('rejects ambiguous reparenting and parent-disconnecting edits before publishing a graph', async () => {
    const { document } = await fixture({ count: 51 })
    const before = JSON.stringify(document)
    for (const command of [
      { type: 'delete', pointId: 'p1' },
      { type: 'connection', action: 'delete', connectionId: 'c0' },
      { type: 'connection', action: 'add', connection: {
        componentId: 'data~authored:secondParent', modelId: '1000', type: 'parOf',
        sourceId: '0', destinationId: '2', sourceOrder: 1, destinationOrder: 1,
      } },
    ]) expect(() => edit(document, command)).toThrow(/hierarchy|parent/)
    expect(JSON.stringify(document)).toBe(before)
    expect(render(document).nodes).toHaveLength(51)
    const ambiguous = JSON.parse(before)
    ambiguous.connections.push({ ...ambiguous.connections[0], componentId: 'second-parent',
      modelId: '1000', destinationId: '2', sourceOrder: 1, destinationOrder: 1 })
    const ambiguousBefore = JSON.stringify(ambiguous)
    expect(() => edit(ambiguous, {
      type: 'reparent', pointId: 'p2', parentId: 'p3', connectionId: 'c1',
    })).toThrow(/incoming hierarchy/)
    expect(JSON.stringify(ambiguous)).toBe(ambiguousBefore)
  })
  it('keeps node 51 and fails unsupported layout with its exact source locator', async () => {
    const { document } = await fixture({ count: 60 })
    const edited = edit(document, { type: 'label', pointId: 'p51', textDocument: text('51') })
    expect(render(edited).nodes).toHaveLength(60)
    const invalid = JSON.parse(JSON.stringify(edited))
    invalid.layout.declarations.find((d) => d.type === 'alg').attributes.type = 'cycle'
    expect(() => render(invalid)).toThrow()
    try { render(invalid) } catch (error) {
      expect(error.code).toBe('PPTX_SMARTART_LAYOUT_UNSUPPORTED')
      expect(error.sourceLocation.partUri).toBe('ppt/diagrams/layout.xml')
    }
  })
})
