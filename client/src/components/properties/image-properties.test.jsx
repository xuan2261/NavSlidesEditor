import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ImageProperties from './image-properties'

describe('image accessibility properties', () => {
  it('authors alt and long descriptions and disables them when decorative', () => {
    const onUpdate = vi.fn()
    const { rerender } = render(<ImageProperties element={{ id: 'image', type: 'image', alt: '', decorative: false }} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByLabelText('Image alternative text'), { target: { value: 'A map' } })
    fireEvent.change(screen.getByLabelText('Image long description'), { target: { value: 'Detailed map description' } })
    expect(onUpdate).toHaveBeenCalledWith({ alt: 'A map' })
    expect(onUpdate).toHaveBeenCalledWith({ longDescription: 'Detailed map description' })
    rerender(<ImageProperties element={{ id: 'image', type: 'image', decorative: true }} onUpdate={onUpdate} />)
    expect(screen.getByLabelText('Image alternative text').disabled).toBe(true)
    expect(screen.getByLabelText('Image long description').disabled).toBe(true)
  })

  it('marks image accessibility values mixed and respects locks', () => {
    render(<ImageProperties element={{ id: 'one', type: 'image', alt: 'A', locked: true }} elements={[{ id: 'one', type: 'image', alt: 'A' }, { id: 'two', type: 'image', alt: 'B' }]} selectedElementIds={['one', 'two']} onUpdate={vi.fn()} />)
    expect(screen.getByLabelText('Image alternative text').getAttribute('data-mixed')).toBe('true')
    expect(screen.getByLabelText('Image alternative text').disabled).toBe(true)
  })
})
