import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const edit = (d, op) => require('../../shared/src/pptx-chart-operations').applyChartOperation(d, op)
const source = (id) => ({
  definitionId: id, partUri: 'ppt/charts/chart1.xml',
  preconditionHash: 'a'.repeat(64), path: [0, 1],
})
const chart = () => ({
  schemaVersion: 1,
  source: { partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64),
    ownerDefinitionId: 'frame', relationshipId: 'rId1' },
  options: {}, style: 10, axes: [
    { id: 1, kind: 'catAx', crossAxisId: 2, options: {} },
    { id: 2, kind: 'valAx', crossAxisId: 1, options: {}, scaling: { min: -5, max: 20 } },
  ],
  plots: [{ family: 'barChart', options: { barDir: 'col', grouping: 'clustered' },
    axisIds: [1, 2], series: [{ id: 's1', source: source('s1'), index: 0, order: 0,
      options: {}, data: {
        tx: { kind: 'text', value: 'Revenue' },
        val: { kind: 'numRef', formula: 'Sheet1!$A$1:$A$3',
          cache: { count: 3, points: [
            { index: 0, value: 7, lexicalValue: '7.0', source: source('p0') },
            { index: 2, value: -2, lexicalValue: '-2', source: source('p2') },
          ] } },
      } }] }],
})
const convert = { type: 'chart.data.convert-local', seriesId: 's1', channel: 'val',
  basis: 'cache-snapshot' }
const point = { type: 'chart.data.set-point', seriesId: 's1', channel: 'val', index: 2, value: 12 }

