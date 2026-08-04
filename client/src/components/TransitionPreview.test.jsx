import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TransitionPreview from './TransitionPreview.jsx'

describe('TransitionPreview', () => {
  it('isolates preview scripts from the editor origin', () => {
    render(
      <TransitionPreview
        presentation={{
          theme: 'black',
          transition: 'slide',
          slides: [{ elements: [] }, { elements: [] }],
        }}
        fromIndex={0}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByTitle('Transition Preview').getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('exposes an accessible dialog and closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <TransitionPreview
        presentation={{ slides: [{ elements: [] }, { elements: [] }] }}
        fromIndex={0}
        onClose={onClose}
      />
    )

    const dialog = screen.getByRole('dialog', { name: 'Transition Preview' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('combobox', { name: 'Transition' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Replay preview' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close preview' })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('explains when the selected slide has no next slide', () => {
    const onClose = vi.fn()
    render(
      <TransitionPreview
        presentation={{ slides: [{ elements: [] }] }}
        fromIndex={0}
        onClose={onClose}
      />
    )

    expect(screen.getByText('There is no next slide to preview.')).toBeTruthy()
    expect(screen.queryByTitle('Transition Preview')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
