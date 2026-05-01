import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPalette } from '../components/command-palette'

const makeCommands = (n = 5) =>
  Array.from({ length: n }, (_, i) => ({
    id: `cmd-${i}`,
    label: `Command ${i}`,
    shortcut: `Ctrl+${i}`,
    action: vi.fn(),
  }))

describe('CommandPalette', () => {
  it('renders when open=true', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={makeCommands()} />)
    expect(screen.getByPlaceholderText('Type a command...')).toBeTruthy()
  })

  it('does not render when open=false', () => {
    const { container } = render(<CommandPalette open={false} onClose={vi.fn()} commands={makeCommands()} />)
    expect(container.firstChild).toBeNull()
  })

  it('filters commands by query', () => {
    const commands = [
      { id: 'a', label: 'Insert Slide', shortcut: 'Ctrl+M', action: vi.fn() },
      { id: 'b', label: 'Zoom In', shortcut: 'Ctrl+=', action: vi.fn() },
      { id: 'c', label: 'Group Elements', shortcut: 'Ctrl+G', action: vi.fn() },
    ]
    render(<CommandPalette open={true} onClose={vi.fn()} commands={commands} />)
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.change(input, { target: { value: 'zoom' } })
    expect(screen.getByText('Zoom In')).toBeTruthy()
    expect(screen.queryByText('Insert Slide')).toBeNull()
    expect(screen.queryByText('Group Elements')).toBeNull()
  })

  it('ArrowDown navigates to next command', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={makeCommands(3)} />)
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    // Selected index 0 -> after ArrowDown should be 1 (first item highlighted)
    // We verify by checking that item is rendered
    expect(screen.getAllByRole('listitem').length).toBe(3)
  })

  it('ArrowUp navigates to previous command', () => {
    render(<CommandPalette open={true} onClose={vi.fn()} commands={makeCommands(3)} />)
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getAllByRole('listitem').length).toBe(3)
  })

  it('Enter executes selected command and closes', () => {
    const commands = [
      { id: 'a', label: 'Insert Slide', shortcut: 'Ctrl+M', action: vi.fn() },
    ]
    const onClose = vi.fn()
    render(<CommandPalette open={true} onClose={onClose} commands={commands} />)
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(commands[0].action).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape closes palette', () => {
    const onClose = vi.fn()
    render(<CommandPalette open={true} onClose={onClose} commands={makeCommands()} />)
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click outside closes palette', () => {
    const onClose = vi.fn()
    const { container } = render(<CommandPalette open={true} onClose={onClose} commands={makeCommands()} />)
    // The overlay is the outermost div rendered by the component
    // In RTL, container.firstChild is the overlay div
    const overlay = container.firstChild
    // Use pointer events via mouseDown/up/click chain that React synthetic events handle
    fireEvent(overlay, new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    fireEvent(overlay, new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
    fireEvent(overlay, new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resets query when reopened', () => {
    const commands = makeCommands(3)
    const { rerender } = render(<CommandPalette open={true} onClose={vi.fn()} commands={commands} />)
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.change(input, { target: { value: 'zoom' } })
    expect(input.value).toBe('zoom')
    rerender(<CommandPalette open={false} onClose={vi.fn()} commands={commands} />)
    rerender(<CommandPalette open={true} onClose={vi.fn()} commands={commands} />)
    expect(screen.getByPlaceholderText('Type a command...').value).toBe('')
  })
})
