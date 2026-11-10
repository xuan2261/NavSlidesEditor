// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { pictureFixture } from './semantic-picture-fixture'
import operations from '../../shared/src/pptx-projection-operation'
import presentationCore from '../../shared/src/pptx-semantic-presentation'
import svgCore from '../../shared/src/pptx-svg-operations'
import parser from '../../server/services/pptx-import/ooxml-semantic-svg'

const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 3 100 50"><rect x="2" y="4" width="30" height="20" rx="3" fill="#123456" transform="translate(7 8) scale(-1 1)"/><ellipse cx="60" cy="25" rx="12" ry="8" stroke="#abcdef" fill="none"/><line x1="1" y1="2" x2="9" y2="8"/><polyline points="1,2 3,4 5,6"/><polygon points="10,10 20,10 15,20"/><circle cx="40" cy="20" r="5"/></svg>'

describe('task12 source-bound typed SVG primitives', () => {
  it('imports, edits, serializes and reopens an occurrence without rewriting its source or siblings', async () => {
    const { presentation } = await pictureFixture({ svgSource: source,
      effects: '', crop: '', outline: '', frameGeometry: 'rect' })
    const before = structuredClone(presentation)
    const target = presentation.slides[0].elements[0]
    const document = target.svgDocument
    expect(document.paths.map((path) => path.primitive.kind)).toEqual([
      'rect', 'ellipse', 'line', 'polyline', 'polygon', 'circle',
    ])
    expect(document.paths[0].transform).toEqual([-1, 0, 0, 1, 7, 8])
    expect(document.viewBox).toEqual({ x: -5, y: 3, width: 100, height: 50 })
    const apply = (deck, command) => operations.applyPresentationProjectionOperation(deck, {
      type: 'svg.edit', instanceId: target.pptxInstanceId, componentId: document.componentId, command,
    })
    const edited = apply(presentation, { type: 'edit-primitive', pathId: document.paths[0].componentId,
      parameters: { width: 42 } })
    const reopened = presentationCore.normalizeSemanticPresentation(JSON.parse(JSON.stringify(edited)))
    expect(reopened.slides[0].elements[0].svgDocument.paths[0].primitive.parameters.width).toBe(42)
    expect(reopened.slides[0].elements[0].content).toContain('matrix(-1 0 0 1 7 8)')
    expect(reopened.slides[0].elements[1]).toEqual(before.slides[0].elements[1])
    expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    const converted = apply(reopened, { type: 'convert-to-path', pathId: document.paths[0].componentId })
    const path = converted.slides[0].elements[0].svgDocument.paths[0]
    expect(path).not.toHaveProperty('primitive')
    const point = path.geometry.paths[0].commands[0].points[0]
    const moved = apply(converted, { type: 'edit-path', pathId: path.componentId,
      geometryCommand: { type: 'control-point', componentId: point.componentId, x: 6 } })
    expect(moved.slides[0].elements[0].content).not.toBe(converted.slides[0].elements[0].content)
    expect(presentation).toEqual(before)
  })
  it('rejects malformed and active primitives before admission', () => {
    for (const body of ['<rect width="-1" height="2"/>', '<circle r="0"/>',
      '<polygon points="1 2 3"/>', '<rect width="2" height="2" onload="evil()"/>',
      '<rect width="2" height="2" transform="url(https://blocked.invalid)"/>',
      '<rect width="2" height="2" style="fill:url(https://blocked.invalid)"/>'])
      expect(() => parser.parseSvgSource(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`))).toThrow(/SVG/i)
  })
  it('rejects implicit primitive conversion and invalid edits atomically', async () => {
    const { presentation } = await pictureFixture({ svgSource: source,
      effects: '', crop: '', outline: '', frameGeometry: 'rect' })
    const document = presentation.slides[0].elements[0].svgDocument
    const before = structuredClone(document), path = document.paths[0]
    expect(() => svgCore.applySvgOperation(document, { type: 'edit-primitive', pathId: path.componentId,
      parameters: { width: -1 } })).toThrow()
    expect(() => svgCore.applySvgOperation(document, { type: 'edit-path', pathId: path.componentId,
      geometryCommand: { type: 'control-point', componentId: path.geometry.paths[0].commands[0].points[0].componentId, x: 5 } })).toThrow(/convert/i)
    expect(document).toEqual(before)
  })
})
