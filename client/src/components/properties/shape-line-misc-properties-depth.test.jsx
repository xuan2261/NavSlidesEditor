import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ShapeProperties from './shape-properties'
import MiscProperties from './misc-properties'

describe('canonical shape/line/misc property depth', () => {
  it('[cap:element.shape depth:behavior] writes fill and label text from shape properties', () => {
    const onUpdate = vi.fn()
    render(<ShapeProperties element={{ id: 'shape-1', type: 'shape', shape: 'rect', fill: '#111111' }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-shape-fill'), { target: { value: '#22c55e' } })
    fireEvent.change(screen.getByTestId('prop-shape-label'), { target: { value: 'Status' } })

    expect(onUpdate).toHaveBeenCalledWith({ fill: '#22c55e' })
    expect(onUpdate).toHaveBeenCalledWith({ text: 'Status' })
  })

  it('[cap:element.shape tier:deep depth:behavior] writes stroke, opacity, radius, and label typography', () => {
    const onUpdate = vi.fn()
    render(
      <ShapeProperties
        element={{
          id: 'shape-1',
          type: 'shape',
          shape: 'rounded-rect',
          stroke: '#111111',
          strokeWidth: 2,
          opacity: 0.5,
          borderRadius: 8,
          text: 'Status',
          fontSize: 16,
          textColor: '#ffffff',
        }}
        onUpdate={onUpdate}
      />
    )

    fireEvent.change(screen.getByTestId('prop-shape-stroke'), { target: { value: '#0ea5e9' } })
    fireEvent.change(screen.getByTestId('prop-shape-stroke-width'), { target: { value: '5' } })
    fireEvent.change(screen.getByTestId('prop-shape-opacity'), { target: { value: '75' } })
    fireEvent.change(screen.getByTestId('prop-shape-border-radius'), { target: { value: '24' } })
    fireEvent.change(screen.getByTestId('prop-shape-text-size'), { target: { value: '28' } })
    fireEvent.change(screen.getByTestId('prop-shape-text-color'), { target: { value: '#f8fafc' } })

    expect(onUpdate).toHaveBeenCalledWith({ stroke: '#0ea5e9' })
    expect(onUpdate).toHaveBeenCalledWith({ strokeWidth: 5 })
    expect(onUpdate).toHaveBeenCalledWith({ opacity: 0.75 })
    expect(onUpdate).toHaveBeenCalledWith({ borderRadius: 24 })
    expect(onUpdate).toHaveBeenCalledWith({ fontSize: 28 })
    expect(onUpdate).toHaveBeenCalledWith({ textColor: '#f8fafc' })
  })

  it('[cap:element.line depth:behavior] writes line stroke width from shape properties', () => {
    const onUpdate = vi.fn()
    render(<ShapeProperties element={{ id: 'line-1', type: 'line', strokeWidth: 2 }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-shape-stroke-width'), { target: { value: '7' } })

    expect(onUpdate).toHaveBeenCalledWith({ strokeWidth: 7 })
  })

  it('[cap:element.line tier:deep depth:behavior] excludes fill and writes dash and marker controls', () => {
    const onUpdate = vi.fn()
    render(<ShapeProperties element={{ id: 'line-1', type: 'line', dashArray: '', arrowStart: 'none', arrowEnd: 'none' }} onUpdate={onUpdate} />)

    expect(screen.queryByTestId('prop-shape-fill')).toBeNull()
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: '5,5' } })
    fireEvent.change(selects[1], { target: { value: 'circle' } })
    fireEvent.change(selects[2], { target: { value: 'arrow' } })

    expect(onUpdate).toHaveBeenCalledWith({ dashArray: '5,5' })
    expect(onUpdate).toHaveBeenCalledWith({ arrowStart: 'circle' })
    expect(onUpdate).toHaveBeenCalledWith({ arrowEnd: 'arrow' })
  })

  it('[cap:element.callout depth:behavior] writes callout number and color', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={{ id: 'callout-1', type: 'callout', calloutNumber: 1 }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '7' } })
    fireEvent.change(screen.getByDisplayValue('#ef4444'), { target: { value: '#2563eb' } })

    expect(onUpdate).toHaveBeenCalledWith({ calloutNumber: 7 })
    expect(onUpdate).toHaveBeenCalledWith({ calloutColor: '#2563eb' })
  })

  it('[cap:element.qrcode depth:behavior] writes QR data and error correction level', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={{ id: 'qr-1', type: 'qrcode', qrData: 'https://old.example' }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByDisplayValue('https://old.example'), { target: { value: 'https://new.example' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'H' } })

    expect(onUpdate).toHaveBeenCalledWith({ qrData: 'https://new.example' })
    expect(onUpdate).toHaveBeenCalledWith({ qrErrorLevel: 'H' })
  })

  it('[cap:element.drawing depth:behavior] writes drawing stroke color and width', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={{ id: 'draw-1', type: 'drawing', strokeColor: '#ffffff', strokeWidth: 3, paths: [] }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByDisplayValue('#ffffff'), { target: { value: '#f97316' } })
    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '9' } })

    expect(onUpdate).toHaveBeenCalledWith({ strokeColor: '#f97316' })
    expect(onUpdate).toHaveBeenCalledWith({ strokeWidth: 9 })
  })

  it('[cap:element.drawing tier:deep depth:behavior] leaves existing path stroke data untouched and updates element defaults only', () => {
    const onUpdate = vi.fn()
    render(
      <MiscProperties
        element={{
          id: 'draw-1',
          type: 'drawing',
          strokeColor: '#ffffff',
          strokeWidth: 3,
          paths: [{ d: 'M0 0 L10 10', stroke: '#111111', strokeWidth: 2 }],
        }}
        onUpdate={onUpdate}
      />
    )

    fireEvent.change(screen.getByDisplayValue('#ffffff'), { target: { value: '#22c55e' } })
    fireEvent.change(screen.getByDisplayValue('3'), { target: { value: '8' } })

    expect(onUpdate).toHaveBeenCalledWith({ strokeColor: '#22c55e' })
    expect(onUpdate).toHaveBeenCalledWith({ strokeWidth: 8 })
    expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ paths: expect.any(Array) }))
    expect(screen.getByText('1 path(s)')).toBeTruthy()
  })

  it('[cap:element.icon depth:behavior] writes icon stroke width', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={{ id: 'icon-1', type: 'icon', iconName: 'Star', iconStrokeWidth: 2 }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '3.5' } })

    expect(onUpdate).toHaveBeenCalledWith({ iconStrokeWidth: 3.5 })
  })

  it('[cap:element.svg tier:deep depth:behavior] writes markup and color overrides and resets overrides', () => {
    const onUpdate = vi.fn()
    render(
      <MiscProperties
        element={{
          id: 'svg-1',
          type: 'svg',
          content: '<svg><rect fill="#000" stroke="#fff"/></svg>',
          fillOverride: '#111111',
          strokeOverride: '#222222',
        }}
        onUpdate={onUpdate}
      />
    )

    fireEvent.change(screen.getByDisplayValue('#111111'), { target: { value: '#22c55e' } })
    fireEvent.change(screen.getByDisplayValue('#222222'), { target: { value: '#0f172a' } })
    fireEvent.click(screen.getByText('Reset Overrides'))
    fireEvent.change(screen.getByTestId('prop-svg-content'), {
      target: { value: '<svg><circle r="5"/></svg>' },
    })

    expect(onUpdate).toHaveBeenCalledWith({ fillOverride: '#22c55e' })
    expect(onUpdate).toHaveBeenCalledWith({ strokeOverride: '#0f172a' })
    expect(onUpdate).toHaveBeenCalledWith({ fillOverride: null, strokeOverride: null })
    expect(onUpdate).toHaveBeenCalledWith({ content: '<svg><circle r="5"/></svg>' })
  })
})
