import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture'
const require = createRequire(import.meta.url)
const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
const { getProjectionCapabilities } = require('../../shared/src/pptx-projection-capabilities')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { normalizeSvgDocument } = require('../../shared/src/pptx-svg-document')
const { applySvgOperation } = require('../../shared/src/pptx-svg-operations')
const hash = 'a'.repeat(64)
function svg() {
  const geometries = geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
  return { schemaVersion: 1, componentId: 'slide7#svg-root:0.0',
    source: { partUri: 'ppt/media/vector.svg', preconditionHash: hash, byteLength: 120, path: [0] },
    viewBox: { x: -2, y: 3, width: 100, height: 80 },
    paths: [0, 1].map((index) => ({
      componentId: `ppt/media/vector.svg#svg-path:0.${index + 1}`,
      source: { partUri: 'ppt/media/vector.svg', preconditionHash: hash, path: [0, index + 1],
        attribute: 'd', ordinal: index },
      geometry: { ...geometries, componentId: `geometry-${index}`,
        paths: geometries.paths.map((path) => ({ ...path,
          componentId: `geometry-path-${index}`,
          commands: path.commands.map((command) => {
            const { points, ...rest } = command
            return { ...rest, ...(points ? { points: points.map((point) => ({
              ...point, componentId: `${index}-${point.componentId}` })) } : {}) }
          }) })) },
    })) }
}
function semanticPresentation() {
  const document = svg(), hashSlide = 'b'.repeat(64)
  document.componentId = 'ppt/slides/slide1.xml#svg-root:0.1'
  document.paths.forEach((path, index) => {
    path.componentId = `ppt/media/vector.svg#svg-path:0.${index + 1}`
    path.source.path = [0, index + 1]
  })
  const definition = { id: 'svg-owner', kind: 'svg', origin: 'source',
    source: { partUri: 'ppt/slides/slide1.xml', preconditionHash: hashSlide,
      componentLocator: { path: [0], preconditionHash: hashSlide } },
    components: [
      { id: document.componentId, kind: 'property', locator: { path: [0, 1], preconditionHash: hashSlide } },
      ...document.paths.map((path) => ({ id: path.componentId, kind: 'path', partUri: path.source.partUri,
        locator: { path: path.source.path, preconditionHash: path.source.preconditionHash } })),
    ], content: { svgDocument: document } }
  const instance = (id, slideId) => ({ id, slideId, definitionId: 'svg-owner', parentInstanceId: null,
    localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} })
  return { pptxSemantic: { schemaVersion: 1, definitions: { 'svg-owner': definition },
    instances: { first: instance('first', 's1'), second: instance('second', 's2') }, styles: {}, fonts: {} },
    slides: [{ id: 's1', elements: [{ id: 'first-element', pptxInstanceId: 'first', type: 'svg' }] },
      { id: 's2', elements: [{ id: 'second-element', pptxInstanceId: 'second', type: 'svg' }] }] }
}
describe('source-bound SVG family document', () => {
  it('normalizes separate path geometries while retaining source receipts and viewBox', () => {
    const input = svg(), before = JSON.stringify(input)
    const result = normalizeSvgDocument(input)
    expect(result).toMatchObject({ componentId: input.componentId, source: input.source,
      viewBox: input.viewBox, paths: input.paths })
    expect(JSON.stringify(input)).toBe(before)
  })
  it('edits only the selected occurrence path through canonical geometry commands', () => {
    const input = svg(), before = JSON.stringify(input)
    const result = applySvgOperation(input, { type: 'edit-path', pathId: input.paths[0].componentId,
      geometryCommand: { type: 'control-point', componentId: '0-control', x: 42 } })
    expect(result.paths[0].geometry.paths[0].commands[1].points[0].x).toBe(42)
    expect(result.paths[1]).toEqual(input.paths[1])
    expect(result.source).toEqual(input.source)
    expect(JSON.stringify(input)).toBe(before)
  })
  it('rejects duplicate source path identities even when component ids differ', () => {
    const input = svg()
    input.paths[1].source.path = [...input.paths[0].source.path]
    input.paths[1].source.ordinal = input.paths[0].source.ordinal
    expect(() => normalizeSvgDocument(input)).toThrow(/duplicate path source/i)
  })
  it('rejects aliased SVG source nodes even with forged distinct ordinals', () => {
    const input = svg()
    input.paths[1].source.path = [...input.paths[0].source.path]
    expect(() => normalizeSvgDocument(input)).toThrow(/duplicate path source/i)
  })
  it.each([
    (d) => { d.paths[1].componentId = d.paths[0].componentId },
    (d) => { d.paths[0].source.path = [1] },
    (d) => { d.source.preconditionHash = 'bad' },
    (d) => { d.source.partUri = '../outside.svg' },
    (d) => { d.paths[0].source.path = [] },
    (d) => { d.paths[0].source.ordinal = -1 },
  ])('rejects invalid source identity or path ownership', (mutate) => {
    const input = svg(); mutate(input)
    expect(() => normalizeSvgDocument(input)).toThrow(TypeError)
  })
  it('rejects unknown paths and malformed edits without mutating source', () => {
    const input = svg(), before = JSON.stringify(input)
    expect(() => applySvgOperation(input, { type: 'edit-path', pathId: 'missing',
      geometryCommand: { type: 'extent', width: 20 } })).toThrow(/path/i)
    expect(() => applySvgOperation(input, { type: 'replace', pathId: input.paths[0].componentId,
      geometryCommand: { type: 'extent', width: 20 } })).toThrow(TypeError)
    expect(JSON.stringify(input)).toBe(before)
  })
  it('routes only svg.edit and stores its journal on the targeted occurrence', () => {
    const input = semanticPresentation(), before = JSON.stringify(input)
    const normalized = normalizePptxSemanticDocument(input.pptxSemantic)
    expect(getProjectionCapabilities(normalized, 'first').operations).toEqual(['svg.edit'])
    const definition = normalized.definitions['svg-owner']
    const svgDocument = definition.content.svgDocument
    const result = applyPresentationProjectionOperation(input, { type: 'svg.edit', instanceId: 'first',
      componentId: svgDocument.componentId,
      command: { type: 'edit-path', pathId: svgDocument.paths[0].componentId,
        geometryCommand: { type: 'control-point', componentId: '0-control', x: 42 } } })
    expect(result.pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
    expect(result.pptxSemantic.instances.first.overrides.components[svgDocument.componentId]
      .familyOperations.family).toBe('svg')
    expect(result.pptxSemantic.instances.second.overrides).toEqual({})
    expect(JSON.stringify(input)).toBe(before)
  })
})
