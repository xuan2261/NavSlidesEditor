import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const {
  deriveGeometryPaths,
  evaluateGeometryGuides,
  normalizeGeometryDocument,
} = require('../../shared/src/pptx-geometry-document')
const source = () => require('../../server/services/pptx-import/ooxml-geometry-source')
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const parse = (xml) => parseXml(xml)[0]
const options = { componentId: 'source-geom', width: 100, height: 80 }
describe('authored DrawingML geometry admission', () => {
  it('pins the complete authored preset resource', () => {
    const bytes = readFileSync(
      new URL(
        '../../server/services/pptx-import/resources/drawingml-presets/drawingml-preset-shapes.xml',
        import.meta.url
      )
    )
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '4a762444d8d85876881c02a5b1dedf6f73006fcd8acb7b4e393435615b37c780'
    )
  })
  it('imports custom guides, control points, arcs, handles, sites and text rectangle without SVG flattening', () => {
    const xml = `<a:custGeom xmlns:a="${A}">
      <a:avLst><a:gd name="adj" fmla="val 25000"/></a:avLst>
      <a:gdLst><a:gd name="tip" fmla="*/ w adj 100000"/></a:gdLst>
      <a:ahLst><a:ahXY gdRefX="adj" minX="0" maxX="100000"><a:pos x="tip" y="0"/></a:ahXY></a:ahLst>
      <a:cxnLst><a:cxn ang="cd4"><a:pos x="tip" y="h"/></a:cxn></a:cxnLst>
      <a:rect l="0" t="0" r="w" b="h"/>
      <a:pathLst><a:path w="100" h="80" fill="none" stroke="1" extrusionOk="0">
        <a:moveTo><a:pt x="0" y="0"/></a:moveTo>
        <a:cubicBezTo><a:pt x="tip" y="10"/><a:pt x="70" y="20"/><a:pt x="80" y="30"/></a:cubicBezTo>
        <a:arcTo wR="10" hR="5" stAng="0" swAng="5400000"/>
      </a:path></a:pathLst></a:custGeom>`
    const geometry = source().readGeometrySource(parse(xml), options)
    expect(geometry.kind).toBe('custom')
    expect(geometry.guides).toEqual([{ name: 'tip', formula: '*/ w adj 100000' }])
    expect(geometry.paths[0].commands[1].points[0]).toMatchObject({ x: 'tip', y: '10' })
    expect(deriveGeometryPaths(geometry).paths[0].d).toContain('C 25 10 70 20 80 30')
    expect(deriveGeometryPaths(geometry).connections[0].position).toEqual({ x: 25, y: 80 })
    expect(geometry.paths[0]).toMatchObject({ fill: 'none', stroke: true, extrusionOk: false })
  })
  it('resolves actual roundRect adjustment without generic rectangle substitution', () => {
    const geometry = source().readGeometrySource(
      parse(
        `<a:prstGeom xmlns:a="${A}" prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 30000"/></a:avLst></a:prstGeom>`
      ),
      options
    )
    expect(geometry.preset).toBe('roundRect')
    expect(geometry.adjustments).toEqual([{ name: 'adj', formula: 'val 30000' }])
    expect(geometry.handles.length).toBeGreaterThan(0)
    expect(deriveGeometryPaths(geometry).paths[0].d).toContain('A 24 24')
  })
  it('derives every pinned preset at an asymmetric extent without NaN or generic aliases', () => {
    const catalog = readFileSync(
      new URL(
        '../../server/services/pptx-import/resources/drawingml-presets/drawingml-preset-shapes.xml',
        import.meta.url
      ),
      'utf8'
    )
    const names = parseXml(catalog)[0].children.map((node) => node.local)
    expect(names).toHaveLength(187)
    const failures = []
    for (const preset of names) {
      try {
        const geometry = source().readGeometrySource(
          parse(`<a:prstGeom xmlns:a="${A}" prst="${preset}"><a:avLst/></a:prstGeom>`),
          options
        )
        expect(geometry.preset).toBe(preset)
        expect(
          deriveGeometryPaths(geometry).paths.every((path) => !/NaN|Infinity/.test(path.d))
        ).toBe(true)
      } catch (error) {
        failures.push({ preset, error: error.message })
      }
    }
    expect(failures).toEqual([])
  })
  it.each(
    ['circularArrow', 'leftCircularArrow', 'leftRightCircularArrow'].flatMap((preset) =>
      [
        [952500, 762000],
        [2857500, 1905000],
        [1905000, 762000],
      ].map(([width, height]) => ({
        preset,
        width,
        height,
      }))
    )
  )(
    'retains native EMU higher-order source arithmetic for $preset at $width x $height',
    ({ preset, width, height }) => {
      const xml = parse(`<a:prstGeom xmlns:a="${A}" prst="${preset}"><a:avLst/></a:prstGeom>`)
      const geometry = source().readGeometrySource(xml, { ...options, width, height })
      const factor = width / 100
      const small = source().readGeometrySource(xml, {
        ...options,
        width: 100,
        height: height / factor,
      })
      const values = evaluateGeometryGuides(geometry)
      const control = evaluateGeometryGuides(small)
      expect(geometry).toMatchObject({ preset, width, height })
      expect(geometry.guides).toEqual(small.guides)
      expect(geometry.paths).toEqual(small.paths)
      expect(geometry.guides.find((guide) => guide.name === 'q5').formula).toBe('*/ q3 q4 1')
      expect(Object.values(values).every(Number.isFinite)).toBe(true)
      for (const [name, degree] of [
        ['q5', 4],
        ['v5', 4],
        ['q10', 3],
        ['v10', 3],
      ]) {
        if (degree === 4) expect(Math.abs(values[name])).toBeGreaterThan(1e15)
        expect(Math.abs(values[name] / (control[name] * factor ** degree) - 1)).toBeLessThan(1e-12)
      }
      const derived = deriveGeometryPaths(geometry)
      const reference = deriveGeometryPaths(small)
      derived.connections.forEach((site, index) => {
        for (const axis of ['x', 'y'])
          expect(site.position[axis]).toBeCloseTo(
            reference.connections[index].position[axis] * factor,
            7
          )
      })
      for (const path of derived.paths) {
        expect(path.d).not.toMatch(/NaN|Infinity/)
        for (const segment of path.segments)
          for (const point of segment.points)
            expect(
              Object.values(point).every(
                (value) => Number.isFinite(value) && Math.abs(value) <= 1e15
              )
            ).toBe(true)
      }
      const reload = normalizeGeometryDocument(JSON.parse(JSON.stringify(geometry)))
      expect(reload).toEqual(geometry)
      expect(evaluateGeometryGuides(reload)).toEqual(values)
      expect(deriveGeometryPaths(reload)).toEqual(derived)
    }
  )
  it.each([
    `<a:prstGeom xmlns:a="${A}" prst="missing"><a:avLst/></a:prstGeom>`,
    `<a:prstGeom xmlns:a="${A}" prst="rect"><a:avLst><a:gd name="invented" fmla="val 1"/></a:avLst></a:prstGeom>`,
    `<a:custGeom xmlns:a="${A}"><a:pathLst><a:path><a:moveTo><a:pt x="0" y="0"/></a:moveTo><a:invented/></a:path></a:pathLst></a:custGeom>`,
    `<a:custGeom xmlns:a="${A}"><a:gdLst><a:gd name="x" fmla="eval globalThis"/></a:gdLst><a:pathLst/></a:custGeom>`,
  ])('rejects unsupported authored input without false mapping: %s', (xml) => {
    expect(() => source().readGeometrySource(parse(xml), options)).toThrow()
  })
})
