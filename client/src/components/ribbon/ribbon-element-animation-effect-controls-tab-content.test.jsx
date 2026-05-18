import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AnimationsTabContent from './ribbon-element-animation-effect-controls-tab-content'

const mockElement = {
  id: 'el-1',
  type: 'text',
  fragment: true,
  fragmentAnimation: 'fade-in',
  fragmentIndex: 1,
}

describe('AnimationsTabContent', () => {
  it('renders Animation and Preview sections', () => {
    const { container } = render(<AnimationsTabContent selectedElement={mockElement} />)
    const labels = container.querySelectorAll('.text-text-muted')
    const labelTexts = [...labels].map((el) => el.textContent)
    expect(labelTexts).toContain('Animation')
    expect(labelTexts).toContain('Preview')
  })

  it('shows animation On when element has fragment', () => {
    render(<AnimationsTabContent selectedElement={mockElement} />)
    expect(screen.getByText('On')).toBeTruthy()
  })

  it('shows animation Off when element has no fragment', () => {
    render(<AnimationsTabContent selectedElement={{ ...mockElement, fragment: false }} />)
    expect(screen.getByText('Off')).toBeTruthy()
  })

  it('calls onUpdateElement to toggle animation on', () => {
    const onUpdateElement = vi.fn()
    render(
      <AnimationsTabContent
        selectedElement={{ ...mockElement, fragment: false }}
        onUpdateElement={onUpdateElement}
      />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Toggle animation'))
    expect(onUpdateElement).toHaveBeenCalledWith(expect.objectContaining({ fragment: true }))
  })

  it('calls onUpdateElement to toggle animation off', () => {
    const onUpdateElement = vi.fn()
    render(
      <AnimationsTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Toggle animation'))
    expect(onUpdateElement).toHaveBeenCalledWith(expect.objectContaining({ fragment: false }))
  })

  it('shows animation type picker when animation is on', () => {
    render(<AnimationsTabContent selectedElement={mockElement} />)
    expect(screen.getByLabelText('Change animation type')).toBeTruthy()
  })

  it('opens animation picker and selects type', () => {
    const onUpdateElement = vi.fn()
    render(
      <AnimationsTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />,
    )
    fireEvent.mouseDown(screen.getByLabelText('Change animation type'))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Grow' }))
    expect(onUpdateElement).toHaveBeenCalledWith({ fragmentAnimation: 'grow' })
  })

  it('shows order section when animation is on', () => {
    render(<AnimationsTabContent selectedElement={mockElement} />)
    expect(screen.getByLabelText('Animation order')).toBeTruthy()
    expect(screen.getByText('Step')).toBeTruthy()
  })

  it('does not show order section when animation is off', () => {
    render(<AnimationsTabContent selectedElement={{ ...mockElement, fragment: false }} />)
    expect(screen.queryByLabelText('Animation order')).toBeNull()
  })

  it('calls onUpdateElement for order change', () => {
    const onUpdateElement = vi.fn()
    render(
      <AnimationsTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />,
    )
    fireEvent.change(screen.getByLabelText('Animation order'), { target: { value: '3' } })
    expect(onUpdateElement).toHaveBeenCalledWith({ fragmentIndex: 3 })
  })

  it('clamps animation order between 1 and 20', () => {
    const onUpdateElement = vi.fn()
    render(
      <AnimationsTabContent selectedElement={mockElement} onUpdateElement={onUpdateElement} />,
    )
    fireEvent.change(screen.getByLabelText('Animation order'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('Animation order'), { target: { value: '-2' } })
    expect(onUpdateElement).toHaveBeenCalledWith({ fragmentIndex: 20 })
    expect(onUpdateElement).toHaveBeenCalledWith({ fragmentIndex: 1 })
  })

  it('warns when another animated element uses the same order', () => {
    render(
      <AnimationsTabContent
        selectedElement={mockElement}
        slideElements={[
          mockElement,
          { id: 'el-2', type: 'shape', fragment: true, fragmentIndex: 1 },
        ]}
      />,
    )
    expect(screen.getByText('Duplicate order')).toBeTruthy()
  })

  it('renders preview button', () => {
    render(<AnimationsTabContent selectedElement={mockElement} />)
    expect(screen.getByLabelText('Preview animation')).toBeTruthy()
  })

  it('shows current animation label', () => {
    render(<AnimationsTabContent selectedElement={mockElement} />)
    expect(screen.getByText('Fade In')).toBeTruthy()
  })
})
