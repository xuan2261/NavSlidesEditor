import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StatusBar from './StatusBar'
import { useUIStore } from '../../stores/ui-store'
import { useEditorStore } from '../../stores/editor-store'

// The right-hand cluster (zoom + slide position + view switcher) is gated on an
// active editor (slidePosition.total > 0). Most tests opt in by setting total.
function setEditorActive(total = 5, current = 0) {
  useUIStore.setState({ slidePosition: { current, total } })
}

beforeEach(() => {
  useUIStore.setState({
    zoom: 1,
    userZoomMode: false,
    slidePosition: { current: 0, total: 0 },
    presentHandler: null,
  })
  useEditorStore.setState({ viewMode: 'normal' })
})

describe('StatusBar editor-context gate', () => {
  it('hides zoom, slide position and view switcher when no editor is active', () => {
    render(<StatusBar />)
    expect(screen.queryByTestId('statusbar-zoom-slider')).toBeNull()
    expect(screen.queryByTestId('statusbar-slide-position')).toBeNull()
    expect(screen.queryByTestId('statusbar-view-normal')).toBeNull()
  })

  it('always shows attribution and version', () => {
    render(<StatusBar />)
    expect(screen.getByText(/NavSlides Editor/)).toBeTruthy()
    expect(screen.getByText(/Designed by Xuan Bui Thanh/)).toBeTruthy()
    expect(screen.getByText(/^v/)).toBeTruthy()
  })
})

describe('StatusBar zoom slider', () => {
  beforeEach(() => setEditorActive(5))

  it('[cap:control.status.zoom] replaces the dropdown with a range slider', () => {
    render(<StatusBar />)
    expect(screen.queryByTestId('statusbar-zoom-select')).toBeNull()
    expect(screen.getByTestId('statusbar-zoom-slider')).toBeTruthy()
  })

  it('reflects store zoom as a percentage value', () => {
    useUIStore.setState({ zoom: 0.75 })
    render(<StatusBar />)
    expect(screen.getByTestId('statusbar-zoom-slider').value).toBe('75')
  })

  it('dragging the slider updates zoom and sets userZoomMode', () => {
    render(<StatusBar />)
    fireEvent.change(screen.getByTestId('statusbar-zoom-slider'), { target: { value: '200' } })
    expect(useUIStore.getState().zoom).toBe(2)
    expect(useUIStore.getState().userZoomMode).toBe(true)
  })

  it('[cap:control.status.zoom] keeps the −/+/Fit buttons working', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByTestId('statusbar-zoom-in'))
    expect(useUIStore.getState().zoom).toBeCloseTo(1.1)
    fireEvent.click(screen.getByTestId('statusbar-zoom-out'))
    expect(useUIStore.getState().zoom).toBeCloseTo(1.0)
    useUIStore.setState({ userZoomMode: true })
    fireEvent.click(screen.getByTestId('statusbar-zoom-fit'))
    expect(useUIStore.getState().userZoomMode).toBe(false)
  })

  it('exposes larger touch-comfort zoom controls before compact sm breakpoint classes', () => {
    render(<StatusBar />)
    expect(screen.getByTestId('statusbar-zoom-in').className).toContain('h-7')
    expect(screen.getByTestId('statusbar-zoom-in').className).toContain('sm:h-5')
    expect(screen.getByTestId('statusbar-zoom-fit').className).toContain('h-7')
  })
})

describe('StatusBar slide position', () => {
  it('shows 1-based current / total of parent slides', () => {
    setEditorActive(5, 2)
    render(<StatusBar />)
    expect(screen.getByTestId('statusbar-slide-position').textContent).toMatch(/Slide 3 \/ 5/)
  })
})

describe('StatusBar view switcher', () => {
  beforeEach(() => setEditorActive(5))

  it('[cap:control.status.view-mode] renders Normal / Sorter / Present with pressed state from viewMode', () => {
    render(<StatusBar />)
    expect(screen.getByTestId('statusbar-view-normal').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('statusbar-view-sorter').getAttribute('aria-pressed')).toBe('false')
    // Present is an action, not a toggle.
    expect(screen.getByTestId('statusbar-view-present').getAttribute('aria-pressed')).toBeNull()
  })

  it('clicking Sorter switches editor-store viewMode', () => {
    render(<StatusBar />)
    fireEvent.click(screen.getByTestId('statusbar-view-sorter'))
    expect(useEditorStore.getState().viewMode).toBe('sorter')
  })

  it('clicking Normal switches viewMode back', () => {
    useEditorStore.setState({ viewMode: 'sorter' })
    render(<StatusBar />)
    fireEvent.click(screen.getByTestId('statusbar-view-normal'))
    expect(useEditorStore.getState().viewMode).toBe('normal')
  })

  it('clicking Present invokes the registered present handler', () => {
    const spy = vi.fn()
    useUIStore.setState({ presentHandler: spy })
    render(<StatusBar />)
    fireEvent.click(screen.getByTestId('statusbar-view-present'))
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
