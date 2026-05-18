import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import RibbonSection from './ribbon-section'

describe('RibbonSection', () => {
  it('renders children and label', () => {
    render(
      <RibbonSection label="Test Label">
        <button>Test Button</button>
      </RibbonSection>
    )
    expect(screen.getByText('Test Label')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Test Button' })).toBeTruthy()
  })

  it('renders without label when not provided', () => {
    const { container } = render(
      <RibbonSection>
        <span>Content</span>
      </RibbonSection>
    )
    const labels = container.querySelectorAll('.text-text-muted')
    expect(labels.length).toBe(0)
  })

  it('applies custom className', () => {
    const { container } = render(
      <RibbonSection className="border-r border-border">
        <span>Content</span>
      </RibbonSection>
    )
    const section = container.firstChild
    expect(section.className).toContain('border-r')
    expect(section.className).toContain('border-border')
  })

  it('has shrink-0 class to prevent flex shrinking', () => {
    const { container } = render(
      <RibbonSection label="Test">
        <span>Content</span>
      </RibbonSection>
    )
    const section = container.firstChild
    expect(section.className).toContain('shrink-0')
  })

  it('maintains minimum content width in flex container', () => {
    const { container } = render(
      <div className="flex w-[100px] overflow-x-auto">
        <RibbonSection label="Section 1">
          <button className="w-[200px]">Wide Button</button>
        </RibbonSection>
        <RibbonSection label="Section 2">
          <button className="w-[200px]">Wide Button 2</button>
        </RibbonSection>
      </div>
    )
    const sections = container.querySelectorAll('.shrink-0')
    expect(sections.length).toBe(2)
  })
})
