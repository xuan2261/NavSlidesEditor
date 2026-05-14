import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ChartProperties from './chart-properties.jsx'
import CommonElementControls from './common-element-controls.jsx'
import MediaProperties from './media-properties.jsx'
import MiscProperties from './misc-properties.jsx'
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

  it('renders latex font size and color controls', () => {
    const html = renderToString(
      React.createElement(MiscProperties, {
        element: {
          type: 'latex',
          content: '\\frac{a}{b}',
          fontSize: 28,
          textColor: '#10b981',
        },
        onUpdate: () => {},
        onEditLatex: () => {},
      })
    )

    expect(html).toContain('Font Size')
    expect(html).toContain('Color')
    expect(html).toContain('prop-latex-font-size')
    expect(html).toContain('prop-latex-text-color')
  })

  it('renders only reveal-supported extended fragment animation options', () => {
    const html = renderToString(
      React.createElement(CommonElementControls, {
        element: {
          id: 'fragment-1',
          type: 'text',
          x: 0,
          y: 0,
          width: 100,
          height: 40,
          fragment: true,
          fragmentIndex: 1,
          fragmentAnimation: 'fade-in',
        },
        onUpdate: () => {},
        onBringForward: () => {},
        onSendBackward: () => {},
        onDelete: () => {},
      })
    )

    expect(html).toContain('value="strike"')
    expect(html).not.toContain('value="slide-in"')
    expect(html).not.toContain('value="slide-out"')
    expect(html).not.toContain('value="flip"')
  })

  it('renders video trim and playback rate controls', () => {
    const html = renderToString(
      React.createElement(MediaProperties, {
        element: {
          type: 'video',
          src: 'https://example.com/video.ogv',
          startTime: 5,
          endTime: 12,
          playbackRate: 1.25,
        },
        onUpdate: () => {},
      })
    )

    expect(html).toContain('Start Time')
    expect(html).toContain('End Time')
    expect(html).toContain('Playback Speed')
    expect(html).toContain('prop-video-start-time')
    expect(html).toContain('prop-video-end-time')
    expect(html).toContain('prop-video-playback-rate')
  })
})
