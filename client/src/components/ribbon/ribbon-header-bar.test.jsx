import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUIStore } from '../../stores/ui-store'
import RibbonHeaderBar from './ribbon-header-bar'

beforeEach(() => {
  useUIStore.setState({
    activeTab: 'home',
    lastNonContextualTab: 'home',
    formatContext: { hasSelection: false, elementType: null },
    formatAutoActivatedForSelection: false,
  })
})

function renderActions() {
  const onPresent = vi.fn()
  const onPresentCurrent = vi.fn()
  render(<RibbonHeaderBar onPresent={onPresent} onPresentCurrent={onPresentCurrent} />)
  return { trigger: screen.getByRole('button', { name: 'Present' }), onPresent, onPresentCurrent }
}

describe('ribbon Present menu', () => {
  it.each(['Enter', ' ', 'ArrowDown'])('enters from the keyboard with %s and launches only the selected start position', async (key) => {
    const { trigger, onPresent, onPresentCurrent } = renderActions()
    trigger.focus()
    if (key === 'ArrowDown') fireEvent.keyDown(trigger, { key })
    else await userEvent.keyboard(key === 'Enter' ? '{Enter}' : ' ')
    const beginning = screen.getByRole('menuitem', { name: 'From beginning (F5)' })
    const current = screen.getByRole('menuitem', { name: 'From current slide (Shift+F5)' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(beginning)
    expect(onPresent).not.toHaveBeenCalled()
    expect(onPresentCurrent).not.toHaveBeenCalled()

    fireEvent.keyDown(beginning, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(current)
    await userEvent.keyboard('{Enter}')
    expect(onPresentCurrent).toHaveBeenCalledTimes(1)
    expect(onPresent).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu', { name: 'Present menu' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('supports last-item entry, wrapped navigation, Home and End, and Space selection', async () => {
    const { trigger, onPresent, onPresentCurrent } = renderActions()
    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    const beginning = screen.getByRole('menuitem', { name: 'From beginning (F5)' })
    const current = screen.getByRole('menuitem', { name: 'From current slide (Shift+F5)' })
    expect(document.activeElement).toBe(current)
    fireEvent.keyDown(current, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(beginning)
    fireEvent.keyDown(beginning, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(current)
    fireEvent.keyDown(current, { key: 'Home' })
    expect(document.activeElement).toBe(beginning)
    fireEvent.keyDown(beginning, { key: 'End' })
    expect(document.activeElement).toBe(current)
    fireEvent.keyDown(current, { key: 'Home' })
    await userEvent.keyboard(' ')
    expect(onPresent).toHaveBeenCalledTimes(1)
    expect(onPresentCurrent).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu', { name: 'Present menu' })).toBeNull()
  })

  it.each(['Escape', 'Tab'])('dismisses with %s without starting a presentation', async (key) => {
    const { trigger, onPresent, onPresentCurrent } = renderActions()
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    fireEvent.keyDown(document.activeElement, { key })
    expect(screen.queryByRole('menu', { name: 'Present menu' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(onPresent).not.toHaveBeenCalled()
    expect(onPresentCurrent).not.toHaveBeenCalled()
  })

  it('keeps pointer selection distinct from opening or dismissing the menu', () => {
    const { trigger, onPresent, onPresentCurrent } = renderActions()
    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu', { name: 'Present menu' })).toBeNull()
    expect(onPresent).not.toHaveBeenCalled()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'From beginning (F5)' }))
    expect(onPresent).toHaveBeenCalledTimes(1)
    expect(onPresentCurrent).not.toHaveBeenCalled()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'From current slide (Shift+F5)' }))
    expect(onPresent).toHaveBeenCalledTimes(1)
    expect(onPresentCurrent).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu', { name: 'Present menu' })).toBeNull()
  })

  it('activates on native click without responding to a secondary-button press', () => {
    const { trigger, onPresent } = renderActions()
    fireEvent.mouseDown(trigger, { button: 2 })
    fireEvent.contextMenu(trigger)
    expect(screen.queryByRole('menu', { name: 'Present menu' })).toBeNull()
    act(() => trigger.click())
    const beginning = screen.getByRole('menuitem', { name: 'From beginning (F5)' })
    fireEvent.mouseDown(beginning, { button: 2 })
    fireEvent.contextMenu(beginning)
    expect(onPresent).not.toHaveBeenCalled()
    act(() => beginning.click())
    expect(onPresent).toHaveBeenCalledTimes(1)
  })
})
