import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import NativeChartRenderer from '../../client/src/components/native-chart-renderer'
const require = createRequire(import.meta.url)
const { projectChartRender } = require('../../shared/src/pptx-chart-render')
const origin = id => ({ definitionId: id, partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64), path: [0, 1] })
function channel(id, values, strings = false) {
  return { kind: strings ? 'strLit' : 'numLit', cache: { count: values.length,
    points: values.flatMap((value, index) => value === null ? [] : [{ index, value,
      ...(!strings ? { lexicalValue: String(value) } : {}), source: origin(`${id}-${index}`) }]) } }
}
function chart(family, values = [[4, 8], [9, 12], [2, 5], [7, 10]]) {
  const xy = family === 'bubbleChart'
  return { schemaVersion: 1,
    source: { partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64), ownerDefinitionId: 'frame', relationshipId: 'rId1' },
    options: {}, axes: family === 'pie3DChart' ? [] : [
      { id: 1, kind: xy ? 'valAx' : 'catAx', crossAxisId: 2, options: { axPos: 'b', delete: true }, scaling: xy ? { min: 0, max: 20 } : {} },
      { id: 2, kind: 'valAx', crossAxisId: 1, options: { axPos: 'l', delete: true }, scaling: { min: 0, max: 20 } },
    ], plots: [{ family, options: {}, axisIds: family === 'pie3DChart' ? [] : [1, 2],
      series: values.map((v, i) => ({ id: `s${i}`, source: origin(`s${i}`), index: i, order: i, options: {},
        paint: { fill: { kind: 'solid', color: ['112233', '445566', '778899', 'AABBCC'][i] }, line: { fill: { kind: 'solid', color: '102030' }, widthEmu: 9525 } },
        data: xy ? { xVal: channel(`x${i}`, [5, 15]), yVal: channel(`y${i}`, [5, 15]), bubbleSize: channel(`b${i}`, v) }
          : { cat: channel(`c${i}`, ['A', 'B'], true), val: channel(`v${i}`, v) },
      })) }] }
}
const project = (d, width = 400, height = 300) => projectChartRender(d, { width, height })
function svgPoints(svg, kind) {
  return [...svg.matchAll(new RegExp(`<${kind}\\b[^>]*data-chart-[^>]+>`, 'g'))].map(m => m[0])
}
describe('native chart geometry and actual editor SVG consumer', () => {
  it.each(['stockChart', 'surfaceChart', 'surface3DChart', 'bar3DChart', 'line3DChart', 'area3DChart', 'pie3DChart', 'bubbleChart'])('never silently coerces unstyled %s into a Chart.js family', family => {
    const d = chart(family)
    for (const series of d.plots[0].series) delete series.paint
    const result = project(d)
    expect(result.config).toBeUndefined()
    expect(result.supported && !result.svg).toBe(false)
  })
  it('draws ordered OHLC high-low ranges and open-close bodies, not four ordinary lines', () => {
    const d = chart('stockChart')
    d.plots[0].upDownBars = { gapWidth: 150, upBars: d.plots[0].series[0].paint, downBars: d.plots[0].series[3].paint }
    const before = structuredClone(d), result = project(d)
    expect(result.supported).toBe(true)
    expect(result.config).toBeUndefined()
    expect(result.svg).toContain('data-chart-stock="ohlc"')
    expect(result.svg).toMatch(/data-chart-stock-range="0"[^>]*d="M 100 165 L 100 270"/)
    expect(result.svg).toMatch(/data-chart-stock-body="0"[^>]*height="45"/)
    const html = renderToStaticMarkup(<NativeChartRenderer chartDocument={d} width={400} height={300} />)
    expect(html).toContain('data-native-chart-svg')
    expect(html).toContain('data-chart-stock-range="0"')
    expect(html).not.toContain('<iframe')
    expect(d).toEqual(before)
  })
  it.each(['surfaceChart', 'surface3DChart'])('draws %s as connected grid cells and honors wireframe', family => {
    const d = chart(family, [[2, 8], [12, 4]])
    let result = project(d)
    expect(result.supported).toBe(true)
    expect(svgPoints(result.svg, 'polygon').length).toBeGreaterThan(1)
    expect(result.svg).toContain('fill="#112233"')
    expect(result.svg).toContain('fill="#445566"')
    expect(result.svg).toContain('data-chart-surface-cell="0:0"')
    expect(result.svg).not.toContain('<rect data-chart-series')
    d.plots[0].options.wireframe = true
    result = project(d)
    expect(result.svg).toMatch(/data-chart-surface-cell="0:0"[^>]*fill="none"/)
  })
  it.each(['bar3DChart', 'line3DChart', 'area3DChart', 'pie3DChart'])('retains depth geometry for %s instead of a 2D enum', family => {
    const result = project(chart(family, [[4, 8]]))
    expect(result.supported).toBe(true)
    expect(result.config).toBeUndefined()
    expect(result.svg).toContain(`data-chart-family="${family}"`)
    expect(result.svg).toContain('data-chart-face=')
    expect(result.model.projection.depth).toBeGreaterThan(0)
  })
  it('sizes bubbles by area or width, relative to the plot frame and shared magnitude domain', () => {
    const d = chart('bubbleChart', [[1, 4], [16, -4]])
    let result = project(d)
    expect(result.supported).toBe(true)
    const points = result.model.series[0].points
    expect(points[1].radius / points[0].radius).toBeCloseTo(2)
    expect(result.model.series[1].points).toHaveLength(1)
    expect(points[1].radius).toBeLessThan(40)
    expect(project(d, 800, 600).model.series[0].points[1].radius).toBeCloseTo(points[1].radius * 2)
    d.plots[0].options = { sizeRepresents: 'w', bubbleScale: 200, showNegBubbles: true }
    result = project(d)
    expect(result.model.series[0].points[1].radius / result.model.series[0].points[0].radius).toBeCloseTo(4)
    expect(result.model.series[1].points).toHaveLength(2)
    expect(result.svg).toContain('data-chart-bubble-size="-4"')
  })
  it('does not paint a partial stock quotation by joining different sparse category indices', () => {
    const result = project(chart('stockChart', [[4, null], [9, 12], [2, 5], [7, 10]]))
    expect(result.supported).toBe(true)
    expect(result.svg).toContain('data-chart-stock-range="0"')
    expect(result.svg).not.toContain('data-chart-stock-range="1"')
  })
})
it('draws HLC ranges and close ticks without inventing open values or candle bodies', () => {
  const result = project(chart('stockChart', [[9,12],[2,5],[7,10]]))
  expect(result.supported).toBe(true)
  expect(result.svg).toContain('data-chart-stock="hlc"')
  expect(result.svg).toMatch(/data-chart-stock-range="0"[^>]*d="M 100 165 L 100 270"/)
  expect(result.svg).toMatch(/data-chart-stock-close="0"[^>]*d="M 100 195 h 40"/)
  expect(result.svg).not.toContain('data-chart-stock-open=')
  expect(result.svg).not.toContain('data-chart-stock-body=')
})
it('rejects impossible stock role counts instead of drawing a fabricated ordinary line chart', () => {
  const result = project(chart('stockChart', [[1,2],[3,4]]))
  expect(result).toMatchObject({ supported:false, issues:[{ code:'chart-stock-role-count-invalid' }] })
  expect(result.svg).toBeUndefined()
  expect(result.config).toBeUndefined()
})
it('changes real bar mesh vertices for source taper subtype and category-axis reversal', () => {
  const d = chart('bar3DChart', [[4,8]])
  d.view3D = { rotX:20, rotY:40, rAngAx:false, perspective:60 }
  const box = project(d)
  d.plots[0].options.shape = 'coneToMax'
  const cone = project(d)
  expect(cone.supported).toBe(true)
  expect(box.model.series[0].points[0].vertices).toHaveLength(8)
  expect(cone.model.series[0].points[0].vertices).toHaveLength(64)
  const before = cone.model.series[0].points[0].vertices
  d.axes[0].scaling.orientation = 'maxMin'
  expect(project(d).model.series[0].points[0].vertices).not.toEqual(before)
})
