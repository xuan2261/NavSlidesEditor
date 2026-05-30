import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ClipboardButtons from './controls/clipboard-buttons'
import InsertTabContent from './ribbon-insert-tab-element-galleries-panel'

// Big-button hierarchy: a tab's primary action is promoted to a large
// icon-over-label button while secondary actions stay compact.

describe('Home clipboard big-button', () => {
  it('renders Paste as a big button', () => {
    render(<ClipboardButtons onPaste={vi.fn()} onCut={vi.fn()} onCopy={vi.fn()} onDuplicate={vi.fn()} />)
    const paste = screen.getByLabelText('Paste')
    expect(paste.getAttribute('data-ribbon-big-button')).not.toBeNull()
    expect(paste.textContent).toContain('Paste')
  })

  it('keeps Cut / Copy / Duplicate as small buttons', () => {
    render(<ClipboardButtons onPaste={vi.fn()} onCut={vi.fn()} onCopy={vi.fn()} onDuplicate={vi.fn()} />)
    for (const label of ['Cut', 'Copy', 'Duplicate']) {
      expect(screen.getByLabelText(label).getAttribute('data-ribbon-big-button')).toBeNull()
    }
  })

  it('fires onPaste from the big button (preserving editor focus via mousedown)', () => {
    const onPaste = vi.fn()
    render(<ClipboardButtons onPaste={onPaste} onCut={vi.fn()} onCopy={vi.fn()} onDuplicate={vi.fn()} />)
    fireEvent.mouseDown(screen.getByLabelText('Paste'))
    expect(onPaste).toHaveBeenCalledTimes(1)
  })
})

describe('Insert basic big-buttons', () => {
  it('renders Text Box as a big button wired to onAddText', () => {
    const onAddText = vi.fn()
    render(<InsertTabContent onAddText={onAddText} pluginTypes={[]} />)
    const textBox = screen.getByTestId('ribbon-insert-text')
    expect(textBox.getAttribute('data-ribbon-big-button')).not.toBeNull()
    expect(textBox.textContent).toContain('Text Box')
    fireEvent.mouseDown(textBox)
    expect(onAddText).toHaveBeenCalledTimes(1)
  })

  it('renders Picture as a big button wired to the upload handler (not the URL prompt)', () => {
    const onAddImage = vi.fn()
    render(<InsertTabContent onAddImage={onAddImage} pluginTypes={[]} />)
    const picture = screen.getByLabelText('Picture')
    expect(picture.getAttribute('data-ribbon-big-button')).not.toBeNull()
    expect(picture.textContent).toContain('Picture')
    // Picture opens a file dialog (upload), it must not invoke the URL-prompt handler.
    fireEvent.mouseDown(picture)
    expect(onAddImage).not.toHaveBeenCalled()
  })
})
