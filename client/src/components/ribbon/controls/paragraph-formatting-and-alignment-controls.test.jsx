import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ParagraphControls from './paragraph-formatting-and-alignment-controls'
import ParagraphCompactControls from './paragraph-compact-dropdown-controls'

const createEditor = () => ({
  isActive: () => false,
  getAttributes: () => ({}),
})

describe('ParagraphCompactControls', () => {
  it('[cap:control.format.align] opens with keyboard and runs menu commands without mouse input', () => {
    const rememberSelection = vi.fn()
    const runTextCommand = vi.fn()
    render(
      <ParagraphCompactControls
        editor={createEditor()}
        rememberSelection={rememberSelection}
        runTextCommand={runTextCommand}
      />,
    )

    fireEvent.keyDown(screen.getByRole('button', { name: 'Paragraph' }), { key: 'Enter' })
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('button', { name: 'Align left' }), { key: ' ' })

    expect(rememberSelection).toHaveBeenCalled()
    expect(runTextCommand).toHaveBeenCalled()
  })
})

describe('ParagraphControls', () => {
  it('[cap:control.format.lineHeight] uses preserved selection command for line height changes', () => {
    const rememberSelection = vi.fn()
    const runTextCommand = vi.fn()
    render(
      <ParagraphControls
        editor={createEditor()}
        rememberSelection={rememberSelection}
        runTextCommand={runTextCommand}
        handleTextCommandMouseDown={() => vi.fn()}
      />,
    )

    fireEvent.mouseDown(screen.getByTitle('Line height'))
    fireEvent.change(screen.getByTitle('Line height'), { target: { value: '1.5' } })

    expect(rememberSelection).toHaveBeenCalled()
    expect(runTextCommand).toHaveBeenCalled()
  })

  it('clears formatting without requiring a synthetic mouse event', () => {
    const runTextCommand = vi.fn()
    render(
      <ParagraphControls
        editor={createEditor()}
        rememberSelection={vi.fn()}
        runTextCommand={runTextCommand}
        handleTextCommandMouseDown={() => vi.fn()}
      />,
    )

    fireEvent.mouseDown(screen.getByLabelText('Clear formatting'))

    expect(runTextCommand).toHaveBeenCalled()
  })
})
