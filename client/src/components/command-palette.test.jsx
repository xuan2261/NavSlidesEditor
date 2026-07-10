import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CommandPalette } from './command-palette'

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    render(<CommandPalette open={false} onClose={vi.fn()} commands={[]} />)
    expect(document.body.textContent).toBe('')
  })

  it('renders command list when open', () => {
    const commands = [
      { id: 'a', label: 'Insert Slide', shortcut: 'Ctrl+M', action: vi.fn() },
    ]
    render(<CommandPalette open={true} onClose={vi.fn()} commands={commands} />)
    expect(document.body.textContent).toContain('Insert Slide')
    expect(document.body.textContent).toContain('Ctrl+M')
  })

  it('[F1] exposes labelled modal dialog semantics and restores focus on Escape', () => {
    const onClose = vi.fn()
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    render(<CommandPalette open={true} onClose={onClose} commands={[]} />)

    expect(screen.getByRole('dialog', { name: 'Command palette' }).getAttribute('aria-modal')).toBe(
      'true'
    )
    expect(screen.getByRole('textbox', { name: 'Search commands' })).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search commands' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('uses tokenized classes for shell colors instead of inline color literals', () => {
    const commands = [
      { id: 'a', label: 'Insert Slide', shortcut: 'Ctrl+M', action: vi.fn() },
    ]
    const { container } = render(<CommandPalette open={true} onClose={vi.fn()} commands={commands} />)

    expect(container.querySelector('[style*="#1e1e2e"]')).toBeNull()
    expect(container.innerHTML).toContain('bg-card')
    expect(container.innerHTML).toContain('text-text-primary')
  })

  it('does not crash when Enter pressed with no matching commands', () => {
    const commands = [
      { id: 'a', label: 'Insert Slide', shortcut: 'Ctrl+M', action: vi.fn() },
    ]
    const onClose = vi.fn()
    render(<CommandPalette open={true} onClose={onClose} commands={commands} />)
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.change(input, { target: { value: 'nonexistent' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(commands[0].action).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls command action and closes on Enter with matching result', () => {
    const actionA = vi.fn()
    const actionB = vi.fn()
    const commands = [
      { id: 'a', label: 'Insert Slide', shortcut: 'Ctrl+M', action: actionA },
      { id: 'b', label: 'Delete Slide', shortcut: 'Ctrl+D', action: actionB },
    ]
    const onClose = vi.fn()
    render(<CommandPalette open={true} onClose={onClose} commands={commands} />)
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(actionB).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('[F1] does not route Enter from a focused result button to the active input result', () => {
    const actionA = vi.fn()
    const actionB = vi.fn()
    const commands = [
      { id: 'a', label: 'Insert Slide', shortcut: 'Ctrl+M', action: actionA },
      { id: 'b', label: 'Delete Slide', shortcut: 'Ctrl+D', action: actionB },
    ]
    render(<CommandPalette open={true} onClose={vi.fn()} commands={commands} />)

    fireEvent.keyDown(screen.getByRole('button', { name: /Delete Slide/ }), { key: 'Enter' })

    expect(actionA).not.toHaveBeenCalled()
  })

  it('filters commands by query', () => {
    const commands = [
      { id: 'a', label: 'Insert Slide', shortcut: 'Ctrl+M', action: vi.fn() },
      { id: 'b', label: 'Delete Slide', shortcut: 'Ctrl+D', action: vi.fn() },
    ]
    render(<CommandPalette open={true} onClose={vi.fn()} commands={commands} />)
    const input = screen.getByPlaceholderText('Type a command...')
    fireEvent.change(input, { target: { value: 'insert' } })
    expect(document.body.textContent).toContain('Insert Slide')
    expect(document.body.textContent).not.toContain('Delete Slide')
  })
})
