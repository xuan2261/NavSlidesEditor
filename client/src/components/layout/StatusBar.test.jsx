import React from 'react'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StatusBar from './StatusBar'
import { useUIStore } from '../../stores/ui-store'
import { useEditorStore } from '../../stores/editor-store'

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

afterEach(() => vi.unstubAllGlobals())

describe('StatusBar editor-context gate', () => {
  it('hides zoom, slide position and view switcher when no editor is active', () => {
    render(<StatusBar />)
    expect(screen.queryByTestId('statusbar-zoom-slider')).toBeNull()
    expect(screen.queryByTestId('statusbar-slide-position')).toBeNull()
    expect(screen.queryByTestId('statusbar-view-normal')).toBeNull()
  })

})

describe('StatusBar responsive context', () => {
  it('keeps slide context and usable controls when resizing from desktop to tablet', () => {
    let resize
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { resize = callback }
      observe() {}
      disconnect() {}
    })
    setEditorActive(5, 2)
    render(<StatusBar />)
    act(() => resize([{ contentRect: { width: 1280 } }]))
    act(() => resize([{ contentRect: { width: 768 } }]))

    expect(screen.getByTestId('statusbar-slide-position').textContent).toBe('Slide 3 / 5')
    expect(screen.queryByTestId('statusbar-attribution')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Slide Sorter' }))
    expect(useEditorStore.getState().viewMode).toBe('sorter')
    fireEvent.change(screen.getByRole('slider', { name: 'Zoom level' }), { target: { value: '125' } })
    expect(useUIStore.getState().zoom).toBe(1.25)
  })
})

describe('StatusBar zoom slider', () => {
  beforeEach(() => setEditorActive(5))


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

  it('[cap:control.status.touch-targets] keeps coarse-pointer targets on compact controls', () => {
    render(<StatusBar />)
    expect(screen.getByTestId('statusbar-zoom-in').className).toContain(
      'ui-coarse-target-square'
    )
    expect(screen.getByTestId('statusbar-zoom-in').className).toContain('h-7')
    expect(screen.getByTestId('statusbar-zoom-in').className).toContain('sm:h-5')
    expect(screen.getByTestId('statusbar-zoom-fit').className).toContain('ui-coarse-target')
    expect(screen.getByTestId('statusbar-view-normal').className).toContain(
      'ui-coarse-target-square'
    )
  })

})

describe('StatusBar slide position', () => {
  it('shows 1-based current / total of parent slides', () => {
    setEditorActive(5, 2)
    render(<StatusBar />)
    expect(screen.getByTestId('statusbar-slide-position').textContent).toMatch(/Slide 3 \/ 5/)
  })

  it('follows vertical, master and parent slide context changes', () => {
    setEditorActive(5, 2)
    render(<StatusBar />)
    const position = screen.getByTestId('statusbar-slide-position')
    act(() => useUIStore.setState({ slidePosition: { current: 2, total: 5, vertical: 0 } }))
    expect(position.textContent).toBe('Slide 3.1 / 5')
    act(() => useUIStore.setState({ slidePosition: { current: 2, total: 5, vertical: 1 } }))
    expect(position.textContent).toBe('Slide 3.2 / 5')
    act(() => useUIStore.setState({ slidePosition: { current: 2, total: 5, vertical: 1, masterName: 'Title layout' } }))
    expect(position.textContent).toBe('Editing master: Title layout')
    act(() => useUIStore.setState({ slidePosition: { current: 1, total: 5 } }))
    expect(position.textContent).toBe('Slide 2 / 5')
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
