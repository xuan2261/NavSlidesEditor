import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import DesignTabContent from './design-tab-content'

const mockPresentation = {
  theme: 'black',
  resolution: { width: 960, height: 540 },
  showFooter: false,
  showPageNumbers: false,
  pageNumberFormat: 'c/t',
  showPresentGrid: false,
  kioskMode: false,
  presenterTools: {
    slideMenu: false,
    chalkboard: false,
    themeToggle: true,
    fontZoom: true,
  },
  autoSlide: 0,
  autoSlideLoop: false,
}

const mockSlide = {
  background: { type: 'color', color: '#1e1e2e' },
}

describe('DesignTabContent', () => {
  it('renders all five sections', () => {
    const { container } = render(<DesignTabContent presentation={mockPresentation} slide={mockSlide} />)
    const labels = container.querySelectorAll('.text-text-muted')
    const labelTexts = [...labels].map((el) => el.textContent)
    expect(labelTexts).toContain('Themes')
    expect(labelTexts).toContain('Background')
    expect(labelTexts).toContain('Slide Size')
    expect(labelTexts).toContain('Footer')
    expect(labelTexts).toContain('Navigation')
  })

  it('shows current theme name', () => {
    render(<DesignTabContent presentation={mockPresentation} slide={mockSlide} />)
    expect(screen.getByText('black')).toBeTruthy()
  })

  it('opens theme gallery on click', () => {
    render(<DesignTabContent presentation={mockPresentation} slide={mockSlide} />)
    fireEvent.mouseDown(screen.getByLabelText('Change theme'))
    expect(screen.getByRole('button', { name: 'white' })).toBeTruthy()
  })

  it('calls onUpdatePresentation when theme selected', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <DesignTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdatePresentation={onUpdatePresentation}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Change theme'))
    fireEvent.mouseDown(screen.getByText('white'))
    expect(onUpdatePresentation).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'white',
        designTokens: expect.objectContaining({
          colors: expect.objectContaining({ bg: '#ffffff' }),
        }),
      })
    )
  })
  it('applies the deck theme to parents and vertical children without altering slide content', () => {
    function Deck() {
      const [presentation, setPresentation] = useState({
        ...mockPresentation,
        designTokens: { colors: { bg: '#ffffff' } },
        slides: [{
          id: 'parent',
          designTokens: { colors: { bg: '#111111' } },
          elements: [{ id: 'text', content: 'Parent content' }],
          children: [{ id: 'child', designTokens: { colors: { bg: '#222222' } }, elements: [{ id: 'child-text', content: 'Child content' }] }],
        }],
      })
      return <>
        <DesignTabContent presentation={presentation} slide={presentation.slides[0]} onUpdatePresentation={setPresentation} />
        <output data-testid="deck-theme">{JSON.stringify(presentation)}</output>
      </>
    }
    render(<Deck />)
    fireEvent.mouseDown(screen.getByLabelText('Change theme'))
    fireEvent.keyDown(screen.getByLabelText('Apply theme to all slides'), { key: 'Enter' })
    const deck = JSON.parse(screen.getByTestId('deck-theme').textContent)
    expect(deck.designTokens.colors.bg).toBe('#ffffff')
    expect(deck.slides).toEqual([{
      id: 'parent',
      elements: [{ id: 'text', content: 'Parent content' }],
      children: [{ id: 'child', elements: [{ id: 'child-text', content: 'Child content' }] }],
    }])
  })

  it('activates a theme swatch with Enter', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <DesignTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdatePresentation={onUpdatePresentation}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Change theme'))
    fireEvent.keyDown(screen.getByRole('button', { name: /Apply theme Minimal White/i }), { key: 'Enter' })

    expect(onUpdatePresentation).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'white' }),
    )
  })

  it('activates footer toggle with Space', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <DesignTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdatePresentation={onUpdatePresentation}
      />,
    )

    fireEvent.keyDown(screen.getByLabelText('Toggle footer'), { key: ' ' })

    expect(onUpdatePresentation).toHaveBeenCalledWith({ showFooter: true })
  })

  it('calls onUpdatePresentation for page numbers toggle', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <DesignTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdatePresentation={onUpdatePresentation}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Toggle page numbers'))
    expect(onUpdatePresentation).toHaveBeenCalledWith({ showPageNumbers: true })
  })

  it('restores footer and presentation settings from the removed menu bar', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <DesignTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdatePresentation={onUpdatePresentation}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Toggle footer'))
    fireEvent.change(screen.getByLabelText('Page number format'), { target: { value: 'n' } })
    fireEvent.mouseDown(screen.getByLabelText('Toggle presenter grid'))
    fireEvent.mouseDown(screen.getByLabelText('Toggle kiosk mode'))
    fireEvent.mouseDown(screen.getByLabelText('Toggle presenter slide menu'))

    expect(onUpdatePresentation).toHaveBeenCalledWith({ showFooter: true })
    expect(onUpdatePresentation).toHaveBeenCalledWith({ pageNumberFormat: 'n' })
    expect(onUpdatePresentation).toHaveBeenCalledWith({ showPresentGrid: true })
    expect(onUpdatePresentation).toHaveBeenCalledWith({ kioskMode: true })
    expect(onUpdatePresentation).toHaveBeenCalledWith({
      presenterTools: { ...mockPresentation.presenterTools, slideMenu: true },
    })
  })

  it('calls onUpdatePresentation for auto-advance toggle', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <DesignTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdatePresentation={onUpdatePresentation}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Toggle auto-advance'))
    expect(onUpdatePresentation).toHaveBeenCalledWith({ autoSlide: 5000 })
  })

  it('calls onUpdatePresentation for loop toggle', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <DesignTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdatePresentation={onUpdatePresentation}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Toggle loop'))
    expect(onUpdatePresentation).toHaveBeenCalledWith({ autoSlideLoop: true })
  })

  it('calls onUpdatePresentation for slide size change', () => {
    const onUpdatePresentation = vi.fn()
    render(
      <DesignTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdatePresentation={onUpdatePresentation}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Set size 4:3'))
    expect(onUpdatePresentation).toHaveBeenCalledWith({ resolution: { width: 960, height: 720 } })
  })

  it('renders size presets with correct labels', () => {
    render(<DesignTabContent presentation={mockPresentation} slide={mockSlide} />)
    expect(screen.getByText('16:9')).toBeTruthy()
    expect(screen.getByText('4:3')).toBeTruthy()
    expect(screen.getByText('Wide')).toBeTruthy()
    expect(screen.getByText('Ultra')).toBeTruthy()
  })

  it('supports image slide backgrounds', () => {
    const onUpdateSlide = vi.fn()
    const { rerender } = render(
      <DesignTabContent
        presentation={mockPresentation}
        slide={mockSlide}
        onUpdateSlide={onUpdateSlide}
      />,
    )

    fireEvent.mouseDown(screen.getByLabelText('Change slide background'))
    fireEvent.mouseDown(screen.getByText('image'))
    rerender(
      <DesignTabContent
        presentation={mockPresentation}
        slide={{ background: { ...mockSlide.background, type: 'image' } }}
        onUpdateSlide={onUpdateSlide}
      />,
    )
    fireEvent.change(screen.getByLabelText('Background image URL'), {
      target: { value: 'https://example.com/bg.png' },
    })

    expect(onUpdateSlide).toHaveBeenCalledWith({
      background: { ...mockSlide.background, type: 'image' },
    })
    expect(onUpdateSlide).toHaveBeenCalledWith({
      background: { ...mockSlide.background, type: 'image', image: 'https://example.com/bg.png' },
    })
  })
})
