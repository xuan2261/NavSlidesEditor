import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StemSimulationPresetModal from './stem-simulation-preset-modal'

describe('StemSimulationPresetModal', () => {
  it('shows online-only warning and inserts a validated provider embed', () => {
    const onInsert = vi.fn()
    render(<StemSimulationPresetModal onInsert={onInsert} onCancel={vi.fn()} />)

    expect(screen.getByTestId('stem-online-warning').textContent).toContain('Online-only')
    expect(screen.getByRole('dialog').getAttribute('aria-describedby')).toBe('stem-online-warning')
    expect(screen.getByText('PhET')).toBeTruthy()
    expect(screen.getByText('GeoGebra')).toBeTruthy()
    expect(screen.getByText('Desmos')).toBeTruthy()
    expect(screen.getByText('CircuitJS / Falstad')).toBeTruthy()

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
    expect(screen.getByLabelText(/URL or ID/i).getAttribute('aria-describedby')).toContain(
      'stem-source-error'
    )
    expect(onInsert).not.toHaveBeenCalled()
  })
})
