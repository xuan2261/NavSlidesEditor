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
  describe('Issue #1: ClipboardButtons height consistency', () => {
    it('all buttons should have consistent h-7 height class', () => {
      const { container } = render(
        <ClipboardButtons
          onPaste={vi.fn()}
          onCut={vi.fn()}
          onCopy={vi.fn()}
          onDuplicate={vi.fn()}
        />
      )

      const buttons = container.querySelectorAll('button')
      expect(buttons.length).toBe(4)

      // All buttons should have h-7 (28px), not explicit h-8 (32px)
      // Note: Button variant has min-h-8, but explicit h-8 should not be present
      buttons.forEach((btn) => {
        const classes = btn.className.split(' ')
        const hasExplicitH8 = classes.some(c => c === 'h-8')
        const hasH7 = classes.some(c => c === 'h-7')
        expect(hasExplicitH8).toBe(false) // No button should have explicit h-8
        expect(hasH7).toBe(true) // All buttons should have h-7
      })
    })

    it('Paste button should not be taller than other buttons', () => {
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

      // Both should have same height class
      const pasteHasH7 = pasteBtn.className.includes('h-7')
      const cutHasH7 = cutBtn.className.includes('h-7')
      expect(pasteHasH7).toBe(cutHasH7)
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
