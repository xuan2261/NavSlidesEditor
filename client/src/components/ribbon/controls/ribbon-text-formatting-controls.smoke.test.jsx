import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import FontControls from './ribbon-text-formatting-controls'

// Control smoke floor: render the control with a mock editor + chain, drive the
// interaction, and assert it dispatches the expected TipTap command (the store
// action equivalent for text controls). Not exact formatting output — that is
// owned by the editor extensions — just that the wiring fires the right command.
function makeChain() {
  const chain = {}
  for (const m of [
    'toggleBold', 'toggleItalic', 'toggleUnderline', 'toggleStrike',
    'setColor', 'setHighlight',
    'setFontFamily', 'unsetFontFamily',
    'setFontSize', 'unsetFontSize',
    'setFontWeight', 'unsetFontWeight',
  ]) {
    chain[m] = vi.fn(() => chain)
  }
  return chain
}

function setup() {
  const chain = makeChain()
  const editor = { isActive: () => false, getAttributes: () => ({}) }
  const runTextCommand = vi.fn((builder) => builder(chain))
  const handleTextCommandMouseDown = vi.fn((builder) => () => builder(chain))
  render(
    <FontControls
      editor={editor}
      rememberSelection={vi.fn()}
      runTextCommand={runTextCommand}
      handleTextCommandMouseDown={handleTextCommandMouseDown}
    />
  )
  return chain
}

describe('font formatting controls smoke floor', () => {
  it('[cap:control.format.bold] Bold button dispatches toggleBold', () => {
    const chain = setup()
    fireEvent.mouseDown(screen.getByLabelText('Bold'))
    expect(chain.toggleBold).toHaveBeenCalled()
  })

  it('[cap:control.format.italic] Italic button dispatches toggleItalic', () => {
    const chain = setup()
    fireEvent.mouseDown(screen.getByLabelText('Italic'))
    expect(chain.toggleItalic).toHaveBeenCalled()
  })

  it('[cap:control.format.underline] Underline button dispatches toggleUnderline', () => {
    const chain = setup()
    fireEvent.mouseDown(screen.getByLabelText('Underline'))
    expect(chain.toggleUnderline).toHaveBeenCalled()
  })

  it('[cap:control.format.fontSize] [cap:element.text depth:behavior] Font size select dispatches setFontSize', () => {
    const chain = setup()
    fireEvent.change(screen.getByTitle('Font size'), { target: { value: '24px' } })
    expect(chain.setFontSize).toHaveBeenCalledWith('24px')
  })

  it('[cap:control.format.fontFamily] Font family select dispatches setFontFamily', () => {
    const chain = setup()
    fireEvent.change(screen.getByTitle('Font family'), {
      target: { value: 'Inter, sans-serif' },
    })
    expect(chain.setFontFamily).toHaveBeenCalledWith('Inter, sans-serif')
  })

  it('[cap:control.format.fontWeight] Font weight select dispatches setFontWeight', () => {
    const chain = setup()
    fireEvent.change(screen.getByTestId('font-weight-select'), { target: { value: '700' } })
    expect(chain.setFontWeight).toHaveBeenCalledWith('700')
  })
})
