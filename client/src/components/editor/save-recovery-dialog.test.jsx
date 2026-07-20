import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SaveRecoveryDialog from './save-recovery-dialog'

describe('SaveRecoveryDialog', () => {
  it('requires an explicit remote or local draft choice', () => {
    const onUseLocal = vi.fn()
    const onUseRemote = vi.fn()
    render(
      <SaveRecoveryDialog
        draft={{ id: 'deck-1', snapshot: { title: 'Local' } }}
        onUseLocal={onUseLocal}
        onUseRemote={onUseRemote}
      />
    )

    const dialog = screen.getByRole('alertdialog', { name: 'Recover interrupted save' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Use Remote' }))
    fireEvent.click(screen.getByRole('button', { name: 'Recover Local Draft' }))

    expect(onUseRemote).toHaveBeenCalledTimes(1)
    expect(onUseLocal).toHaveBeenCalledTimes(1)
  })

  it('traps focus and lets Escape defer the draft without choosing a version', () => {
    const onDefer = vi.fn()
    render(
      <SaveRecoveryDialog
        draft={{ id: 'deck-1', snapshot: { title: 'Local' } }}
        onUseLocal={vi.fn()}
        onUseRemote={vi.fn()}
        onDefer={onDefer}
      />
    )

    const local = screen.getByRole('button', { name: 'Recover Local Draft' })
    const defer = screen.getByRole('button', { name: 'Keep Draft for Later' })
    expect(document.activeElement).toBe(local)
    fireEvent.keyDown(local, { key: 'Tab' })
    expect(document.activeElement).toBe(defer)
    fireEvent.keyDown(local, { key: 'Escape' })
    expect(onDefer).toHaveBeenCalledTimes(1)
  })
})
