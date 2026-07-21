import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ChartProperties from './chart-properties'

const chart = {
  id: 'chart-1',
  type: 'chart',
  chartType: 'line',
  chartData: {
    labels: ['Q1', 'Q2'],
    datasets: [{ label: 'Revenue', data: [10, 20], color: '#6366f1' }],
  },
}

describe('ChartProperties', () => {
  it('[cap:element.chart depth:behavior] exposes the supported chart type set without scatter', () => {
    render(<ChartProperties element={chart} onUpdate={vi.fn()} />)

    const values = Array.from(screen.getByTestId('prop-chart-type').querySelectorAll('option')).map((option) => option.value)
    expect(values).toEqual(['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'])
    expect(values).not.toContain('scatter')
  })

  it('[cap:element.chart depth:behavior] writes chart type, labels, series label, values, and color', () => {
    const onUpdate = vi.fn()
    render(<ChartProperties element={chart} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-chart-type'), { target: { value: 'bar' } })
    fireEvent.change(screen.getByTestId('prop-chart-labels'), { target: { value: 'Jan, Feb, Mar' } })
    fireEvent.change(screen.getByTestId('prop-chart-series-label-0'), { target: { value: 'Cost' } })
    fireEvent.change(screen.getByTestId('prop-chart-values-0'), { target: { value: '1, 2, bad, 4' } })
    fireEvent.change(screen.getByTestId('prop-chart-color-0'), { target: { value: '#22c55e' } })

    expect(onUpdate).toHaveBeenCalledWith({ chartType: 'bar' })
    expect(onUpdate).toHaveBeenCalledWith({
      chartData: { ...chart.chartData, labels: ['Jan', 'Feb', 'Mar'] },
    })
    expect(onUpdate).toHaveBeenCalledWith({
      chartData: { ...chart.chartData, datasets: [{ ...chart.chartData.datasets[0], label: 'Cost' }] },
    })
    expect(onUpdate).toHaveBeenCalledWith({
      chartData: { ...chart.chartData, datasets: [{ ...chart.chartData.datasets[0], data: [1, 2, 0, 4] }] },
    })
    expect(onUpdate).toHaveBeenCalledWith({
      chartData: { ...chart.chartData, datasets: [{ ...chart.chartData.datasets[0], color: '#22c55e' }] },
    })
  })

  it('[cap:element.chart depth:behavior] keeps preserve-only imported charts read-only', () => {
    const onUpdate = vi.fn()
    render(<ChartProperties
      element={{
        ...chart,
        _pptxChartMeta: { originalType: 'waterfallChart', preservationTier: 'preserve-only' },
      }}
      onUpdate={onUpdate}
    />)

    expect(screen.getByTestId('prop-chart-preserve-only-notice').textContent).toBe(
      'WaterfallChart is preserved from the original PPTX and cannot be edited.'
    )
    expect(screen.getByTestId('prop-chart-type').disabled).toBe(true)
    expect(screen.getByTestId('prop-chart-labels').disabled).toBe(true)
    expect(screen.getByTestId('prop-chart-series-label-0').disabled).toBe(true)
    expect(screen.getByTestId('prop-chart-values-0').disabled).toBe(true)
    expect(screen.getByTestId('prop-chart-color-0').disabled).toBe(true)
    expect(screen.getByTestId('prop-chart-add-series').disabled).toBe(true)
  })

  it('[cap:element.chart depth:behavior] keeps unqualified canonical candidates read-only', () => {
    render(<ChartProperties
      element={{
        ...chart,
        _pptxChartMeta: {
          originalType: 'barChart',
          rowId: 'chart.bar-column.embedded-workbook.literal-range',
          tier: 'structured-partial',
          preservationTier: 'preserve-only',
          adapterQualified: false,
          transactionEligible: false,
          level4Promoted: false,
        },
      }}
      onUpdate={vi.fn()}
    />)

    expect(screen.getByTestId('prop-chart-preserve-only-notice')).toBeTruthy()
    expect(screen.getByTestId('prop-chart-type').disabled).toBe(true)
    expect(screen.getByTestId('prop-chart-add-series').disabled).toBe(true)
  })

  it('[cap:element.chart depth:behavior] writes area fill, stacked, add series, and remove series', () => {
    const onUpdate = vi.fn()
    const multiSeriesChart = {
      ...chart,
      chartData: {
        ...chart.chartData,
        datasets: [
          chart.chartData.datasets[0],
          { label: 'Cost', data: [5, 6], color: '#ef4444' },
        ],
      },
    }
    render(<ChartProperties element={multiSeriesChart} onUpdate={onUpdate} />)

    fireEvent.click(screen.getByTestId('prop-chart-area-fill'))
    fireEvent.click(screen.getByTestId('prop-chart-stacked'))
    fireEvent.click(screen.getByTestId('prop-chart-add-series'))
    fireEvent.click(screen.getByTestId('prop-chart-remove-series-1'))

    expect(onUpdate).toHaveBeenCalledWith({ areaFill: true })
    expect(onUpdate).toHaveBeenCalledWith({ stacked: true })
    expect(onUpdate).toHaveBeenCalledWith({
      chartData: {
        ...multiSeriesChart.chartData,
        datasets: [...multiSeriesChart.chartData.datasets, { label: 'Series 3', data: [], color: '#6366f1' }],
      },
    })
    expect(onUpdate).toHaveBeenCalledWith({
      chartData: { ...multiSeriesChart.chartData, datasets: [multiSeriesChart.chartData.datasets[0]] },
    })
  })
})
