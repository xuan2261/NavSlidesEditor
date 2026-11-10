import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { validateDiagramDrawingReference } = require('../../shared/src/pptx-diagram-drawing-reference')

function validDefinition() {
  const hash = 'a'.repeat(64)
  const partUri = 'ppt/diagrams/data1.xml'
  const drawingPart = 'ppt/diagrams/drawing1.xml'
  const definitionId = `${partUri}#diagram:0`
  return {
    id: definitionId,
    kind: 'diagram',
    content: {
      smartArtDocument: {
        schemaVersion: 1,
        componentId: `${partUri}#diagram-root:0`,
        relationships: [
          { role: 'data', partUri, preconditionHash: hash },
          { role: 'layout', partUri: 'ppt/diagrams/layout1.xml', preconditionHash: hash },
          { role: 'style', partUri: 'ppt/diagrams/style1.xml', preconditionHash: hash },
          { role: 'colors', partUri: 'ppt/diagrams/colors1.xml', preconditionHash: hash },
        ],
      },
      drawingFallback: {
        ownerDefinitionId: definitionId,
        role: 'native-visual-cache',
        dataModel: { partUri, preconditionHash: hash, path: [0] },
        declaration: { partUri, preconditionHash: hash, path: [0, 4, 0] },
        extensionUri: '{C9EACBC2-C29D-4C66-9B7D-6A1C79F987C3}',
        relationship: {
          relationshipId: 'drawing',
          relationshipType: 'http://schemas.microsoft.com/office/2007/relationships/diagramDrawing',
          source: { partUri: 'ppt/diagrams/_rels/data1.xml.rels', preconditionHash: hash, path: [0, 0] },
        },
        drawing: { partUri: drawingPart, preconditionHash: hash, path: [0] },
        constituents: [
          { id: `${partUri}#ext:0.4.0`, kind: 'ext', source: { partUri, preconditionHash: hash, path: [0, 4, 0] } },
          { id: `${drawingPart}#drawing:0`, kind: 'drawing', source: { partUri: drawingPart, preconditionHash: hash, path: [0] } },
        ],
      },
    },
    components: [],
  }
}

describe('SmartArt native drawing fallback reference validation', () => {
  const safePartUri = (part) => typeof part === 'string' && part.startsWith('ppt/') && !part.includes('..')

  it('validates authentic drawing reference without mutation or editability claim', () => {
    const definition = validDefinition()
    const before = JSON.stringify(definition)
    expect(() => validateDiagramDrawingReference(definition, safePartUri)).not.toThrow()
    expect(JSON.stringify(definition)).toBe(before)
  })

  it('rejects mutable or forged drawing references fail-closed', () => {
    for (const mutate of [
      (d) => { d.content.drawingFallback.role = 'editable-geometry' },
      (d) => { d.content.drawingFallback.ownerDefinitionId = 'stolen' },
      (d) => { d.content.drawingFallback.drawing.partUri = 'ppt/slides/slide1.xml' },
      (d) => { d.content.drawingFallback.constituents = [] },
      (d) => { d.components.push({ id: d.content.drawingFallback.constituents[0].id }) },
      (d) => { d.content.drawingFallback.dataModel.path = [1] },
    ]) {
      const d = validDefinition()
      mutate(d)
      expect(() => validateDiagramDrawingReference(d, safePartUri)).toThrow(/Invalid semantic diagram drawing reference/)
    }
  })
})
