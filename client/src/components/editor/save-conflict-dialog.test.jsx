import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SaveConflictDialog from './save-conflict-dialog'

describe('SaveConflictDialog', () => {
  it('traps Tab focus and restores the opener when closed', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = render(
      <SaveConflictDialog
        conflict={{ local: { id: 'deck-1' }, remoteGeneration: 4 }}
        onClose={vi.fn()}
        onUseRemote={vi.fn()}
        onKeepLocal={vi.fn()}
      />
    )

    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const keepLocal = screen.getByRole('button', { name: 'Keep Local' })
    expect(document.activeElement).toBe(cancel)

    keepLocal.focus()
    fireEvent.keyDown(keepLocal, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(keepLocal)

    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('keeps stale-generation recovery explicit', () => {
    const onUseRemote = vi.fn()
    const onKeepLocal = vi.fn()
    const onClose = vi.fn()
    render(
      <SaveConflictDialog
        conflict={{ local: { id: 'deck-1' }, remoteGeneration: 4 }}
        onClose={onClose}
        onUseRemote={onUseRemote}
        onKeepLocal={onKeepLocal}
      />
    )

    expect(screen.getByRole('alertdialog', { name: 'Save conflict' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use Remote' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep Local' }))
    fireEvent.keyDown(screen.getByRole('alertdialog', { name: 'Save conflict' }), {
      key: 'Escape',
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onUseRemote).toHaveBeenCalledTimes(1)
    expect(onKeepLocal).toHaveBeenCalledTimes(1)
  })
})
