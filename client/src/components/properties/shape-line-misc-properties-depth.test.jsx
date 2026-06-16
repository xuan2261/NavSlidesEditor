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

  it('[cap:element.line depth:behavior] writes line stroke width from shape properties', () => {
    const onUpdate = vi.fn()
    render(<ShapeProperties element={{ id: 'line-1', type: 'line', strokeWidth: 2 }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByTestId('prop-shape-stroke-width'), { target: { value: '7' } })

    expect(onUpdate).toHaveBeenCalledWith({ strokeWidth: 7 })
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

  it('[cap:element.icon depth:behavior] writes icon stroke width', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={{ id: 'icon-1', type: 'icon', iconName: 'Star', iconStrokeWidth: 2 }} onUpdate={onUpdate} />)

    fireEvent.change(screen.getByDisplayValue('2'), { target: { value: '3.5' } })

    expect(onUpdate).toHaveBeenCalledWith({ iconStrokeWidth: 3.5 })
  })
})
