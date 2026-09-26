import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import SlideSorterView from './SlideSorterView'

const slides = [
  { id: 's1', elements: [] },
  { id: 's2', elements: [] },
  { id: 's3', elements: [] },
]

function setup(overrides = {}) {
  const props = {
    slides,
    currentIndex: 0,
    onSelect: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  render(<SlideSorterView {...props} />)
  return props
}

describe('SlideSorterView Phase 1 UX', () => {
  it('renders slide number above the mini preview (on top)', () => {
    setup()
    const card = screen.getByTitle('Slide 1')
    const indicator = card.querySelector('[data-testid="slide-sorter-number-1"]')
    const preview = card.querySelector('[data-testid="slide-sorter-preview-0"]')
    expect(indicator).toBeTruthy()
    expect(preview).toBeTruthy()
    // Number node should come before preview node in DOM order
    expect(indicator.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows all visible slide content at the presentation resolution with its master theme', () => {
    const elements = Array.from({ length: 6 }, (_, index) => ({
      id: `text-${index}`, type: 'text', x: 10, y: index * 60, width: 400, height: 50,
      content: `Paragraph ${index + 1}`, hidden: index === 1,
    }))
    setup({
      slides: [{ id: 'themed', layoutId: 'master', elements }], resolution: { width: 800, height: 600 },
      designTokens: { colors: { bg: '#ffffff' } },
      layoutMasters: [{ id: 'master', name: 'Dark master', tokens: { colors: { bg: '#101020' } }, fixedElements: [], placeholders: [] }],
    })
    const preview = screen.getByTestId('slide-sorter-preview-0')
    expect(preview.style.aspectRatio).toBe('800 / 600')
    expect(preview.style.backgroundColor).toBe('rgb(16, 16, 32)')
    expect(screen.getByText('Paragraph 6')).toBeTruthy()
    expect(screen.queryByText('Paragraph 2')).toBeNull()
  })

  it('pressing Esc calls onClose', () => {
    const onClose = vi.fn()
    setup({ onClose })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('single-click does NOT navigate (only selects)', () => {
    const onSelect = vi.fn()
    setup({ onSelect })
    fireEvent.click(screen.getByTitle('Slide 2'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('double-click navigates to the slide', () => {
    const onSelect = vi.fn()
    setup({ onSelect })
    fireEvent.doubleClick(screen.getByTitle('Slide 2'))
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('shows bulk-action toolbar when 2+ slides are selected', () => {
    setup()
    fireEvent.click(screen.getByTitle('Slide 1'))
    fireEvent.click(screen.getByTitle('Slide 2'), { ctrlKey: true })
    expect(screen.getByTestId('slide-sorter-bulk-toolbar')).toBeTruthy()
    expect(screen.getByText(/2 selected/i)).toBeTruthy()
  })

  it('bulk delete calls onDelete for each selected slide (highest index first)', () => {
    const onDelete = vi.fn()
    setup({ onDelete })
    fireEvent.click(screen.getByTitle('Slide 1'))
    fireEvent.click(screen.getByTitle('Slide 2'), { ctrlKey: true })
    fireEvent.click(screen.getByTestId('slide-sorter-bulk-delete'))
    expect(onDelete).toHaveBeenCalledTimes(2)
    expect(onDelete.mock.calls[0][0]).toBeGreaterThan(onDelete.mock.calls[1][0])
  })

  it('bulk duplicate calls onDuplicate for each selected slide', () => {
    const onDuplicate = vi.fn()
    setup({ onDuplicate })
    fireEvent.click(screen.getByTitle('Slide 1'))
    fireEvent.click(screen.getByTitle('Slide 3'), { ctrlKey: true })
    fireEvent.click(screen.getByTestId('slide-sorter-bulk-duplicate'))
    expect(onDuplicate).toHaveBeenCalledTimes(2)
  })
})
