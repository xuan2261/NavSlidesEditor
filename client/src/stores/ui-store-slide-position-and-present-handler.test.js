import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useUIStore } from './ui-store'

beforeEach(() => {
  useUIStore.setState({
    slidePosition: { current: 0, total: 0 },
    presentHandler: null,
  })
})

describe('ui-store slidePosition', () => {
  it('defaults to current 0 / total 0', () => {
    expect(useUIStore.getState().slidePosition).toEqual({ current: 0, total: 0 })
  })

  it('setSlidePosition stores the supplied current/total', () => {
    useUIStore.getState().setSlidePosition({ current: 2, total: 5 })
    expect(useUIStore.getState().slidePosition).toEqual({ current: 2, total: 5 })
  })
})

describe('ui-store presentHandler', () => {
  it('defaults to null', () => {
    expect(useUIStore.getState().presentHandler).toBeNull()
  })

  it('stores and clears the handler', () => {
    const fn = () => 'present'
    useUIStore.getState().setPresentHandler(fn)
    expect(useUIStore.getState().presentHandler).toBe(fn)
    useUIStore.getState().setPresentHandler(null)
    expect(useUIStore.getState().presentHandler).toBeNull()
  })

  it('does NOT invoke the handler on registration (only on explicit call)', () => {
    // Regression guard: setPresentHandler must use a plain set, not the
    // function-updater idiom other ui-store setters use, otherwise registering
    // the handler would immediately open the present window.
    const spy = vi.fn()
    useUIStore.getState().setPresentHandler(spy)
    expect(spy).not.toHaveBeenCalled()
    useUIStore.getState().presentHandler()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
