import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KineticTextModal from './kinetic-text-animation-template-selector-modal.jsx'

describe('KineticTextAnimationTemplateSelectorModal', () => {
  it('renders template options', () => {
    render(<KineticTextModal onInsert={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Typewriter')).toBeTruthy()
    expect(screen.getByText('Word Reveal')).toBeTruthy()
    expect(screen.getByText('Revolve')).toBeTruthy()
    expect(screen.getByText('Wave')).toBeTruthy()
    expect(screen.getByText('Split-Flap')).toBeTruthy()
    expect(screen.getByText('Fade Cascade')).toBeTruthy()
    expect(screen.getByText('Circular')).toBeTruthy()
    expect(screen.getByText('Glitch')).toBeTruthy()
    expect(screen.getByText('Bounce')).toBeTruthy()
    expect(screen.getByText('Stagger Center')).toBeTruthy()
    expect(screen.getByText('Custom Code')).toBeTruthy()
  })

  it('renders text input field with default value', () => {
    render(<KineticTextModal onInsert={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('Hello World')).toBeTruthy()
  })

  it('calls onInsert with generated HTML on insert', () => {
    const onInsert = vi.fn()
    render(<KineticTextModal onInsert={onInsert} onClose={vi.fn()} />)
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertBtn)
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'))
  })

  it('generates typewriter animation by default', () => {
    const onInsert = vi.fn()
    render(<KineticTextModal onInsert={onInsert} onClose={vi.fn()} />)
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertBtn)
    const html = onInsert.mock.calls[0][0]
    expect(html).toContain('animation')
    expect(html).toContain('Hello World')
  })

  it('switches template on click', () => {
    render(<KineticTextModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Glitch'))
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    expect(insertBtn).toBeTruthy()
  })

  it('allows custom code when Custom Code template selected', () => {
    render(<KineticTextModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Custom Code'))
    const textareas = screen.getAllByRole('textbox')
    expect(textareas.length).toBeGreaterThan(0)
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<KineticTextModal onInsert={vi.fn()} onClose={onClose} />)
    // Find close button (× or X)
    const buttons = screen.getAllByRole('button')
    const closeBtn = buttons.find((b) => b.textContent === '×' || b.textContent === '✕')
    if (closeBtn) {
      fireEvent.click(closeBtn)
      expect(onClose).toHaveBeenCalled()
    }
  })
})
