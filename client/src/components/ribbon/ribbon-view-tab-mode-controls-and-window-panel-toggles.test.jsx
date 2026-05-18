import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ViewTabContent from './ribbon-view-mode-controls-content'

describe('ViewTabContent', () => {
  it('renders Show and Window sections', () => {
    const { container } = render(<ViewTabContent />)
    const labels = container.querySelectorAll('.text-text-muted')
    const labelTexts = [...labels].map((el) => el.textContent)
    expect(labelTexts).toContain('Show')
    expect(labelTexts).toContain('Window')
  })

  it('renders canvas control buttons from Show section', () => {
    render(<ViewTabContent />)
    expect(screen.getByLabelText('Toggle grid')).toBeTruthy()
    expect(screen.getByLabelText('Toggle smart guides')).toBeTruthy()
    expect(screen.getByLabelText('Toggle rulers')).toBeTruthy()
  })

  it('renders zoom controls from Show section', () => {
    render(<ViewTabContent />)
    expect(screen.getByLabelText('Zoom in')).toBeTruthy()
    expect(screen.getByLabelText('Zoom out')).toBeTruthy()
    expect(screen.getByLabelText('Reset zoom')).toBeTruthy()
  })

  it('renders window panel toggles', () => {
    render(<ViewTabContent />)
    expect(screen.getByLabelText('Toggle slide panel')).toBeTruthy()
    expect(screen.getByLabelText('Toggle properties panel')).toBeTruthy()
  })

  it('shows panel labels', () => {
    render(<ViewTabContent />)
    expect(screen.getByText('Slides')).toBeTruthy()
    expect(screen.getByText('Properties')).toBeTruthy()
  })

  it('renders legacy View menu actions', () => {
    render(<ViewTabContent />)
    expect(screen.getByLabelText('Find & Replace')).toBeTruthy()
    expect(screen.getByLabelText('Animation Timeline')).toBeTruthy()
    expect(screen.getByLabelText('Custom CSS')).toBeTruthy()
    expect(screen.getByLabelText('Speaker Notes')).toBeTruthy()
    expect(screen.getByLabelText('Slide Sorter')).toBeTruthy()
  })

  it('calls View action callbacks', () => {
    const onFindReplace = vi.fn()
    const onSpeakerNotes = vi.fn()
    const onToggleSlideSorter = vi.fn()
    render(
      <ViewTabContent
        onFindReplace={onFindReplace}
        onSpeakerNotes={onSpeakerNotes}
        onToggleSlideSorter={onToggleSlideSorter}
      />,
    )

    fireEvent.click(screen.getByLabelText('Find & Replace'))
    fireEvent.click(screen.getByLabelText('Speaker Notes'))
    fireEvent.mouseDown(screen.getByLabelText('Slide Sorter'))

    expect(onFindReplace).toHaveBeenCalled()
    expect(onSpeakerNotes).toHaveBeenCalled()
    expect(onToggleSlideSorter).toHaveBeenCalled()
  })
})
