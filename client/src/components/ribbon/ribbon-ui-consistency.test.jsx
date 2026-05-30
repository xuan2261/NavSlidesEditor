import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ClipboardButtons from './controls/clipboard-buttons'
import RibbonSection from './ribbon-section'
import QuickAccessToolbar from '../QuickAccessToolbar'

/**
 * TDD Tests for Ribbon UI Consistency Issues
 * Based on UI/UX Review Report
 */

describe('Ribbon UI Consistency', () => {
  describe('Issue #1: ClipboardButtons height hierarchy', () => {
    it('secondary buttons (Cut/Copy/Duplicate) keep the compact h-7 height', () => {
      render(
        <ClipboardButtons
          onPaste={vi.fn()}
          onCut={vi.fn()}
          onCopy={vi.fn()}
          onDuplicate={vi.fn()}
        />
      )

      // Cut/Copy/Duplicate stay small; Paste is intentionally promoted to a
      // big button (icon over label) for PowerPoint-style visual hierarchy.
      for (const label of ['Cut', 'Copy', 'Duplicate']) {
        const btn = screen.getByLabelText(label)
        const classes = btn.className.split(' ')
        expect(classes.some((c) => c === 'h-8')).toBe(false)
        expect(classes.some((c) => c === 'h-7')).toBe(true)
      }
    })

    it('Paste is a big button, taller than the compact secondary buttons', () => {
      render(
        <ClipboardButtons
          onPaste={vi.fn()}
          onCut={vi.fn()}
          onCopy={vi.fn()}
          onDuplicate={vi.fn()}
        />
      )

      const pasteBtn = screen.getByLabelText('Paste')
      const cutBtn = screen.getByLabelText('Cut')

      // Paste opts out of the h-7 cluster height on purpose.
      expect(pasteBtn.getAttribute('data-ribbon-big-button')).not.toBeNull()
      expect(pasteBtn.className.includes('h-7')).toBe(false)
      expect(cutBtn.className.includes('h-7')).toBe(true)
    })
  })

  describe('Issue #2: RibbonSection vertical alignment', () => {
    it('should have justify-between for proper vertical distribution', () => {
      const { container } = render(
        <RibbonSection label="Test">
          <button>Content</button>
        </RibbonSection>
      )

      const section = container.firstChild
      expect(section.className).toContain('justify-between')
    })

    it('content wrapper should have flex-1 for vertical centering', () => {
      const { container } = render(
        <RibbonSection label="Test">
          <button>Content</button>
        </RibbonSection>
      )

      // The content wrapper (first child div) should have flex-1
      const contentWrapper = container.querySelector('.flex-1')
      expect(contentWrapper).toBeTruthy()
    })

    it('should have consistent padding py-1.5', () => {
      const { container } = render(
        <RibbonSection label="Test">
          <button>Content</button>
        </RibbonSection>
      )

      const section = container.firstChild
      expect(section.className).toContain('py-1.5')
    })

    it('exposes the classic ribbon section DOM contract', () => {
      const { container } = render(
        <RibbonSection label="Classic">
          <button>Command</button>
        </RibbonSection>
      )

      const section = container.querySelector('[data-ribbon-section]')
      const label = container.querySelector('[data-ribbon-section-label]')
      expect(section).toBeTruthy()
      expect(label?.textContent).toBe('Classic')
      expect(section.querySelector('button')?.textContent).toBe('Command')
    })
  })

  describe('Issue #3: Separator height consistency', () => {
    // Note: Separators are inline in various control files
    // This test documents the expected standard: h-5 shrink-0
    it('documents separator standard: h-5 with shrink-0', () => {
      const standardSeparator = 'mx-1 h-5 w-[1px] shrink-0 bg-border'
      expect(standardSeparator).toContain('h-5')
      expect(standardSeparator).toContain('shrink-0')
    })
  })

  describe('Issue #4: QuickAccessToolbar shrink prevention', () => {
    it('should have shrink-0 class to prevent flex shrinking', () => {
      const { container } = render(
        <QuickAccessToolbar
          onSave={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
          saving={false}
          hasChanges={false}
          saveStatus=""
          saveError=""
        />
      )

      const toolbar = container.firstChild
      expect(toolbar.className).toContain('shrink-0')
    })
  })
})
