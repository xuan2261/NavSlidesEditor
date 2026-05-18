import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TransitionsTabContent from './transitions-tab-content'

const mockPresentation = {
  transition: 'slide',
  transitionSpeed: 'default',
  autoSlide: 0,
}

const mockSlide = {
  transition: 'fade',
  transitionDirection: 'left',
  transitionDuration: 900,
}

describe('TransitionsTabContent', () => {
  it('renders all four sections', () => {
    const { container } = render(<TransitionsTabContent presentation={mockPresentation} />)
    const labels = container.querySelectorAll('.text-text-muted')
    const labelTexts = [...labels].map((el) => el.textContent)
    expect(labelTexts).toContain('Transition')
    expect(labelTexts).toContain('Speed')
    expect(labelTexts).toContain('Auto-Advance')
    expect(labelTexts).toContain('Preview')
  })

  it('shows current transition name', () => {
    render(<TransitionsTabContent presentation={mockPresentation} />)
    expect(screen.getByText('slide')).toBeTruthy()
  })

  it('opens transition picker on click', () => {
    render(<TransitionsTabContent presentation={mockPresentation} />)
    fireEvent.mouseDown(screen.getByLabelText('Change transition'))
    expect(screen.getByRole('button', { name: 'fade' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'zoom' })).toBeTruthy()
  })

  it('calls onUpdatePresentation when transition selected', () => {
    const onUpdatePresentation = vi.fn()
    render(<TransitionsTabContent presentation={mockPresentation} onUpdatePresentation={onUpdatePresentation} />)
    fireEvent.mouseDown(screen.getByLabelText('Change transition'))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'fade' }))
    expect(onUpdatePresentation).toHaveBeenCalledWith({ transition: 'fade' })
  })

  it('uses slide transition override when present', () => {
    render(<TransitionsTabContent presentation={mockPresentation} slide={mockSlide} />)
    expect(screen.getByText('fade')).toBeTruthy()
  })

  it('updates slide transition override when slide updater is available', () => {
    const onUpdateSlide = vi.fn()
    render(
      <TransitionsTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdateSlide={onUpdateSlide}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Change transition'))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'zoom' }))
    expect(onUpdateSlide).toHaveBeenCalledWith({ transition: 'zoom' })
  })

  it('clears slide transition override to use presentation default', () => {
    const onUpdateSlide = vi.fn()
    render(
      <TransitionsTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdateSlide={onUpdateSlide}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Use presentation transition default'))
    expect(onUpdateSlide).toHaveBeenCalledWith({
      transition: undefined,
      transitionDirection: undefined,
      transitionDuration: undefined,
    })
  })

  it('renders speed buttons', () => {
    render(<TransitionsTabContent presentation={mockPresentation} />)
    expect(screen.getByLabelText('Set speed Default')).toBeTruthy()
    expect(screen.getByLabelText('Set speed Fast')).toBeTruthy()
    expect(screen.getByLabelText('Set speed Slow')).toBeTruthy()
  })

  it('updates slide transition direction and duration overrides', () => {
    const onUpdateSlide = vi.fn()
    render(
      <TransitionsTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdateSlide={onUpdateSlide}
      />,
    )
    fireEvent.change(screen.getByLabelText('Slide transition direction'), { target: { value: 'right' } })
    fireEvent.change(screen.getByLabelText('Slide transition duration milliseconds'), { target: { value: '1200' } })
    expect(onUpdateSlide).toHaveBeenCalledWith({ transitionDirection: 'right' })
    expect(onUpdateSlide).toHaveBeenCalledWith({ transitionDuration: 1200 })
  })

  it('calls onUpdatePresentation for speed change', () => {
    const onUpdatePresentation = vi.fn()
    render(<TransitionsTabContent presentation={mockPresentation} onUpdatePresentation={onUpdatePresentation} />)
    fireEvent.mouseDown(screen.getByLabelText('Set speed Fast'))
    expect(onUpdatePresentation).toHaveBeenCalledWith({ transitionSpeed: 'fast' })
  })

  it('calls onUpdatePresentation for auto-advance toggle', () => {
    const onUpdatePresentation = vi.fn()
    render(<TransitionsTabContent presentation={mockPresentation} onUpdatePresentation={onUpdatePresentation} />)
    fireEvent.mouseDown(screen.getByLabelText('Toggle auto-advance'))
    expect(onUpdatePresentation).toHaveBeenCalledWith({ autoSlide: 5000 })
  })

  it('shows interval input when auto-advance is on', () => {
    render(<TransitionsTabContent presentation={{ ...mockPresentation, autoSlide: 5000 }} />)
    expect(screen.getByLabelText('Auto-advance interval seconds')).toBeTruthy()
    expect(screen.getByText('sec')).toBeTruthy()
  })

  it('renders preview button', () => {
    render(<TransitionsTabContent presentation={mockPresentation} />)
    expect(screen.getByLabelText('Preview transition')).toBeTruthy()
  })
})
