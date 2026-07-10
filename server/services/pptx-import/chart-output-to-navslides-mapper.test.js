/**
 * Unit tests for chart-output-to-navslides-mapper.js
 *
 * Tests mapChart, mapScatterChart for metadata fidelity:
 * legend position, axis titles, combo chart detection,
 * scatter vs line chart disambiguation, and 3D handling.
 */
const { mapChart, mapChartType } = require('./chart-output-to-navslides-mapper')

function makeChart(overrides = {}) {
  return {
    type: 'chart',
    chartType: 'bar',
    data: [
      { key: 'Series 1', values: [{ x: 'A', y: 10 }, { x: 'B', y: 20 }] },
    ],
    colors: ['#6366f1'],
    ...overrides,
  }
}

describe('mapChartType', () => {
  it('detects line', () => {
    expect(mapChartType('clusteredBar')).toBe('bar')
    expect(mapChartType('stackedBar')).toBe('bar')
    expect(mapChartType('bar')).toBe('bar')
  })

  it('keeps polarAreaChart native instead of broad area coercion', () => {
    expect(mapChartType('polarAreaChart')).toBe('polarArea')
  })
})

describe('mapChart', () => {
  it('maps legendPos to element.legend', () => {
    const chart = makeChart({ legendPos: 'r' })
    const result = mapChart(chart)
    expect(result.legend).toBe('r')
  })

  it('maps legendPos bottom', () => {
    const chart = makeChart({ legendPos: 'b' })
    const result = mapChart(chart)
    expect(result.legend).toBe('b')
  })

  it('maps legendPos top', () => {
    const chart = makeChart({ legendPos: 't' })
    const result = mapChart(chart)
    expect(result.legend).toBe('t')
  })

  it('maps xAxis.title to element.xAxisTitle', () => {
    const chart = makeChart({ xAxis: { title: 'Revenue ($)' } })
    const result = mapChart(chart)
    expect(result.xAxisTitle).toBe('Revenue ($)')
  })

  it('maps yAxis.title to element.yAxisTitle', () => {
    const chart = makeChart({ yAxis: { title: 'Count' } })
    const result = mapChart(chart)
    expect(result.yAxisTitle).toBe('Count')
  })

  it('detects combo chart via secondary Y axis', () => {
    const chart = makeChart({
      chartType: 'combo',
      data: [
        { key: 'Sales', values: [{ x: 'Q1', y: 100 }] },
        { key: 'Target', values: [{ x: 'Q1', y: 80 }] },
      ],
    })
    const result = mapChart(chart)
    expect(result.chartType).toBe('bar')
    expect(result._pptxChartMeta.comboDetected).toBe(true)
  })

  it('ignores 3D settings when absent', () => {
    const chart = makeChart()
    const result = mapChart(chart)
    expect(result._pptxChartMeta.is3D).toBeNull()
  })

  it('passes through 3D flag when present', () => {
    const chart = makeChart({ is3D: true, view3D: { rotX: 30 } })
    const result = mapChart(chart)
    expect(result._pptxChartMeta.is3D).toBe(true)
  })

  it('returns null for non-chart element', () => {
    expect(mapChart({ type: 'shape' })).toBeNull()
    expect(mapChart(null)).toBeNull()
    expect(mapChart(undefined)).toBeNull()
  })

  it('preserves chartData labels and datasets', () => {
    const chart = makeChart({
      data: [
        { key: 'Alpha', values: [{ x: 'Jan', y: 1 }, { x: 'Feb', y: 2 }] },
        { key: 'Beta', values: [{ x: 'Jan', y: 3 }, { x: 'Feb', y: 4 }] },
      ],
    })
    const result = mapChart(chart)
    expect(result.chartData.labels).toEqual(['Jan', 'Feb'])
    expect(result.chartData.datasets).toHaveLength(2)
    expect(result.chartData.datasets[0].label).toBe('Alpha')
    expect(result.chartData.datasets[0].data).toEqual([1, 2])
    expect(result.chartData.datasets[1].label).toBe('Beta')
    expect(result.chartData.datasets[1].data).toEqual([3, 4])
  })

  it('maps chart with no colors to default palette', () => {
    const chart = { ...makeChart(), colors: [] }
    const result = mapChart(chart)
    expect(result.chartData.datasets[0].color).toBe('#6366f1') // first default color
  })

  it('maps bar chart type', () => {
    const chart = makeChart({ chartType: 'clusteredBar' })
    const result = mapChart(chart)
    expect(result.chartType).toBe('bar')
  })

  it('maps pie chart type', () => {
    const chart = makeChart({ chartType: 'pie' })
    const result = mapChart(chart)
    expect(result.chartType).toBe('pie')
  })

  it('maps doughnut chart type', () => {
    const chart = makeChart({ chartType: 'doughnut' })
    const result = mapChart(chart)
    expect(result.chartType).toBe('doughnut')
  })

  it('maps line chart type', () => {
    const chart = makeChart({ chartType: 'line' })
    const result = mapChart(chart)
    expect(result.chartType).toBe('line')
  })

  it('maps radar chart type', () => {
    const chart = makeChart({ chartType: 'radar' })
    const result = mapChart(chart)
    expect(result.chartType).toBe('radar')
  })

  it('emits stacked:true for a stacked grouping bar chart', () => {
    const chart = makeChart({ chartType: 'barChart', grouping: 'stacked' })
    const result = mapChart(chart)
    expect(result.chartType).toBe('bar')
    expect(result.stacked).toBe(true)
    expect(result.areaFill).toBeUndefined()
  })

  it('maps an area chart to a filled line', () => {
    const chart = makeChart({ chartType: 'areaChart', grouping: 'standard' })
    const result = mapChart(chart)
    expect(result.chartType).toBe('line')
    expect(result.areaFill).toBe(true)
    expect(result.stacked).toBeUndefined()
  })

  it('does not set stacked/areaFill for a plain clustered bar', () => {
    const chart = makeChart({ chartType: 'barChart', grouping: 'clustered' })
    const result = mapChart(chart)
    expect(result.chartType).toBe('bar')
    expect(result.stacked).toBeUndefined()
    expect(result.areaFill).toBeUndefined()
  })

  it('does not set areaFill for a plain line chart', () => {
    const chart = makeChart({ chartType: 'lineChart', grouping: 'standard' })
    const result = mapChart(chart)
    expect(result.chartType).toBe('line')
    expect(result.areaFill).toBeUndefined()
  })
})

