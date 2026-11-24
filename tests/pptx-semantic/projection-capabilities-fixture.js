// Synthetic source-bound operation fixture, not chart-family import/native evidence.
export function chartProjectionFixture() {
  const source = {
    partUri: 'ppt/charts/chart1.xml', nativeId: 'chart-1', preconditionHash: 'a'.repeat(64),
  }
  const chartData = {
    labels: ['A', 'B'],
    datasets: [{ componentId: 'series-17', label: 'Revenue', data: [10, 20], color: '#6366f1' }],
  }
  const element = (id) => ({
    id, type: 'chart', pptxInstanceId: id, chartType: 'bar',
    x: 0, y: 0, width: 400, height: 300, chartData: structuredClone(chartData),
    _pptxChartMeta: { originalType: 'barChart', preservationTier: 'preserve-only',
      adapterQualified: false, transactionEligible: false, level4Promoted: false },
  })
  const instance = (id, slideId) => ({
    id, slideId, definitionId: 'chart-definition', parentInstanceId: null,
    localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {},
  })
  return {
    id: 'projection-chart-deck', title: 'Chart projection',
    slides: [{ id: 's1', elements: [element('i1')] }, { id: 's2', elements: [element('i2')] }],
    pptxSemantic: {
      schemaVersion: 1, styles: {}, fonts: {},
      definitions: {
        'chart-definition': {
          id: 'chart-definition', kind: 'chart', source,
          components: [{ id: 'series-17', kind: 'series',
            locator: { path: [0, 0, 0, 0], preconditionHash: source.preconditionHash } }],
          content: { extent: { cx: 3810000, cy: 2857500 },
            chartProjection: { schemaVersion: 1, dataMode: 'literal', chartType: 'bar', chartData } },
        },
      },
      instances: { i1: instance('i1', 's1'), i2: instance('i2', 's2') },
    },
  }
}

export const valuesOperation = (values = [11, 22]) => ({
  type: 'chart.series.set-values', instanceId: 'i1', componentId: 'series-17', values,
})
