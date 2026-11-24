// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const propertiesPath = '../../client/src/components/native-chart-properties.jsx'
afterEach(cleanup)
const chart = () => ({
  schemaVersion: 1,
  source: { partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64),
    ownerDefinitionId: 'frame', relationshipId: 'rId1' },
  options: {}, axes: [], plots: [{ family: 'pieChart', options: {}, axisIds: [],
    series: [{ id: 's', source: { definitionId: 's', partUri: 'ppt/charts/chart1.xml',
      preconditionHash: 'a'.repeat(64), path: [0, 1] }, index: 0, order: 0,
      options: {}, data: {
        tx: { kind: 'text', value: 'Sales' },
        val: { kind: 'numRef', formula: 'Sheet1!A1', cache: { count: 1, points: [{
          index: 0, value: 5, lexicalValue: '5', source: { definitionId: 'p',
            partUri: 'ppt/charts/chart1.xml', preconditionHash: 'a'.repeat(64), path: [0, 2] },
        }] } },
      } }] }],
})

describe('native chart production properties', () => {
  it('sends a source-bound explicit conversion wrapper, not a replacement document', async () => {
    const { default: Properties } = await import(/* @vite-ignore */ propertiesPath)
    const send = vi.fn()
    render(<Properties chartDocument={chart()} instanceId="occurrence" onSemanticOperation={send} />)
    expect(screen.getByLabelText('Sales val point 0').disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Convert Sales val cache to project-local data' }))
    expect(send).toHaveBeenCalledWith({
      type: 'chart.edit', instanceId: 'occurrence', componentId: 'frame',
      command: { type: 'chart.data.convert-local', seriesId: 's', channel: 'val', basis: 'cache-snapshot' },
    })
  })
  it('commits valid finite points and keeps invalid drafts out of canonical state', async () => {
    const { default: Properties } = await import(/* @vite-ignore */ propertiesPath)
    const d = chart()
    d.plots[0].series[0].data.val.kind = 'numLit'
    delete d.plots[0].series[0].data.val.formula
    const send = vi.fn()
    render(<Properties chartDocument={d} instanceId="o" onSemanticOperation={send} />)
    const input = screen.getByLabelText('Sales val point 0')
    fireEvent.change(input, { target: { value: 'bad' } })
    fireEvent.blur(input)
    expect(send).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '-2.5' } })
    fireEvent.blur(input)
    expect(send.mock.calls[0][0].command).toEqual({
      type: 'chart.data.set-point', seriesId: 's', channel: 'val', index: 0, value: -2.5,
    })
  })
  it('disables edits for locked occurrences and renders no fabricated data', async () => {
    const { default: Properties } = await import(/* @vite-ignore */ propertiesPath)
    render(<Properties chartDocument={chart()} instanceId="o" locked onSemanticOperation={vi.fn()} />)
    expect([...document.querySelectorAll('input,button,select')].every(n => n.disabled)).toBe(true)
  })
  it('converts referenced chart title explicitly before editing title text', async () => {
    const { default: Properties } = await import(/* @vite-ignore */ propertiesPath)
    const d = chart()
    d.title = {
      kind: 'strRef', formula: 'Sheet1!$B$1',
      cache: { count: 1, points: [{
        index: 0, value: 'Original Chart',
        source: { definitionId: 'title-p', partUri: d.source.partUri, preconditionHash: d.source.preconditionHash, path: [0, 4] },
      }] },
    }
    const send = vi.fn()
    render(<Properties chartDocument={d} instanceId="o" onSemanticOperation={send} />)
    expect(screen.getByLabelText('Chart title').disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Convert Chart title cache to project-local data' }))
    expect(send).toHaveBeenCalledWith({
      type: 'chart.edit', instanceId: 'o', componentId: 'frame',
      command: { type: 'chart.title.convert-local', basis: 'cache-snapshot' },
    })
  })
  it('edits family plot options and point fill without altering unedited points', async () => {
    const { default: Properties } = await import(/* @vite-ignore */ propertiesPath)
    const d = chart()
    d.plots[0].series[0].data.val.kind = 'numLit'
    delete d.plots[0].series[0].data.val.formula
    const send = vi.fn()
    render(<Properties chartDocument={d} instanceId="o" onSemanticOperation={send} />)
    const angleInput = screen.getByLabelText('Plot 0 firstSliceAng')
    fireEvent.change(angleInput, { target: { value: '45' } })
    fireEvent.blur(angleInput)
    expect(send).toHaveBeenCalledWith({
      type: 'chart.edit', instanceId: 'o', componentId: 'frame',
      command: { type: 'chart.options.set', target: 'plot', plotIndex: 0, values: { firstSliceAng: 45 } },
    })
    const pointFill = screen.getByLabelText('s point 0 fill')
    fireEvent.change(pointFill, { target: { value: '#ff5500' } })
    expect(send).toHaveBeenCalledWith({
      type: 'chart.edit', instanceId: 'o', componentId: 'frame',
      command: {
        type: 'chart.point.paint.set', seriesId: 's', index: 0,
        value: { fill: { kind: 'solid', color: 'ff5500' } },
      },
    })
  })
  it('renders 3D view controls for 3D charts and disallows flattening hierarchical categories', async () => {
    const { default: Properties } = await import(/* @vite-ignore */ propertiesPath)
    const d = chart()
    d.plots[0].family = 'bar3DChart'
    d.plots[0].options = { barDir: 'col', grouping: 'clustered' }
    d.plots[0].series[0].data.cat = {
      kind: 'multiLvlStrRef', formula: 'Sheet1!$A$1:$B$3',
      cache: { count: 1, levels: [
        { source: { partUri: d.source.partUri, preconditionHash: d.source.preconditionHash, path: [0, 5] },
          points: [{ index: 0, value: 'Q1', source: { definitionId: 'pt', partUri: d.source.partUri, preconditionHash: d.source.preconditionHash, path: [0, 5, 0] } }] },
      ] },
    }
    d.view3D = { rotX: 15, rotY: 20, rAngAx: true }
    const send = vi.fn()
    render(<Properties chartDocument={d} instanceId="o" onSemanticOperation={send} />)
    expect(screen.getByText(/Hierarchical categories remain source-bound/i)).toBeDefined()
    const rotX = screen.getByLabelText('3D rotX')
    fireEvent.change(rotX, { target: { value: '25' } })
    fireEvent.blur(rotX)
    expect(send).toHaveBeenCalledWith({
      type: 'chart.edit', instanceId: 'o', componentId: 'frame',
      command: { type: 'chart.view3D.set', values: { rotX: 25 } },
    })
  })
})

