import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PromptPopover from './PromptPopover'

describe('PromptPopover accessibility contract', () => {
  it('labels the modal and input, traps focus, cancels with Escape, and restores focus', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const trigger = document.createElement('button')
    trigger.textContent = 'Open prompt'
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(
      <PromptPopover title="Image URL" label="Image source URL" onSubmit={vi.fn()} onCancel={onCancel} />
    )

    expect(screen.getByRole('dialog', { name: 'Image URL' })).toBeTruthy()
    const input = screen.getByRole('textbox', { name: 'Image source URL' })
    expect(document.activeElement).toBe(input)

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()

    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('keeps unsafe values in the modal and exposes the validation error', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <PromptPopover
        title="Insert link"
        label="Link URL"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        validate={(value) => (value.startsWith('https://') ? '' : 'Enter a safe link URL.')}
      />
    )

    const input = screen.getByRole('textbox', { name: 'Link URL' })
    await user.type(input, 'javascript:alert(1){Enter}')

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('Enter a safe link URL.')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id)
  })

  it('loops focus forward and submits a valid value once', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <PromptPopover
        title="Insert link"
        label="Link URL"
        description="Use a public URL"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    )

    const input = screen.getByRole('textbox', { name: 'Link URL' })
    const description = screen.getByText('Use a public URL')
    expect(input.getAttribute('aria-describedby')).toContain(description.id)
    await user.type(input, 'https://example.com')
    screen.getByRole('button', { name: 'OK' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(input)
    await user.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith('https://example.com')
  })

  it('cancels from the backdrop and gives simultaneous prompts unique IDs', () => {
    const firstCancel = vi.fn()
    const secondCancel = vi.fn()
    const { container } = render(
      <>
        <PromptPopover title="First prompt" label="First URL" onSubmit={vi.fn()} onCancel={firstCancel} />
        <PromptPopover title="Second prompt" label="Second URL" onSubmit={vi.fn()} onCancel={secondCancel} />
      </>
    )

    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs[0].getAttribute('aria-labelledby')).not.toBe(dialogs[1].getAttribute('aria-labelledby'))
    const backdrops = container.querySelectorAll('[aria-hidden="true"].absolute.inset-0')
    fireEvent.mouseDown(backdrops[0])
    expect(firstCancel).toHaveBeenCalledOnce()
  })

  it('routes Escape only to the topmost prompt', async () => {
    const user = userEvent.setup()
    const firstCancel = vi.fn()
    const secondCancel = vi.fn()
    render(
      <>
        <PromptPopover title="First prompt" onSubmit={vi.fn()} onCancel={firstCancel} />
        <PromptPopover title="Second prompt" onSubmit={vi.fn()} onCancel={secondCancel} />
      </>
    )

    await user.keyboard('{Escape}')
    expect(firstCancel).not.toHaveBeenCalled()
    expect(secondCancel).toHaveBeenCalledOnce()
  })

  it('restores focus when the owning parent dismisses the prompt', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open link prompt</button>
          {open && (
            <PromptPopover
              title="Insert link"
              onSubmit={() => setOpen(false)}
              onCancel={() => setOpen(false)}
            />
          )}
        </>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open link prompt' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(document.activeElement).toBe(trigger)
  })
})
