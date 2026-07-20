import { fireEvent, render, screen, within } from '@testing-library/react'
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
  it('renders an empty navigator while slides are unavailable', () => {
    render(<SlidePanel {...defaultProps({ slides: [], currentIndex: 0 })} />)

    expect(screen.getByRole('navigation', { name: 'Slides' })).toBeTruthy()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('uses semantic lists, sibling actions, and roving focus', () => {
    const onSelect = vi.fn()
    render(<SlidePanel {...defaultProps({ onSelect })} />)

    const navigator = screen.getByRole('navigation', { name: 'Slides' })
    const items = within(navigator).getAllByRole('listitem')
    const selectors = screen.getAllByRole('button', { name: /Select slide \d/ })

    expect(items).toHaveLength(2)
    expect(selectors.map((button) => button.tabIndex)).toEqual([0, -1])
    expect(selectors[0].contains(screen.getByRole('button', { name: 'Duplicate slide 1' }))).toBe(
      false
    )

    selectors[0].focus()
    fireEvent.keyDown(selectors[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(selectors[1])
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('keeps selection attached to stable slide ids after reorder', () => {
    const { rerender } = render(<SlidePanel {...defaultProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select slide 2' }))

    rerender(<SlidePanel {...defaultProps({ slides: [slides[1], slides[0]], currentIndex: 0 })} />)

    expect(
      screen.getByRole('button', { name: 'Select slide 1' }).getAttribute('aria-pressed')
    ).toBe('true')
    expect(
      screen.getByRole('button', { name: 'Select slide 2' }).getAttribute('aria-pressed')
    ).toBe('false')
  })

  it('renders child content through an inert thumbnail preview', () => {
    const child = {
      id: 'child-1',
      elements: [
        { id: 'text', type: 'text', x: 0, y: 0, width: 200, height: 50, content: 'Child copy' },
        { id: 'html', type: 'html', x: 0, y: 60, width: 200, height: 50, content: '<script />' },
      ],
    }
    render(
      <SlidePanel
        {...defaultProps({ slides: [{ ...slides[0], children: [child] }, slides[1]] })}
      />
    )

    const childButton = screen.getByRole('button', { name: 'Select vertical slide 1.1' })
    expect(within(childButton).getByText('Child copy')).toBeTruthy()
    expect(childButton.querySelector('iframe,script,video,audio,[tabindex]')).toBeNull()
    expect(within(childButton).getByText('HTML')).toBeTruthy()
  })

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

  it('[F2] keeps hidden thumbnail actions out of tab order until the slide has focus', () => {
    const onDuplicate = vi.fn()
    const onDelete = vi.fn()
    render(<SlidePanel {...defaultProps({ onDuplicate, onDelete })} />)
    const duplicate = screen.getAllByTitle('Duplicate')[0]

    expect(duplicate.getAttribute('tabindex')).toBe('-1')

    fireEvent.focus(screen.getByRole('button', { name: 'Select slide 1' }))

    expect(duplicate.getAttribute('tabindex')).toBe('0')
    const duplicateAction = screen.getByRole('button', { name: 'Duplicate slide 1' })
    const deleteAction = screen.getByRole('button', { name: 'Delete slide 1' })

    expect(duplicateAction).toBeTruthy()
    expect(deleteAction).toBeTruthy()
    expect(duplicateAction.className).toContain('min-h-11')
    expect(duplicateAction.className).toContain('min-w-11')
    expect(deleteAction.className).toContain('min-h-11')
    expect(deleteAction.className).toContain('min-w-11')
    expect(duplicateAction.parentElement?.className).toContain('[@media(pointer:coarse)]:opacity-100')

    fireEvent.click(duplicateAction)
    fireEvent.click(deleteAction)
    expect(onDuplicate).toHaveBeenCalledWith(0)
    expect(onDelete).toHaveBeenCalledWith(0)
  })
})
