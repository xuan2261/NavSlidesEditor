import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LivePresentationModal from './LivePresentationModal'

vi.mock('lucide-react', () => ({ Play: () => null, X: () => null }))
vi.mock('../components/ui', async () => {
  const React = await import('react')
  const Button = React.forwardRef(function MockButton({ children, ...props }, ref) {
    return <button ref={ref} {...props}>{children}</button>
  })
  Button.displayName = 'MockButton'
  return {
    Button,
    ModalShell: ({ children }) => <div>{children}</div>,
  }
})

describe('LivePresentationModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('assigns the launch context before navigating the presenter popup', () => {
    const presenterWindow = { name: '', location: { href: '' } }
    const open = vi.spyOn(window, 'open').mockReturnValue(presenterWindow)
    const onPresenterWindowOpened = vi.fn()
    const onClose = vi.fn()

    render(
      <LivePresentationModal
        presentationId="deck-1"
        roomCode="ROOM1"
        presenterToken="presenter-token"
        onPresenterWindowOpened={onPresenterWindowOpened}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /start presenting/i }))

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(JSON.parse(presenterWindow.name)).toEqual({
      presentationId: 'deck-1',
      roomCode: 'ROOM1',
      presenterToken: 'presenter-token',
    })
    expect(onPresenterWindowOpened).toHaveBeenCalledWith({
      presenterWindow,
      presentationId: 'deck-1',
      roomCode: 'ROOM1',
    })
    expect(presenterWindow.location.href).toBe('/api/presentations/deck-1/present?live=ROOM1')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
