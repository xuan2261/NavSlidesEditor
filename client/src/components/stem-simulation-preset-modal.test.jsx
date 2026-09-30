import { StrictMode, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StemSimulationPresetModal from './stem-simulation-preset-modal'

function StemModalExample() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Add simulation</button>
      {open && <StemSimulationPresetModal onCancel={() => setOpen(false)} />}
    </>
  )
}

describe('StemSimulationPresetModal', () => {
  it('inserts a validated provider embed using named form controls', () => {
    const onInsert = vi.fn()
    render(<StemSimulationPresetModal onInsert={onInsert} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/Provider/i), { target: { value: 'desmos' } })
    fireEvent.change(screen.getByLabelText(/URL or ID/i), { target: { value: 'calculator-id' } })
    fireEvent.click(screen.getByText('Insert'))

    expect(onInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'html',
        embedKind: 'stem-simulation',
        provider: 'desmos',
        sourceUrl: 'https://www.desmos.com/calculator/calculator-id',
        content: expect.stringContaining('sandbox='),
      })
    )
  })

  it('shows validation errors and does not insert unknown domains', () => {
    const onInsert = vi.fn()
    render(<StemSimulationPresetModal onInsert={onInsert} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/URL or ID/i), {
      target: { value: 'https://evil.example/sim' },
    })
    fireEvent.click(screen.getByText('Insert'))

    expect(screen.getByRole('alert').textContent).toMatch(/not allowed/i)
    expect(screen.getByLabelText(/URL or ID/i).getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText(/URL or ID/i).getAttribute('aria-describedby').split(' ')).toContain(
      screen.getByRole('alert').id
    )
    expect(onInsert).not.toHaveBeenCalled()
  })

  it('keeps keyboard focus inside the dialog in both directions', async () => {
    const user = userEvent.setup()
    render(<StrictMode><StemModalExample /></StrictMode>)
    await user.click(screen.getByRole('button', { name: 'Add simulation' }))
    const source = screen.getByRole('textbox', { name: 'URL or ID' })
    const provider = screen.getByRole('combobox', { name: 'Provider' })
    const insert = screen.getByRole('button', { name: 'Insert' })
    expect(document.activeElement).toBe(source)

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(provider)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(insert)
    await user.tab()
    expect(document.activeElement).toBe(provider)
    await user.tab()
    expect(document.activeElement).toBe(source)
  })

  it.each(['Escape', 'Cancel', 'backdrop'])('restores opener focus after %s dismissal', async (action) => {
    const user = userEvent.setup()
    render(<StrictMode><StemModalExample /></StrictMode>)
    const opener = screen.getByRole('button', { name: 'Add simulation' })
    await user.click(opener)
    if (action === 'Escape') await user.keyboard('{Escape}')
    else if (action === 'Cancel') await user.click(screen.getByRole('button', { name: 'Cancel' }))
    else await user.click(screen.getByRole('dialog', { name: 'STEM Simulation' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
