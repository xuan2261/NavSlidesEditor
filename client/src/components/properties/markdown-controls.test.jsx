import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MiscProperties from './misc-properties'

const md = { id: 'm1', type: 'markdown', content: '# Hi' }

describe('Phase 2: markdown controls in MiscProperties', () => {
  it('renders a Text Color control that writes textColor', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={md} onUpdate={onUpdate} />)
    const picker = screen.getByTestId('prop-markdown-text-color')
    fireEvent.change(picker, { target: { value: '#ff0000' } })
    expect(onUpdate).toHaveBeenCalledWith({ textColor: '#ff0000' })
  })

  it('renders a Font Size control that writes fontSize', () => {
    const onUpdate = vi.fn()
    render(<MiscProperties element={md} onUpdate={onUpdate} />)
    const input = screen.getByTestId('prop-markdown-font-size')
    fireEvent.change(input, { target: { value: '24' } })
    expect(onUpdate).toHaveBeenCalledWith({ fontSize: 24 })
  })
})
