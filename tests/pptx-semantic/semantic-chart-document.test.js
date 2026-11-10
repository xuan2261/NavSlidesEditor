import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { normalizeChartDocument } = require('../../shared/src/pptx-chart-document')

const document = () => ({
  schemaVersion: 1,
  source: { partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64),
    ownerDefinitionId: 'frame8', relationshipId: 'rIdChart' },
  style: 10,
  plots: [{ family: 'pieChart', options: {}, axisIds: [], series: [{
    id: 'series0', source: { definitionId: 'series0', partUri: 'ppt/charts/chart1.xml',
      preconditionHash: 'a'.repeat(64), path: [0, 0, 0, 0, 0] },
    index: 0, order: 0, options: {}, data: {
      val: { kind: 'numRef', formula: 'Sheet1!$A$1', cache: { count: 1, points: [{
        index: 0, value: 7, lexicalValue: '7', source: { definitionId: 'point0',
          partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64), path: [0, 1] },
      }] } },
    },
  }] }],
  axes: [], options: {},
})

describe('canonical source chart document', () => {
  it('round trips typed caches and formula metadata without making them project-local', () => {
    const input = document()
    const result = normalizeChartDocument(input)
    expect(normalizeChartDocument(JSON.parse(JSON.stringify(result)))).toEqual(input)
    expect(result).not.toBe(input)
    expect(result.plots[0].series[0].data.val.kind).toBe('numRef')
  })
  it.each([
    (d) => { d.schemaVersion = 2 },
    (d) => { d.plots[0].family = 'Chart.js-bar' },
    (d) => { d.plots[0].series.push(d.plots[0].series[0]) },
    (d) => { d.plots[0].series[0].data.val.cache.count = 0 },
    (d) => { d.plots[0].series[0].data.val.cache.points[0].value = Infinity },
    (d) => { d.plots[0].series[0].data.val.formula = '' },
    (d) => { d.source.adapterQualified = true },
    (d) => { d.plots[0].options.unknown = 1 },
    (d) => { d.plots[0].series[0].source.preconditionHash = 'b'.repeat(64) },
    (d) => { d.plots[0].series[0].data.val.cache.points[0].source.partUri = 'ppt/charts/other.xml' },
    (d) => {
      const point = d.plots[0].series[0].data.val.cache.points[0]
      point.value = 7
      point.lexicalValue = '0x7'
    },
  ])('rejects malformed or authority-bearing canonical data', (mutate) => {
    const input = document()
    mutate(input)
    expect(() => normalizeChartDocument(input)).toThrow(/chart/i)
  })
})
