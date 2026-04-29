import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ChartProperties from './chart-properties.jsx'
import TableProperties from './table-properties.jsx'

describe('import fidelity property panels', () => {
  it('renders controls for every chart dataset plus series add/remove actions', () => {
    const html = renderToString(
      React.createElement(ChartProperties, {
        element: {
          chartType: 'bar',
          chartData: {
            labels: ['A', 'B'],
            datasets: [
              { label: 'Q1', data: [1, 2], color: '#ff0000' },
              { label: 'Q2', data: [3, 4], color: '#0000ff' },
            ],
          },
        },
        onUpdate: () => {},
      })
    )

    expect(html).toContain('Q1')
    expect(html).toContain('Q2')
    expect(html).toContain('Add Series')
    expect(html).toContain('Remove')
  })

  it('renders table controls for selected-cell style fidelity', () => {
    const html = renderToString(
      React.createElement(TableProperties, {
        element: {
          data: [
            ['A', 'B'],
            ['C', 'D'],
          ],
          cellStyles: {
            textColors: [['#111111', null], [null, null]],
            bgColors: [['#eeeeee', null], [null, null]],
            isBold: [[true, false], [false, false]],
            aligns: [['center', 'left'], ['left', 'left']],
            vAligns: [['bottom', 'middle'], ['middle', 'middle']],
          },
        },
        onUpdate: () => {},
      })
    )

    expect(html).toContain('Cell BG')
    expect(html).toContain('Cell Text')
    expect(html).toContain('Cell Bold')
    expect(html).toContain('Cell Align')
    expect(html).toContain('Cell VAlign')
  })
})
