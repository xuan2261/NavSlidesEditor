import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { readGeometrySource } = require('../../server/services/pptx-import/ooxml-geometry-source')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { normalizeGeometryDocument, evaluateGeometryGuides } = require('../../shared/src/pptx-geometry-document')
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const parse = (xml) => parseXml(xml.replace('>', ` xmlns:a="${A}">`))[0]
const options = { componentId: 'native:geometry', template: true }
const custom = '<a:custGeom><a:avLst><a:gd name="adj" fmla="val 00025"/></a:avLst><a:gdLst><a:gd name="half" fmla="*/ w 1 2"/></a:gdLst><a:cxnLst><a:cxn ang="cd4"><a:pos x="half" y="h"/></a:cxn></a:cxnLst><a:rect l="0" t="0" r="w" b="h"/><a:pathLst><a:path w="100" h="80" stroke="false" extrusionOk="0"><a:moveTo><a:pt x="0000" y="+0"/></a:moveTo><a:lnTo><a:pt x="half" y="h"/></a:lnTo></a:path></a:pathLst></a:custGeom>'

describe('opt-in source geometry template decoder', () => {
  it('retains real custom structure and lexical/path units without invented dimensions', () => {
    const geometry = readGeometrySource(parse(custom), {
      ...options, componentIdFor: (point) => `native:point:${point.start}`,
    })
    expect(geometry).toMatchObject({ schemaVersion: 2, kind: 'custom', componentId: options.componentId })
    for (const field of ['width', 'height', 'style']) expect(geometry).not.toHaveProperty(field)
    expect(geometry.adjustments[0].formula).toBe('val 00025')
    expect(geometry.paths[0]).toMatchObject({ width: 100, height: 80, stroke: false, extrusionOk: false })
    expect(geometry.paths[0].commands[0].points[0]).toMatchObject({ x: '0000', y: '+0' })
    expect(geometry.paths[0].commands[1].points[0].componentId).toMatch(/^native:point:/)
    expect(geometry.connections[0]).toMatchObject({ position: { x: 'half', y: 'h' } })
    expect(() => normalizeGeometryDocument(geometry)).toThrow()
    const bound = { ...geometry, schemaVersion: 1, width: 952500, height: 762000 }
    expect(evaluateGeometryGuides(bound).half).toBe(476250)
    expect(JSON.parse(JSON.stringify(geometry))).toEqual(geometry)
  })
  it.each(['rect', 'roundRect', 'circularArrow'])('expands the pinned %s preset in template mode', (preset) => {
    const geometry = readGeometrySource(parse(`<a:prstGeom prst="${preset}"><a:avLst/></a:prstGeom>`), options)
    expect(geometry).toMatchObject({ schemaVersion: 2, kind: 'preset', preset })
    expect(geometry.paths.length).toBeGreaterThan(0)
    expect(geometry).not.toHaveProperty('width')
    expect(geometry).not.toHaveProperty('height')
    expect(() => normalizeGeometryDocument({ ...geometry, schemaVersion: 1, width: 100, height: 80 })).not.toThrow()
  })
  it.each([{ width: 0 }, { height: 762000 }, { width: undefined }, { width: 952500, height: 762000 }])('rejects explicit authored dimensions with template mode: %j', (dimensions) => {
    expect(() => readGeometrySource(parse(custom), { ...options, ...dimensions })).toThrow()
  })
  it('keeps ordinary and explicit false decoders canonical, including authored zero', () => {
    const dimensions = { componentId: options.componentId, width: 0, height: 762000 }
    const geometry = readGeometrySource(parse(custom), dimensions)
    expect(geometry).toMatchObject({ schemaVersion: 1, width: 0, height: 762000 })
    expect(readGeometrySource(parse(custom), { ...dimensions, template: false })).toEqual(geometry)
    expect(() => readGeometrySource(parse(custom), { componentId: options.componentId })).toThrow()
  })
  it.each([
    custom.replace('*/ w 1 2', '*/ later 1 2'),
    custom.replace('*/ w 1 2', '*/ w 1 2 0'),
    custom.replace('*/ w 1 2', '*/ 1 1 0'),
    custom.replace('stroke="false"', 'stroke="maybe"'),
    custom.replace('<a:pathLst>', '<a:pathLst unsupported="1">'),
    custom.replace('<a:lnTo>', '<a:lnTo xmlns:a="urn:wrong">'),
    '<a:prstGeom prst="notSupported"><a:avLst/></a:prstGeom>',
  ])('rejects malformed or unsupported templates without a default geometry', (xml) => {
    expect(() => readGeometrySource(parse(xml), options)).toThrow()
  })
})
