import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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

  it('dismisses a focused nested modal before its enclosing inspector', () => {
    function Inspector() {
      const [visible, setVisible] = React.useState(true)
      const [trying, setTrying] = React.useState(false)
      return (
        visible && (
          <div
            role="dialog"
            aria-label="Inspector"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              setVisible(false)
              event.stopPropagation()
            }}
          >
            <button type="button" onClick={() => setTrying(true)}>
              Try game
            </button>
            {trying && (
              <ModalShell title="Try game" titleId="try-title" onClose={() => setTrying(false)}>
                <button type="button">Pick</button>
              </ModalShell>
            )}
          </div>
        )
      )
    }
    render(<Inspector />)
    const opener = screen.getByRole('button', { name: 'Try game' })
    opener.focus()
    fireEvent.click(opener)
    const close = screen.getByRole('button', { name: 'Close Try game' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Try game' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Inspector' })).toBeTruthy()
    expect(document.activeElement).toBe(opener)
    fireEvent.keyDown(opener, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Inspector' })).toBeNull()
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
})
