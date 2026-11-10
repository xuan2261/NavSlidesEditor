import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const project = (d, options = {}) => require('../../shared/src/pptx-chart-render').projectChartRender(d, { width: 400, height: 300, ...options })
const chart = () => ({
  schemaVersion: 1, source: { partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64), ownerDefinitionId: 'frame', relationshipId: 'rId1' },
  options: {}, axes: [], plots: [{ family: 'pieChart', options: { firstSliceAng: 90 }, axisIds: [], series: [{
    id: 's', source: { definitionId: 's', partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64), path: [0, 1] },
    index: 7, order: 2, options: {}, paint: { fill: { kind: 'solid', color: 'AA0000' } },
    pointStyles: [{ index: 2, options: {}, paint: { fill: { kind: 'solid', color: '00AA00' } } }],
    data: { val: { kind: 'numLit', cache: { count: 3, points: [0, 2].map(index => ({
      index, value: index ? 3 : 1, lexicalValue: index ? '3' : '1',
      source: { definitionId: `p${index}`, partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64), path: [0, 2, index] },
    })) } } },
  }] }],
})
describe('source chart SVG drawing', () => {
  it('draws sparse points with their source paints and first-slice angle, not an invented palette', () => {
    const d = chart(), before = structuredClone(d)
    const result = project(d)
    expect(result.supported).toBe(true)
    expect(result.config).toBeUndefined()
    expect(result.svg).toContain('data-chart-point="2"')
    expect(result.svg).not.toContain('data-chart-point="1"')
    expect(result.svg).toContain('fill="#00AA00"')
    expect(result.svg).toContain('fill="#AA0000"')
    expect(result.model.series[0].points.map(p => [p.index, p.startAngle, p.endAngle])).toEqual([[0, 90, 180], [2, 180, 450]])
    expect(d).toEqual(before)
  })
  it('rejects missing paint and unavailable source font instead of silently substituting', () => {
    const d = chart()
    d.plots[0].series[0].paint = {}
    expect(project(d)).toMatchObject({ supported: false })
    d.plots[0].series[0].paint.fill = { kind: 'solid', color: 'AA0000' }
    d.title = { kind: 'text', value: 'Title', textStyle: { fontFamily: 'Arial', fontSizePt: 12, color: '000000', bold: false, italic: false } }
    const result = project(d)
    expect(result).toMatchObject({ supported: false, issues: [{ code: 'chart-font-runtime-unavailable', path: 'title' }] })
    expect(result.svg).toBeUndefined()
  })
  it('applies typed source paint edits without changing native point or series identities', () => {
    const { applyChartOperation } = require('../../shared/src/pptx-chart-operations')
    const d = chart()
    const edited = applyChartOperation(d, { type: 'chart.paint.set', target: 'series', seriesId: 's', value: { fill: { kind: 'solid', color: '112233' } } })
    expect(project(edited).svg).toContain('fill="#112233"')
    expect(edited.plots[0].series[0].source).toEqual(d.plots[0].series[0].source)
    expect(() => applyChartOperation(d, { type: 'chart.paint.set', target: 'series', seriesId: 's', value: { source: {} } })).toThrow()
    expect(() => applyChartOperation(d, { type: 'chart.paint.set', target: 'series', seriesId: 's',
      value: { fill: { kind: 'solid', color: 112233 } } })).toThrow()
  })
  it('keeps unresolved native style codes unsupported on the source SVG path', () => {
    const d = chart()
    d.style = 10
    expect(project(d).supported).toBe(false)
  })
  it('uses source category slots, explicit bounds and line direction without renumbering sparse points', () => {
    const d = chart(), plot = d.plots[0], series = plot.series[0]
    plot.family = 'barChart'; plot.options = { grouping: 'clustered', gapWidth: 150 }; plot.axisIds = [10, 20]
    series.data.cat = { kind: 'strLit', cache: { count: 3, points: series.data.val.cache.points.map(p => ({
      index: p.index, value: `C${p.index}`, source: { ...p.source, definitionId: `c${p.index}`, path: [0, 3, p.index] },
    })) } }
    d.axes = [
      { id: 10, kind: 'catAx', crossAxisId: 20, options: { axPos: 'b', delete: true }, scaling: { orientation: 'maxMin' } },
      { id: 20, kind: 'valAx', crossAxisId: 10, options: { axPos: 'l', delete: true, majorUnit: 2 }, scaling: { min: 0, max: 10 } },
    ]
    const result = project(d)
    expect(result.supported).toBe(true)
    expect(result.model.series[0].points.map(p => p.index)).toEqual([0, 2])
    expect(result.model.series[0].points[0].x).toBeGreaterThan(result.model.series[0].points[1].x)
    expect(result.model.series[0].points.map(p => p.y)).toEqual([270, 210])
    expect(result.svg).toContain('fill="#00AA00"')
    delete d.axes[1].scaling.max
    expect(project(d)).toMatchObject({ supported: false, issues: [{ code: 'chart-auto-axis-bounds-unresolved' }] })
  })
  it('joins scatter X/Y by native index and preserves missing pairs', () => {
    const d = chart(), plot = d.plots[0], series = plot.series[0]
    plot.family = 'scatterChart'; plot.options = { scatterStyle: 'line' }; plot.axisIds = [10, 20]
    series.paint.line = { widthEmu: 9525, fill: { kind: 'solid', color: '445566' } }
    series.data.yVal = series.data.val; delete series.data.val
    series.data.xVal = { kind: 'numLit', cache: { count: 3, points: [{
      index: 2, value: 20, lexicalValue: '20',
      source: { ...series.source, definitionId: 'x2', path: [0, 3, 2] },
    }] } }
    d.axes = [
      { id: 10, kind: 'valAx', crossAxisId: 20, options: { axPos: 'b', delete: true, majorUnit: 5 }, scaling: { min: 0, max: 20 } },
      { id: 20, kind: 'valAx', crossAxisId: 10, options: { axPos: 'l', delete: true, majorUnit: 2 }, scaling: { min: 0, max: 10 } },
    ]
    const result = project(d)
    expect(result.model.series[0].points).toEqual([{ index: 2, value: 3, x: 400, y: 210 }])
    expect(result.svg).toContain('stroke="#445566"')
  })
})
