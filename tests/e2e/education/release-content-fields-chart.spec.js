import { test, expect } from '../fixtures/test-fixtures.js'
import {
  contentFixture,
  setupContent,
  inspector,
  fillControl,
  reloadContent,
  fieldEvidence,
  withPresent,
} from './release-content-fields.js'
import { findFrame } from './release-surfaces.js'

async function inspectPlot(page) {
  const frame = await findFrame(page, 'canvas#c')
  await frame.waitForFunction(() => window.Chart?.getChart(document.querySelector('canvas#c')))
  const plot = await frame.evaluate(() => {
    const chart = window.Chart.getChart(document.querySelector('canvas#c'))
    const pixels = chart.ctx.getImageData(0, 0, chart.width, chart.height).data
    let areaPixels = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 2] > pixels[i] + 50 && pixels[i + 2] > pixels[i + 1] && pixels[i + 3] > 50)
        areaPixels++
    }
    return {
      type: chart.config.type,
      labels: chart.data.labels,
      values: chart.data.datasets.map((item) => item.data),
      fill: chart.data.datasets[0].fill,
      stacked: { x: chart.scales.x.options.stacked, y: chart.scales.y.options.stacked },
      points: chart.data.datasets.map((dataset, index) =>
        chart.getDatasetMeta(index).data.map((point, i) => ({
          x: point.x,
          y: point.y,
          expectedX: chart.scales.x.getPixelForValue(i),
          expectedY: chart.scales.y.getPixelForValue(
            dataset.data[i] + (index ? chart.data.datasets[0].data[i] : 0)
          ),
        }))
      ),
      legend: {
        position: chart.legend.options.position,
        align: chart.legend.options.align,
        labels: chart.legend.legendItems.map((item) => item.text),
        top: chart.legend.top,
        plotTop: chart.chartArea.top,
      },
      axis: {
        category: chart.scales.x.options.title.text,
        value: chart.scales.y.options.title.text,
      },
      areaPixels,
    }
  })
  expect(plot.type).toBe('line')
  expect(plot.labels).toEqual(['Alpha', 'Beta', 'Gamma'])
  expect(plot.values).toEqual([
    [2, 4, 3],
    [3, 2, 5],
  ])
  expect(plot.fill).toBe(true)
  expect(plot.stacked).toEqual({ x: true, y: true })
  for (const series of plot.points)
    for (const point of series) {
      expect(point.x).toBeCloseTo(point.expectedX, 2)
      expect(point.y).toBeCloseTo(point.expectedY, 2)
    }
  expect(plot.areaPixels).toBeGreaterThan(300)
  expect(plot.legend).toMatchObject({
    position: 'top',
    align: 'end',
    labels: ['Baseline', 'Added'],
  })
  expect(plot.legend.top).toBeLessThan(plot.legend.plotTop)
  expect(plot.axis).toEqual({ category: 'Lesson category', value: 'Stacked quantity' })
  return plot
}

test('chart controls qualify plotted values area stacking legend and axes after reload [cap:element.chart.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('chart', { width: 900, height: 500 })
  await setupContent(page, request, testPresentation.id, element)
  const panel = inspector(page)
  await panel.getByLabel('Chart type', { exact: true }).selectOption('line')
  await panel.getByTestId('prop-chart-area-fill').check()
  await panel.getByTestId('prop-chart-stacked').check()
  await panel.getByLabel('Legend position', { exact: true }).selectOption('topRight')
  await fillControl(page, 'category axis title', 'Lesson category')
  await fillControl(page, 'value axis title', 'Stacked quantity')
  await fillControl(page, 'Chart category labels', 'Alpha, Beta, Gamma')
  await fillControl(page, 'Chart series 1 label', 'Baseline')
  await fillControl(page, 'Chart series 1 values', '2, 4, 3')
  await fillControl(page, 'Chart series 1 color', '#2563eb')
  await panel.getByTestId('prop-chart-add-series').click()
  await fillControl(page, 'Chart series 2 label', 'Added')
  await fillControl(page, 'Chart series 2 values', '3, 2, 5')
  await fillControl(page, 'Chart series 2 color', '#16324f')
  const patch = {
    chartType: 'line',
    areaFill: true,
    stacked: true,
    legendPosition: 'topRight',
    chartData: {
      labels: ['Alpha', 'Beta', 'Gamma'],
      datasets: [
        { label: 'Baseline', data: [2, 4, 3], color: '#2563eb' },
        { label: 'Added', data: [3, 2, 5], color: '#16324f' },
      ],
    },
    axisTitles: { category: 'Lesson category', value: 'Stacked quantity' },
  }
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, patch)
  const canvas = await inspectPlot(page)
  await withPresent(page, async (present) => {
    const generated = await inspectPlot(present)
    const screenshot = testInfo.outputPath('chart-field-generated.png')
    await present.screenshot({ path: screenshot })
    await fieldEvidence(
      testInfo,
      page,
      'chart',
      [
        'chartType',
        'chartData',
        'areaFill',
        'stacked',
        'legendPosition',
        'axisTitles',
        'data',
        'area',
        'stack',
        'legend',
        'axis',
      ],
      patch,
      { persisted, canvas, generated },
      [screenshot]
    )
  })
})
