import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUIStore } from '../../stores/ui-store'
import RibbonHeaderBar from './ribbon-header-bar'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  useUIStore.setState({
    activeTab: 'home',
    lastNonContextualTab: 'home',
    formatContext: { hasSelection: false, elementType: null },
    formatAutoActivatedForSelection: false,
  })
})

function makeTabListOverflow() {
  const list = screen.getByRole('tablist', { name: 'Ribbon tabs' })
  Object.defineProperties(list, {
    clientWidth: { configurable: true, value: 180 },
    scrollWidth: { configurable: true, value: 640 },
    scrollLeft: { configurable: true, value: 0, writable: true },
  })
  fireEvent.resize(window)
  return list
}

describe('responsive Ribbon tab strip', () => {
  it('[cap:control.ribbon.contextual-format] restores the focused last non-contextual tab when Format disappears', () => {
    act(() => {
      useUIStore.getState().setActiveTab('design')
      useUIStore.getState().setFormatContext({ hasSelection: true, elementType: 'shape' })
    })
    render(<RibbonHeaderBar />)

    const format = screen.getByRole('tab', { name: 'Shape Format' })
    format.focus()
    expect(document.activeElement).toBe(format)

    act(() => {
      useUIStore.getState().setFormatContext({ hasSelection: false, elementType: null })
    })

    const design = screen.getByRole('tab', { name: 'Design' })
    expect(useUIStore.getState().activeTab).toBe('design')
    expect(design.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(design)
    expect(screen.queryByRole('tab', { name: 'Shape Format' })).toBeNull()
  })


  it('[cap:control.ribbon.keyboard] preserves Arrow, Home, End, Enter, and Space activation', async () => {
    render(<RibbonHeaderBar />)
    const home = screen.getByRole('tab', { name: 'Home' })
    home.focus()

    fireEvent.keyDown(home, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Insert' }).getAttribute('aria-selected')).toBe('true'))

    const insert = screen.getByRole('tab', { name: 'Insert' })
    fireEvent.keyDown(insert, { key: 'ArrowLeft' })
    await waitFor(() => expect(home.getAttribute('aria-selected')).toBe('true'))

    const design = screen.getByRole('tab', { name: 'Design' })
    design.focus()
    fireEvent.keyDown(design, { key: 'Enter' })
    expect(design.getAttribute('aria-selected')).toBe('true')

    const transitions = screen.getByRole('tab', { name: 'Transitions' })
    transitions.focus()
    fireEvent.keyDown(transitions, { key: ' ' })
    expect(transitions.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(transitions, { key: 'Home' })
    await waitFor(() => expect(home.getAttribute('aria-selected')).toBe('true'))
    fireEvent.keyDown(home, { key: 'End' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'View' }).getAttribute('aria-selected')).toBe('true'))
  })
  it('[cap:control.ribbon.overflow] exposes named, stateful left and right scroll buttons', async () => {
    render(<RibbonHeaderBar />)
    const list = makeTabListOverflow()

    const left = await screen.findByRole('button', { name: 'Scroll ribbon tabs left' })
    const right = screen.getByRole('button', { name: 'Scroll ribbon tabs right' })
    expect(left.disabled).toBe(true)
    expect(right.disabled).toBe(false)

    const scrollBy = vi.fn(({ left: delta }) => {
      list.scrollLeft += delta
      fireEvent.scroll(list)
    })
    list.scrollBy = scrollBy
    fireEvent.click(right)
    expect(scrollBy).toHaveBeenCalledWith({ left: 144, behavior: 'smooth' })

    list.scrollLeft = 460
    fireEvent.scroll(list)
    await waitFor(() => {
      expect(left.disabled).toBe(false)
      expect(right.disabled).toBe(true)
    })
  })

  it('[cap:control.ribbon.reduced-motion] uses non-animated overflow scrolling when requested', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    render(<RibbonHeaderBar />)
    const list = makeTabListOverflow()
    const scrollBy = vi.fn()
    list.scrollBy = scrollBy

    fireEvent.click(await screen.findByRole('button', { name: 'Scroll ribbon tabs right' }))
    expect(scrollBy).toHaveBeenCalledWith({ left: 144, behavior: 'auto' })
  })
})