describe('native chart derived render contract', () => {
  const project = d => require('../../shared/src/pptx-chart-render').projectChartRender(d)
  it('preserves sparse slots and source families without using compatibility chartData', () => {
    const d = chart(), before = JSON.stringify(d)
    const result = project(d)
    expect(result.supported).toBe(true)
    expect(result.config.type).toBe('pie')
    expect(result.config.data.datasets[0].data).toEqual([5])
    expect(JSON.stringify(d)).toBe(before)
  })
  it('uses native points and axes for scatter instead of guessing X values', () => {
    const d = chart(), series = d.plots[0].series[0]
    d.plots[0].family = 'scatterChart'
    series.data.yVal = series.data.val
    delete series.data.val
    series.data.xVal = { kind: 'numLit', cache: { count: 1, points: [{
      index: 0, value: 9, lexicalValue: '9', source: {
        definitionId: 'x', partUri: d.source.partUri, preconditionHash: d.source.preconditionHash, path: [0, 3],
      },
    }] } }
    expect(project(d).config.data.datasets[0].data).toEqual([{ x: 9, y: 5 }])
  })
  it('does not discard authored styling, labels, or unsupported plot options', () => {
    const d = chart()
    d.style = 10
    d.plots[0].options.explosion = 20
    const result = project(d)
    expect(result.supported).toBe(false)
    expect(result.reasons.length).toBe(2)
    expect(result.config).toBeUndefined()
  })
})