describe('mapScatterChart', () => {
  it('does not confuse 2-series line chart with scatter (Format B fallback)', () => {
    // A 2-series line chart has data in "key/values" format — not native scatter [x,y] arrays
    const chart = {
      type: 'chart',
      chartType: 'line',
      data: [
        { key: 'Series 1', values: [{ x: 'A', y: 10 }, { x: 'B', y: 20 }] },
        { key: 'Series 2', values: [{ x: 'A', y: 15 }, { x: 'B', y: 25 }] },
      ],
    }
    const result = mapChart(chart)
    // Should NOT be treated as scatter (which would try Format A: [x-values], [y-values])
    // Instead, falls through to Format B (commonChart format) as a line chart
    expect(result.chartType).toBe('line')
    expect(result.chartData.datasets).toHaveLength(2)
    expect(result.chartData.datasets[0].data).toEqual([10, 20])
    expect(result.chartData.datasets[1].data).toEqual([15, 25])
  })

  it('maps native scatter Format A (parallel [x,y] arrays)', () => {
    const chart = {
      type: 'chart',
      chartType: 'scatterChart',
      data: [[1, 2, 3], [4, 5, 6]], // Format A: x-values, y-values
    }
    const result = mapChart(chart)
    expect(result.chartType).toBe('line') // scatter maps to 'line' in NavSlides
    expect(result.chartData.labels).toEqual(['1', '2', '3'])
    expect(result.chartData.datasets[0].data).toEqual([4, 5, 6])
  })

  it('handles empty data gracefully', () => {
    const chart = { type: 'chart', chartType: 'bar', data: [] }
    const result = mapChart(chart)
    expect(result.chartData.labels).toEqual([])
    expect(result.chartData.datasets).toEqual([])
  })
})
