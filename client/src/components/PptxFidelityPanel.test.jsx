import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PptxFidelityPanel } from './PptxFidelityPanel'

const contract = {
  fidelity: { status: 'original-only', editabilityTier: 'original-only' },
  exports: {
    original: { available: true },
    validatedEdited: { available: false },
    reconstructed: { available: false },
  },
  officeCli: { available: false, guidance: 'OfficeCLI is unavailable. Download the original.' },
}

describe('PptxFidelityPanel', () => {
  it('renders explicit accessible choices and original-only guidance', () => {
    const downloadOriginal = vi.fn()
    render(<PptxFidelityPanel contract={contract} actions={{
      downloadOriginal,
      exportValidatedRevision: vi.fn(),
      generateReconstructed: vi.fn(),
    }} />)

    expect(screen.getByRole('status').textContent).toContain('Original-only fidelity')
    expect(screen.getByText('Editability: Original only')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Download Original' }))
    expect(downloadOriginal).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', {
      name: 'Export Validated Edited Revision',
    }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Generate Reconstructed PPTX' }).disabled).toBe(true)
    expect(screen.getByText(/not a roundtrip export/i)).toBeTruthy()
    expect(screen.getByRole('note').textContent).toContain('OfficeCLI is unavailable')
  })

  it('offers only non-destructive conflict recovery', () => {
    const onReload = vi.fn()
    render(<PptxFidelityPanel contract={contract} actions={{}} conflict={{}}
      onReload={onReload} />)
    expect(screen.getByRole('alert').textContent).toContain('Nothing was overwritten')
    fireEvent.click(screen.getByRole('button', { name: 'Reload and review' }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
