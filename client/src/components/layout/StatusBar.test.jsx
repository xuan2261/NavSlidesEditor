import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import StatusBar from './StatusBar'
import { useUIStore } from '../../stores/ui-store'

describe('StatusBar zoom controls', () => {
  beforeEach(() => {
    useUIStore.setState({ zoom: 1, userZoomMode: false })
  })

  it('renders zoom percentage from store', () => {
    useUIStore.setState({ zoom: 0.75 })
    render(<StatusBar />)
    expect(screen.getByTestId('statusbar-zoom-display').textContent).toMatch(/75%/)
  })

  it('clicking zoom-in calls store zoomIn', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByTestId('statusbar-zoom-in'))
    expect(useUIStore.getState().zoom).toBeCloseTo(1.1)
    expect(useUIStore.getState().userZoomMode).toBe(true)
  })

  it('clicking zoom-out calls store zoomOut', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByTestId('statusbar-zoom-out'))
    expect(useUIStore.getState().zoom).toBeCloseTo(0.9)
    expect(useUIStore.getState().userZoomMode).toBe(true)
  })

  it('clicking fit resets userZoomMode', () => {
    useUIStore.setState({ userZoomMode: true })
    render(<StatusBar />)
    fireEvent.click(screen.getByTestId('statusbar-zoom-fit'))
    expect(useUIStore.getState().userZoomMode).toBe(false)
  })

  it('selecting from dropdown updates zoom and sets userZoomMode', () => {
    render(<StatusBar />)
    const select = screen.getByTestId('statusbar-zoom-select')
    fireEvent.change(select, { target: { value: '200' } })
    expect(useUIStore.getState().zoom).toBe(2)
    expect(useUIStore.getState().userZoomMode).toBe(true)
  })
})
