import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ImageProperties from './image-properties'
import ChartProperties from './chart-properties'
import TableProperties from './table-properties'
import TimelineProperties from './timeline-properties'
import CommonElementControls from './common-element-controls'
import MiscProperties from './misc-properties'

const noop = vi.fn()

describe('Phase 4: image saturation slider', () => {
  it('renders a saturation slider writing filterSaturate', () => {
    const onUpdate = vi.fn()
    render(<ImageProperties element={{ id: 'i1', type: 'image', src: '/x.png' }} onUpdate={onUpdate} />)
    const slider = screen.getByTestId('prop-image-saturation')
    fireEvent.change(slider, { target: { value: '150' } })
    expect(onUpdate).toHaveBeenCalledWith({ filterSaturate: 150 })
  })
})

describe('Phase 4: chart area + stacked', () => {
  const lineChart = { id: 'c1', type: 'chart', chartType: 'line', chartData: { labels: [], datasets: [] } }
  const barChart = { id: 'c2', type: 'chart', chartType: 'bar', chartData: { labels: [], datasets: [] } }

  it('[cap:element.chart depth:behavior] shows area-fill checkbox for line charts and writes areaFill', () => {
    const onUpdate = vi.fn()
    render(<ChartProperties element={lineChart} onUpdate={onUpdate} />)
    const cb = screen.getByTestId('prop-chart-area-fill')
    fireEvent.click(cb)
    expect(onUpdate).toHaveBeenCalledWith({ areaFill: true })
  })

  it('hides area-fill checkbox for non-line charts', () => {
    render(<ChartProperties element={barChart} onUpdate={noop} />)
    expect(screen.queryByTestId('prop-chart-area-fill')).toBeNull()
  })

  it('shows stacked checkbox writing stacked', () => {
    const onUpdate = vi.fn()
    render(<ChartProperties element={barChart} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTestId('prop-chart-stacked'))
    expect(onUpdate).toHaveBeenCalledWith({ stacked: true })
  })
})

describe('Phase 4: table header text color + border style', () => {
  const table = { id: 't1', type: 'table', data: [['a', 'b']] }

  it('[cap:element.table depth:behavior] renders header text color picker writing headerTextColor', () => {
    const onUpdate = vi.fn()
    render(<TableProperties element={table} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByTestId('prop-table-header-text-color'), { target: { value: '#ff0000' } })
    expect(onUpdate).toHaveBeenCalledWith({ headerTextColor: '#ff0000' })
  })

  it('renders border style select writing borderStyle', () => {
    const onUpdate = vi.fn()
    render(<TableProperties element={table} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByTestId('prop-table-border-style'), { target: { value: 'dashed' } })
    expect(onUpdate).toHaveBeenCalledWith({ borderStyle: 'dashed' })
  })
})

describe('Phase 4: timeline per-event connector length', () => {
  const tl = {
    id: 'tl1',
    type: 'timeline',
    events: [{ id: 'e1', date: '2020', title: 'A', connectorLength: 0 }],
  }

  it('[cap:element.timeline depth:behavior] renders a connector-length input per event writing connectorLength', () => {
    const onUpdate = vi.fn()
    render(<TimelineProperties element={tl} onUpdate={onUpdate} />)
    const input = screen.getByTestId('prop-timeline-connector-0')
    fireEvent.change(input, { target: { value: '30' } })
    // updateItems writes both events (connectorOffset) and items (connectorLength)
    const call = onUpdate.mock.calls[0][0]
    expect(call.items[0].connectorLength).toBe(30)
  })
})

describe('Phase 4: generic panel opacity (P0-PANEL-OPACITY)', () => {
  const textEl = { id: 'x1', type: 'text', x: 0, y: 0, width: 100, height: 50 }

  function renderCommon(element, extra = {}) {
    return render(
      <CommonElementControls
        element={element}
        onUpdate={noop}
        onBringForward={noop}
        onSendBackward={noop}
        onDelete={noop}
        {...extra}
      />
    )
  }

  it('renders an opacity slider for a non-shape type writing opacity', () => {
    const onUpdate = vi.fn()
    renderCommon(textEl, { onUpdate })
    const slider = screen.getByTestId('prop-opacity')
    fireEvent.change(slider, { target: { value: '40' } })
    expect(onUpdate).toHaveBeenCalledWith({ opacity: 0.4 })
  })

  it('marks the panel opacity mixed when selection differs', () => {
    const a = { ...textEl, id: 'a', opacity: 1 }
    const b = { ...textEl, id: 'b', opacity: 0.5 }
    renderCommon(a, { elements: [a, b], selectedElementIds: ['a', 'b'] })
    expect(screen.getByTestId('prop-opacity').getAttribute('data-mixed')).toBe('true')
  })
})

describe('Phase 4: svg content editor', () => {
  const svg = { id: 's1', type: 'svg', content: '<svg><rect width="10" height="10"/></svg>' }

  it('[cap:element.svg depth:behavior] renders an editable SVG content field that updates element.content', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={svg} onUpdate={onUpdate} />)
    const editor = screen.getByTestId('prop-svg-content')
    fireEvent.change(editor, { target: { value: '<svg><circle r="5"/></svg>' } })
    expect(onUpdate).toHaveBeenCalledWith({ content: '<svg><circle r="5"/></svg>' })
  })
})
