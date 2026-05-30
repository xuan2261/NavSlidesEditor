import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Type } from 'lucide-react'
import RibbonBigButton from './ribbon-big-button'

describe('RibbonBigButton', () => {
  it('renders the label and marks itself as a big button', () => {
    render(<RibbonBigButton icon={Type} label="Paste" />)
    const btn = screen.getByRole('button')
    expect(btn.textContent).toContain('Paste')
    expect(btn.getAttribute('data-ribbon-big-button')).not.toBeNull()
  })

  it('calls onClick when activated', () => {
    const onClick = vi.fn()
    render(<RibbonBigButton icon={Type} label="Paste" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('falls back to the label for the accessible name when no title is given', () => {
    render(<RibbonBigButton icon={Type} label="Text Box" />)
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Text Box')
  })

  it('uses the title as the accessible name when provided', () => {
    render(<RibbonBigButton icon={Type} label="Paste" title="Paste (Ctrl+V)" />)
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Paste (Ctrl+V)')
  })

  it('lets an explicit aria-label override both title and label', () => {
    // Lets the visible label differ from the accessible name e2e helpers query.
    render(<RibbonBigButton icon={Type} label="Text Box" title="Text Box" aria-label="Add text" />)
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Add text')
  })

  it('reflects active state via aria-pressed', () => {
    render(<RibbonBigButton icon={Type} label="Paste" active />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('does not set aria-pressed when inactive', () => {
    render(<RibbonBigButton icon={Type} label="Paste" />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBeNull()
  })

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(<RibbonBigButton icon={Type} label="Paste" onClick={onClick} disabled />)
    const btn = screen.getByRole('button')
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('forwards extra props such as onMouseDown and data-testid', () => {
    const onMouseDown = vi.fn()
    render(
      <RibbonBigButton icon={Type} label="Text Box" data-testid="big-text" onMouseDown={onMouseDown} />
    )
    const btn = screen.getByTestId('big-text')
    fireEvent.mouseDown(btn)
    expect(onMouseDown).toHaveBeenCalledTimes(1)
  })
})