describe('source-bound chart edit commands', () => {
  it('requires explicit reference conversion and leaves Original and siblings immutable', () => {
    const original = chart(), snapshot = JSON.stringify(original)
    expect(() => edit(original, point)).toThrow(/convert|reference/i)
    const local = edit(original, convert)
    const result = edit(JSON.parse(JSON.stringify(local)), point)
    expect(JSON.stringify(original)).toBe(snapshot)
    expect(local.plots[0].series[0].data.val.cache.points[1].value).toBe(-2)
    expect(result.plots[0].series[0].data.val.kind).toBe('numLit')
    expect(result.plots[0].series[0].data.val.formula).toBeUndefined()
    expect(result.plots[0].series[0].data.val.cache.points.map(p => p.index)).toEqual([0, 2])
    expect(result.plots[0].series[0].data.val.cache.points[1]).toMatchObject({
      value: 12, lexicalValue: '12', source: source('p2'),
    })
    expect(result.source).toEqual(original.source)
    expect(result.plots[0].options).toEqual(original.plots[0].options)
    expect(result.plots[0].series[0].data.val.detachedFrom).toEqual({
      kind: 'numRef', formula: 'Sheet1!$A$1:$A$3', basis: 'cache-snapshot',
    })
  })
  it('persists and validates detachment provenance across canonical document normalization', () => {
    const { normalizeChartDocument } = require('../../shared/src/pptx-chart-document')
    const local = edit(chart(), convert)
    const roundtripped = normalizeChartDocument(JSON.parse(JSON.stringify(local)))
    expect(roundtripped.plots[0].series[0].data.val.detachedFrom).toEqual({
      kind: 'numRef', formula: 'Sheet1!$A$1:$A$3', basis: 'cache-snapshot',
    })
    expect(() => {
      const malformed = JSON.parse(JSON.stringify(local))
      malformed.plots[0].series[0].data.val.detachedFrom.kind = 'strRef'
      normalizeChartDocument(malformed)
    }).toThrow(/provenance|contract/i)
  })
  it('refuses to convert hierarchical category references into flat local data', () => {
    const d = chart()
    d.plots[0].series[0].data.cat = {
      kind: 'multiLvlStrRef', formula: 'Sheet1!$B$1:$C$3',
      cache: { count: 2, levels: [
        { source: { partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64), path: [0, 1] },
          points: [{ index: 0, value: 'Q1', source: { ...source('lvl0-0'), path: [0, 1, 0] } }] },
      ] },
    }
    expect(() => edit(d, { type: 'chart.data.convert-local', seriesId: 's1', channel: 'cat', basis: 'cache-snapshot' }))
      .toThrow(/hierarchical|reference/i)
  })
  it('converts referenced chart title and axis titles with explicit detached provenance', () => {
    const d = chart()
    d.title = { kind: 'strRef', formula: 'Sheet1!$Z$1',
      cache: { count: 1, points: [{ index: 0, value: 'Original Title', source: source('t0') }] } }
    d.axes[1].title = { kind: 'strRef', formula: 'Sheet1!$Z$2',
      cache: { count: 1, points: [{ index: 0, value: 'Original Axis', source: source('at0') }] } }
    expect(() => edit(d, { type: 'chart.title.set', value: 'New Title' })).toThrow(/convert|reference/i)
    const withTitle = edit(d, { type: 'chart.title.convert-local', basis: 'cache-snapshot' })
    expect(withTitle.title.kind).toBe('strLit')
    expect(withTitle.title.detachedFrom).toEqual({ kind: 'strRef', formula: 'Sheet1!$Z$1', basis: 'cache-snapshot' })
    const titleEdited = edit(withTitle, { type: 'chart.title.set', value: 'Renamed Title' })
    expect(titleEdited.title.cache.points[0].value).toBe('Renamed Title')
    expect(titleEdited.title.cache.points[0].source).toEqual(source('t0'))

    expect(() => edit(d, { type: 'chart.axis.title.set', axisId: 2, value: 'New Axis' })).toThrow(/convert|reference/i)
    const withAxis = edit(titleEdited, { type: 'chart.axis.title.convert-local', axisId: 2, basis: 'cache-snapshot' })
    expect(withAxis.axes[1].title.kind).toBe('strLit')
    expect(withAxis.axes[1].title.detachedFrom).toEqual({ kind: 'strRef', formula: 'Sheet1!$Z$2', basis: 'cache-snapshot' })
    const axisEdited = edit(withAxis, { type: 'chart.axis.title.set', axisId: 2, value: 'Renamed Axis' })
    expect(axisEdited.axes[1].title.cache.points[0].value).toBe('Renamed Axis')
    expect(axisEdited.axes[1].title.cache.points[0].source).toEqual(source('at0'))
  })
  it.each([
    { ...point, index: 1 }, { ...point, value: Infinity }, { ...point, value: '2' },
    { ...point, seriesId: 'other' }, { ...point, channel: '__proto__' },
    { ...point, source: source('forged') }, { ...point, value: '=SUM(A1)' },
    { ...convert, basis: 'formula-evaluation' },
    { type: 'chart.options.set', target: 'axis', axisId: 2, values: { min: 30 } },
    { type: 'chart.options.set', target: 'series', seriesId: 's1', values: { unknown: true } },
    { type: 'chart.style.set', value: 49 },
    { type: 'chart.options.set', target: 'plot', plotIndex: 0, values: { scatterStyle: 'smooth' } },
    { type: 'chart.options.set', target: 'plot', plotIndex: 0, values: { holeSize: 30 } },
    { type: 'chart.options.set', target: 'series', seriesId: 's1', values: { explosion: 10 } },
    { type: 'chart.options.set', target: 'axis', axisId: 1, values: { min: 0 } },
    { type: 'chart.options.set', target: 'axis', axisId: 1, values: { logBase: 10 } },
    { type: 'chart.marker.set', seriesId: 's1', values: { symbol: 'picture' } },
    { type: 'chart.view3D.set', values: { rotX: 15 } },
  ])('rejects malformed commands atomically %#', op => {
    const input = edit(chart(), convert), before = JSON.stringify(input)
    expect(() => edit(input, op)).toThrow(TypeError)
    expect(JSON.stringify(input)).toBe(before)
  })
  it('edits labels, axis limits, legend, and style without changing source family', () => {
    let d = edit(chart(), { type: 'chart.series.rename', seriesId: 's1', value: 'Costs' })
    d = edit(d, { type: 'chart.title.set', value: 'Budget <2026>' })
    d = edit(d, { type: 'chart.options.set', target: 'axis', axisId: 2, values: { min: -10, max: 40 } })
    d = edit(d, { type: 'chart.options.set', target: 'legend', values: { legendPos: 'b' } })
    d = edit(d, { type: 'chart.style.set', value: 12 })
    expect(d.plots[0].family).toBe('barChart')
    expect(d.plots[0].series[0].data.tx.value).toBe('Costs')
    expect(d.axes[1].scaling).toEqual({ min: -10, max: 40 })
    expect(d.legend).toEqual({ legendPos: 'b' })
    expect(d.title.value).toBe('Budget <2026>')
    expect(d.style).toBe(12)
  })
  it('does not silently rename referenced series titles', () => {
    const d = chart()
    d.plots[0].series[0].data.tx = { kind: 'strRef', formula: 'Sheet1!B1' }
    expect(() => edit(d, { type: 'chart.series.rename', seriesId: 's1', value: 'Detached' }))
      .toThrow(/convert|reference/i)
  })
  it('retains source point identities when renaming converted series labels', () => {
    const d = chart()
    d.plots[0].series[0].data.tx = { kind: 'strRef', formula: 'Sheet1!B1',
      cache: { count: 1, points: [{ index: 0, value: 'Old', source: source('name-point') }] } }
    const local = edit(d, { ...convert, channel: 'tx' })
    const result = edit(local, { type: 'chart.series.rename', seriesId: 's1', value: 'New' })
    expect(result.plots[0].series[0].data.tx.cache.points[0]).toEqual({
      index: 0, value: 'New', source: source('name-point'),
    })
  })
  it('retains denied external workbook metadata through explicit local conversion', () => {
    const d = chart()
    d.workbook = { source: source('workbook'), relationshipId: 'rIdWorkbook',
      target: 'https://example.test/data.xlsx', external: true, autoUpdate: true, fetchPolicy: 'deny' }
    expect(() => edit(d, point)).toThrow(/convert|reference/i)
    const next = edit(edit(d, convert), point)
    expect(next.workbook).toEqual(d.workbook)
    expect(next.workbook).not.toBe(d.workbook)
    expect(next.source.preconditionHash).toBe('a'.repeat(64))
  })
  it('rejects clustered grouping on non-bar charts', () => {
    const d = chart()
    d.plots[0].family = 'lineChart'
    d.plots[0].options = { grouping: 'standard' }
    expect(() => edit(d, { type: 'chart.options.set', target: 'plot', plotIndex: 0, values: { grouping: 'clustered' } }))
      .toThrow(/unsupported lineChart option/i)
  })
  it('sets line and scatter markers without altering non-marker families', () => {
    const d = chart()
    d.plots[0].family = 'lineChart'
    d.plots[0].options = { grouping: 'standard' }
    const marked = edit(d, { type: 'chart.marker.set', seriesId: 's1', values: { symbol: 'diamond', size: 10 } })
    expect(marked.plots[0].series[0].marker).toEqual({ symbol: 'diamond', size: 10 })
    expect(() => edit(chart(), { type: 'chart.marker.set', seriesId: 's1', values: { symbol: 'diamond' } }))
      .toThrow(/unsupported family marker/i)
  })
  it('sets point styles on existing data points atomically', () => {
    const d = edit(chart(), convert)
    const colored = edit(d, {
      type: 'chart.point.paint.set', seriesId: 's1', index: 2,
      value: { fill: { kind: 'solid', color: 'FF0000' } },
    })
    expect(colored.plots[0].series[0].pointStyles).toEqual([
      { index: 2, options: {}, paint: { fill: { kind: 'solid', color: 'FF0000' } } },
    ])
    expect(() => edit(d, {
      type: 'chart.point.paint.set', seriesId: 's1', index: 99,
      value: { fill: { kind: 'solid', color: 'FF0000' } },
    })).toThrow(/existing point identity/i)
  })
  it('sets 3D view angles on represented 3D families and rejects invalid coordinates', () => {
    const d = chart()
    d.plots[0].family = 'bar3DChart'
    d.plots[0].options = { barDir: 'col', grouping: 'clustered' }
    const with3D = edit(d, { type: 'chart.view3D.set', values: { rotX: 30, rotY: 45, rAngAx: true } })
    expect(with3D.view3D).toEqual({ rotX: 30, rotY: 45, rAngAx: true })
    expect(() => edit(with3D, { type: 'chart.view3D.set', values: { rotX: 120 } }))
      .toThrow(/view3D/i)
  })
})
