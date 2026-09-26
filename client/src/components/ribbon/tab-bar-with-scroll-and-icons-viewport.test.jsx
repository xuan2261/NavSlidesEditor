import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUIStore } from '../../stores/ui-store'
import RibbonHeaderBar from './ribbon-header-bar'

beforeEach(() => {
  useUIStore.setState({
    activeTab: 'view',
    lastNonContextualTab: 'view',
    formatContext: { hasSelection: false, elementType: null },
    formatAutoActivatedForSelection: false,
  })
})
afterEach(() => vi.restoreAllMocks())

// JSDOM has no layout. Model tab positions and the CSS overlay-button padding,
// leaving the component responsible for choosing and applying scroll offsets.
function modelTabLayout(initialWidth) {
  const list = screen.getByRole('tablist', { name: 'Ribbon tabs' })
  const tabs = screen.getAllByRole('tab')
  let width = initialWidth
  const padding = () => list.dataset.overflow === 'true' ? 32 : 0
  Object.defineProperties(list, {
    clientWidth: { configurable: true, get: () => width },
    scrollWidth: { configurable: true, get: () => tabs.length * 100 + padding() * 2 },
    scrollLeft: { configurable: true, value: 0, writable: true },
  })
  vi.spyOn(list, 'getBoundingClientRect').mockImplementation(() => ({ left: 20, right: 20 + width }))
  tabs.forEach((tab, index) => {
    vi.spyOn(tab, 'getBoundingClientRect').mockImplementation(() => {
      const left = 20 + padding() + index * 100 - list.scrollLeft
      return { left, right: left + 100 }
    })
  })
  const getComputedStyle = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node, ...args) => node === list
    ? { paddingLeft: `${padding()}px`, paddingRight: `${padding()}px` }
    : getComputedStyle(node, ...args))
  return {
    list,
    resize(nextWidth) { width = nextWidth; fireEvent.resize(window) },
    expectVisible(tab) {
      const bounds = tab.getBoundingClientRect()
      expect(bounds.left).toBeGreaterThanOrEqual(20 + padding())
      expect(bounds.right).toBeLessThanOrEqual(20 + width - padding())
    },
  }
}

async function flushMeasure() {
  await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)) })
}

describe('ribbon tab viewport', () => {
  it('[cap:control.ribbon.active-reveal] keeps the last tab clear of newly mounted overflow buttons', async () => {
    render(<RibbonHeaderBar />)
    const layout = modelTabLayout(640)
    layout.resize(640)
    await flushMeasure()
    expect(screen.queryByRole('button', { name: 'Scroll ribbon tabs right' })).toBeNull()

    layout.resize(220)
    await screen.findByRole('button', { name: 'Scroll ribbon tabs right' })
    layout.expectVisible(screen.getByRole('tab', { name: 'View' }))
    expect(layout.list.scrollLeft).toBe(444)

    layout.resize(180)
    await waitFor(() => expect(layout.list.scrollLeft).toBe(484))
    layout.expectVisible(screen.getByRole('tab', { name: 'View' }))
    expect(screen.getByRole('button', { name: 'Scroll ribbon tabs right' }).disabled).toBe(true)
  })

  it('preserves manual scrolling until selection or viewport width changes', async () => {
    render(<RibbonHeaderBar />)
    const layout = modelTabLayout(220)
    layout.resize(220)
    await screen.findByRole('button', { name: 'Scroll ribbon tabs right' })

    layout.list.scrollLeft = 120
    fireEvent.scroll(layout.list)
    await flushMeasure()
    expect(layout.list.scrollLeft).toBe(120)
    fireEvent.scroll(layout.list)
    await flushMeasure()
    expect(layout.list.scrollLeft).toBe(120)

    fireEvent.click(screen.getByRole('tab', { name: 'Home' }))
    layout.expectVisible(screen.getByRole('tab', { name: 'Home' }))
    expect(layout.list.scrollLeft).toBe(0)
    act(() => useUIStore.getState().setActiveTab('view'))
    layout.expectVisible(screen.getByRole('tab', { name: 'View' }))
  })

  it('reveals keyboard selection without scrolling an ancestor', async () => {
    const scrollAncestor = vi.spyOn(Element.prototype, 'scrollIntoView')
    render(<RibbonHeaderBar />)
    const layout = modelTabLayout(220)
    layout.resize(220)
    await screen.findByRole('button', { name: 'Scroll ribbon tabs right' })
    const view = screen.getByRole('tab', { name: 'View' })
    act(() => view.focus())
    fireEvent.keyDown(view, { key: 'Home' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Home' }).getAttribute('aria-selected')).toBe('true'))
    layout.expectVisible(screen.getByRole('tab', { name: 'Home' }))
    expect(scrollAncestor).not.toHaveBeenCalled()
  })

  it('does not activate a swiped tab, but still activates a touch tap', () => {
    render(<RibbonHeaderBar />)
    const home = screen.getByRole('tab', { name: 'Home' })
    fireEvent.touchStart(home, { changedTouches: [{ clientX: 80, clientY: 20 }] })
    fireEvent.touchEnd(home, { changedTouches: [{ clientX: 20, clientY: 20 }] })
    expect(screen.getByRole('tab', { name: 'View' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.touchStart(home, { changedTouches: [{ clientX: 80, clientY: 20 }] })
    fireEvent.touchEnd(home, { changedTouches: [{ clientX: 83, clientY: 21 }] })
    expect(home.getAttribute('aria-selected')).toBe('true')
  })
})
