import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ModalShell, useModalFocusTrap } from './ModalShell'

function CustomTrapModal() {
  const { dialogRef, handleFocusTrapKeyDown } = useModalFocusTrap({ autoFocus: false })
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" onKeyDown={handleFocusTrapKeyDown}>
      <button type="button">First</button>
      <textarea aria-label="Editor" autoFocus onKeyDown={(event) => event.preventDefault()} />
    </div>
  )
}

describe('ModalShell', () => {
  it('renders an accessible dialog shell with a labelled title and close button', () => {
    const html = renderToString(
      <ModalShell titleId="sample-modal-title" title="Sample modal" onClose={() => {}}>
        <p>Body content</p>
      </ModalShell>
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="sample-modal-title"')
    expect(html).toContain('id="sample-modal-title"')
    expect(html).toContain('Sample modal')
    expect(html).toContain('aria-label="Close Sample modal"')
    expect(html).toContain('Body content')
  })

  it('uses viewport-safe width classes by size', () => {
    const html = renderToString(
      <ModalShell titleId="wide-modal-title" title="Wide modal" size="xl" onClose={() => {}}>
        Wide
      </ModalShell>
    )

    expect(html).toContain('max-w-[800px]')
    expect(html).toContain('max-h-[90vh]')
    expect(html).toContain('overflow-hidden')
  })

  it('supports large viewport-safe product modals', () => {
    const html = renderToString(
      <ModalShell titleId="media-modal-title" title="Media library" size="2xl" onClose={() => {}}>
        Media
      </ModalShell>
    )

    expect(html).toContain('max-w-[960px]')
    expect(html).toContain('w-full')
  })

  it('supports sticky footer actions outside the scroll body', () => {
    const html = renderToString(
      <ModalShell
        titleId="action-modal-title"
        title="Action modal"
        onClose={() => {}}
        footer={<button type="button">Create</button>}
      >
        Body
      </ModalShell>
    )

    expect(html).toContain('data-testid="modal-shell-footer"')
    expect(html).toContain('sticky bottom-0')
    expect(html).toContain('Create')
  })

  it('closes on Escape after rerenders update the close callback', () => {
    const firstClose = vi.fn()
    const latestClose = vi.fn()

    const { rerender } = render(
      <ModalShell titleId="escape-modal-title" title="Escape modal" onClose={firstClose}>
        Loading
      </ModalShell>
    )

    rerender(
      <ModalShell titleId="escape-modal-title" title="Escape modal" onClose={latestClose}>
        Loaded
      </ModalShell>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(firstClose).not.toHaveBeenCalled()
    expect(latestClose).toHaveBeenCalledTimes(1)
  })

  it('only closes the topmost modal on Escape and removes unmounted modals from the stack', () => {
    const underlyingClose = vi.fn()
    const topmostClose = vi.fn()

    const { rerender, unmount } = render(
      <>
        <ModalShell titleId="underlying-title" title="Underlying" onClose={underlyingClose}>
          Underlying body
        </ModalShell>
        <ModalShell titleId="topmost-title" title="Topmost" onClose={topmostClose}>
          Topmost body
        </ModalShell>
      </>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(topmostClose).toHaveBeenCalledTimes(1)
    expect(underlyingClose).not.toHaveBeenCalled()

    rerender(
      <ModalShell titleId="underlying-title" title="Underlying" onClose={underlyingClose}>
        Underlying body
      </ModalShell>
    )
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(underlyingClose).toHaveBeenCalledTimes(1)

    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(underlyingClose).toHaveBeenCalledTimes(1)
  })

  it('[red defect:modal.focus] traps Tab inside the dialog and restores opener focus', () => {
    render(<button type="button">Open modal</button>)
    const opener = screen.getByText('Open modal')
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const { unmount } = render(
      <ModalShell
        titleId="focus-modal-title"
        title="Focus modal"
        onClose={() => {}}
        footer={<button type="button">Save</button>}
      >
        <button type="button">Body action</button>
      </ModalShell>
    )

    const close = screen.getByTestId('modal-shell-close-btn')
    const save = screen.getByText('Save')
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(screen.getByTestId('modal-shell-overlay'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(save)

    fireEvent.keyDown(screen.getByTestId('modal-shell-overlay'), { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    unmount()
    expect(document.activeElement).toBe(opener)
  })

  it('[red defect:modal.focus] preserves opener restore and child-owned Tab behavior', () => {
    render(<button type="button">Open custom modal</button>)
    const opener = screen.getByText('Open custom modal')
    opener.focus()

    const { unmount } = render(<CustomTrapModal />)
    const editor = screen.getByLabelText('Editor')
    editor.focus()

    fireEvent.keyDown(editor, { key: 'Tab' })
    expect(document.activeElement).toBe(editor)

    unmount()
    expect(document.activeElement).toBe(opener)
  })

  it('ignores missing or non-function Escape close handlers', () => {
    const { rerender } = render(
      <ModalShell titleId="optional-close-title" title="Optional close">
        Body
      </ModalShell>
    )

    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()

    rerender(
      <ModalShell titleId="optional-close-title" title="Optional close" onClose="invalid">
        Body
      </ModalShell>
    )

    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()
  })
})
