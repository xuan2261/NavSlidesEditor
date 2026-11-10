import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { normalizeSmartArtDocument } = require('../../shared/src/pptx-smartart-document')

function graph(count = 3) {
  return {
    schemaVersion: 1, componentId: 'diagram',
    points: Array.from({ length: count }, (_, i) => ({
      componentId: `point-${i}`, modelId: String(i), type: i ? 'node' : 'doc', properties: [],
    })),
    connections: Array.from({ length: count - 1 }, (_, i) => ({
      componentId: `connection-${i}`, modelId: String(count + i), type: 'parOf',
      sourceId: String(i), destinationId: String(i + 1), sourceOrder: 0, destinationOrder: 0,
    })),
    relationships: ['data', 'layout', 'style', 'colors'].map((role) => ({
      role, relationshipId: role, relationshipType: `http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagram${{ data: 'Data', layout: 'Layout', style: 'QuickStyle', colors: 'Colors' }[role]}`,
      partUri: `ppt/diagrams/${role}.xml`, preconditionHash: 'a'.repeat(64),
    })),
  }
}
describe('SmartArt source graph document', () => {
  it('retains all 51 points and a deep hierarchy through JSON reopen', () => {
    const input = graph(51), before = JSON.stringify(input), result = normalizeSmartArtDocument(input)
    expect(result.points).toHaveLength(51)
    expect(result.connections[49].destinationId).toBe('50')
    expect(normalizeSmartArtDocument(JSON.parse(JSON.stringify(result)))).toEqual(result)
    expect(Object.isFrozen(result.points[50])).toBe(true)
    expect(JSON.stringify(input)).toBe(before)
    expect(result).not.toHaveProperty('layout')
  })
  it.each([
    (d) => { d.points[1].modelId = d.points[0].modelId },
    (d) => { d.connections[0].destinationId = '999' },
    (d) => { d.connections[0].modelId = d.points[0].modelId },
    (d) => { d.points[1].type = 'invented' },
    (d) => { d.connections[0].sourceOrder = -1 },
    (d) => { d.points[1].guessedX = 10 },
    (d) => { d.relationships[1].role = 'data' },
    (d) => { d.points[1].properties = [{ name: 'unknown', value: true }] },
    (d) => { d.points[1].properties = [{ name: 'toString', value: true }] },
    (d) => { d.points[1].textDocument = false },
  ])('rejects malformed documents atomically', (change) => {
    const d = graph(); change(d)
    expect(() => normalizeSmartArtDocument(d)).toThrow()
  })
  it('rejects hierarchy cycles but preserves nonhierarchy presentation associations', () => {
    const d = graph()
    d.connections.push({ ...d.connections[0], componentId: 'cycle', modelId: '99', sourceId: '2', destinationId: '0' })
    expect(() => normalizeSmartArtDocument(d)).toThrow(/cycle/)
    d.connections[2].type = 'presOf'
    expect(normalizeSmartArtDocument(d).connections).toHaveLength(3)
  })
  it('rejects cyclic JavaScript input without recursion overflow', () => {
    const d = graph(); d.points.push(d)
    expect(() => normalizeSmartArtDocument(d)).toThrow(/JSON/)
  })
})
