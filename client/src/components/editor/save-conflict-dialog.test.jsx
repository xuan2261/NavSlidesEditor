import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SaveConflictDialog from './save-conflict-dialog'

describe('SaveConflictDialog', () => {
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
