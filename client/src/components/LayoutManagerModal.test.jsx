import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LayoutManagerModal from './LayoutManagerModal'

const presentation = {
  slides: [{ id: 'slide-1', elements: [] }],
  layoutMasters: [{ id: 'custom-1', name: 'Custom', fixedElements: [], placeholders: [] }],
}

describe('LayoutManagerModal', () => {
  it('creates a bounded uniquely named custom layout', () => {
    const onChange = vi.fn()
    render(<LayoutManagerModal presentation={presentation} onChange={onChange} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Custom layout name'), { target: { value: 'Custom' } })
    fireEvent.click(screen.getByRole('button', { name: /create blank/i }))
    const next = onChange.mock.calls[0][0]
    expect(next.layoutMasters).toHaveLength(2)
    expect(next.layoutMasters[1].name).toBe('Custom 2')
    expect(next.layoutMasters[1].safeArea).toEqual({ x: 48, y: 32, width: 864, height: 476 })
  })

  it('does not offer destructive controls for system layouts', () => {
    render(<LayoutManagerModal presentation={{ ...presentation, layoutMasters: [] }} onChange={vi.fn()} onClose={vi.fn()} />)
    const system = screen.getAllByText('System')[0].closest('li')
    expect(system?.querySelector('[aria-label^="Delete"]')).toBeNull()
  })
})
