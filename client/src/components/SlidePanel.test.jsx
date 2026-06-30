import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SlidePanel from './SlidePanel'

const slides = [
  { id: 'slide-1', title: 'Intro', elements: [] },
  { id: 'slide-2', title: 'Agenda', elements: [] },
]

function defaultProps(overrides = {}) {
  return {
    slides,
    currentIndex: 0,
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onDeleteSelected: vi.fn(),
    onDuplicateSelected: vi.fn(),
    onMove: vi.fn(),
    onToggleLock: vi.fn(),
    onToggleAutoAnimate: vi.fn(),
    resolution: { width: 960, height: 540 },
    ...overrides,
  }
}

describe('SlidePanel control contract', () => {
  it('[cap:control.slide-panel] exposes executable slide navigation and actions', () => {
    const onSelect = vi.fn()
    const onAdd = vi.fn()
    render(<SlidePanel {...defaultProps({ onSelect, onAdd })} />)

    const thumbnails = screen.getAllByTestId('slide-panel-item')
    expect(thumbnails).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Select slide 1' }).getAttribute('aria-current')).toBe(
      'true'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select slide 2' }))
    expect(onSelect).toHaveBeenCalledWith(1)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Select slide 1' }), {
      key: 'Enter',
    })
    expect(onSelect).toHaveBeenCalledWith(0)

    fireEvent.click(screen.getByRole('button', { name: 'Add Slide' }))
    expect(onAdd).toHaveBeenCalledTimes(1)

    fireEvent.contextMenu(thumbnails[0], { clientX: 10, clientY: 20 })
    expect(screen.getByRole('menu', { name: 'Slide actions' })).toBeTruthy()
  })
})
