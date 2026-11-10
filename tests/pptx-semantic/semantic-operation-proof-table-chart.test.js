// @vitest-environment node
import { expect } from 'vitest'
import { copy, effective, family, kind, proofSuite, require } from './semantic-operation-proof-helpers.js'
const { createTableRowInsertion, createTableColumnInsertion } = require('../../shared/src/pptx-table-structure-commands')
const proof = proofSuite('feature-fixtures.js')
const table = c => effective(c.presentation, c)
proof('table.cell', kind('table'), c => {
  const cell = table(c).rows[1].cells[0], textDocument = copy(cell.textDocument)
  textDocument.paragraphs[0].runs[0].text = 'Edited cell α'
  textDocument.paragraphs[0].runs[0].properties = { ...textDocument.paragraphs[0].runs[0].properties, bold: true }
  return family(c, { type: 'replaceCellText', cellId: cell.componentId, textDocument })
}, (p, c) => {
  const result = effective(p, c)
  expect(result.rows[1].cells[0].textDocument.paragraphs[0].runs[0]).toMatchObject({ text: 'Edited cell α', properties: { bold: true } })
  expect(result.rows[0]).toEqual(table(c).rows[0])
  expect(result.rows[1].cells[1]).toEqual(table(c).rows[1].cells[1])
}, c => family(c, { type: 'replaceCellText', cellId: 'foreign-cell', textDocument: table(c).rows[1].cells[0].textDocument }))
proof('table.row-column', kind('table'), c => {
  let p = family(c, createTableRowInsertion(table(c), table(c).rows[1].componentId, 'proof-row'))
  p = family(c, createTableColumnInsertion(effective(p, c), table(c).columns[1].componentId, 'proof-column'), p)
  return p
}, (p, c) => {
  const result = effective(p, c)
  expect(result.rows).toHaveLength(3)
  expect(result.columns).toHaveLength(3)
  expect(result.rows.every(row => row.cells.length === 3)).toBe(true)
  expect(result.rows[2].componentId).toContain('~authored:row:proof-row')
  expect(result.columns[2].componentId).toContain('~authored:column:proof-column')
  for (let r = 0; r < 2; r++) expect(result.rows[r].cells.slice(0, 2)).toEqual(table(c).rows[r].cells)
}, c => family(c, { type: 'setRowHeight', rowId: table(c).rows[0].componentId, heightEmu: -1 }))
proof('table.merge', kind('table'), c => family(c, { type: 'mergeCells', startRow: 1, startColumn: 0, rowSpan: 1, columnSpan: 2 }), (p, c) => {
  const result = effective(p, c), source = table(c)
  expect(result.rows[1].cells[0].merge).toEqual({ gridSpan: 2 })
  expect(result.rows[1].cells[1].merge).toEqual({ hMerge: true })
  expect(result.rows[1].cells[1].anchorCellId).toBe(result.rows[1].cells[0].componentId)
  expect(result.rows[1].cells.map(cell => cell.textDocument)).toEqual(source.rows[1].cells.map(cell => cell.textDocument))
  const unmerged = family(c, { type: 'unmergeCell', cellId: result.rows[1].cells[0].componentId }, p)
  expect(effective(unmerged, c)).toEqual(source)
}, c => family(c, { type: 'mergeCells', startRow: 0, startColumn: 0, rowSpan: 2, columnSpan: 2 }))

const chart = c => effective(c.presentation, c)
const series = c => chart(c).plots[0].series[0]
proof('chart.data', kind('chart'), c => {
  const local = family(c, { type: 'chart.data.convert-local', seriesId: series(c).id, channel: 'val', basis: 'cache-snapshot' })
  return family(c, { type: 'chart.data.set-point', seriesId: series(c).id, channel: 'val', index: 1, value: 23.5 }, local)
}, (p, c) => {
  const value = effective(p, c).plots[0].series[0].data.val
  expect(value.kind).toBe('numLit')
  expect(value.cache.points.map(point => point.value)).toEqual([7, 23.5])
  expect(value.detachedFrom).toEqual({ kind: 'numRef', formula: 'Data!$B$2:$B$3', basis: 'cache-snapshot' })
  expect(value).not.toHaveProperty('formula')
  expect(effective(p, c).workbook).toEqual(chart(c).workbook)
}, c => family(c, { type: 'chart.data.set-point', seriesId: series(c).id, channel: 'val', index: 1, value: 99 }))
proof('chart.series', kind('chart'), c => family(c, { type: 'chart.series.rename', seriesId: series(c).id, value: 'Edited series' }), (p, c) => {
  const result = effective(p, c).plots[0].series[0]
  expect(result.data.tx).toEqual({ kind: 'text', value: 'Edited series' })
  expect(result.id).toBe(series(c).id)
  expect(result.data.val).toEqual(series(c).data.val)
  expect(result.data.cat).toEqual(series(c).data.cat)
}, c => family(c, { type: 'chart.series.rename', seriesId: 'missing-series', value: 'invalid' }))
proof('chart.axes', kind('chart'), c => family(c, { type: 'chart.options.set', target: 'axis', axisId: 200, values: { min: -5, max: 40, majorUnit: 5 } }), (p, c) => {
  const result = effective(p, c)
  expect(result.axes.find(a => a.id === 200)).toMatchObject({ scaling: { min: -5, max: 40 }, options: { majorUnit: 5 } })
  expect(result.axes.find(a => a.id === 100)).toEqual(chart(c).axes.find(a => a.id === 100))
  expect(result.plots).toEqual(chart(c).plots)
}, c => family(c, { type: 'chart.options.set', target: 'axis', axisId: 200, values: { min: 40, max: -5 } }))
proof('chart.style', kind('chart'), c => family(c, { type: 'chart.style.set', value: 12 }), (p, c) => {
  expect(effective(p, c).style).toBe(12)
  expect(effective(p, c).plots).toEqual(chart(c).plots)
  expect(effective(p, c).axes).toEqual(chart(c).axes)
}, c => family(c, { type: 'chart.style.set', value: 49 }))
