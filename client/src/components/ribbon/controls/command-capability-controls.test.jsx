import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import ClipboardButtons from './clipboard-buttons'
import ArrangeControls from './arrange-controls'
import { CommandPalette } from '../../command-palette'
import { useEditorCommandModel } from '../../../hooks/editor-controller/use-editor-command-model'

afterEach(cleanup)

function ClipboardExample({ availability }) {
  const [count, setCount] = useState(0)
  const increment = () => setCount((previous) => previous + 1)
  return <>
    <ClipboardButtons availability={availability} onCopy={increment} onCut={increment}
      onPaste={increment} onDuplicate={increment} />
    <output>{count}</output>
  </>
}

describe('clipboard capability enforcement', () => {
  it.each(['Paste', 'Cut', 'Copy', 'Duplicate'])('guards %s mouse and keyboard paths and recovers when enabled', (label) => {
    const key = label.toLowerCase()
    const { rerender } = render(<ClipboardExample availability={{ [key]: 'Unavailable selection' }} />)
    const button = screen.getByRole('button', { name: label })
    expect(button.disabled).toBe(true)
    expect(button.title).toBe('Unavailable selection')
    fireEvent.mouseDown(button)
    fireEvent.click(button)
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyDown(button, { key: ' ' })
    expect(screen.getByRole('status').textContent).toBe('0')
    rerender(<ClipboardExample availability={{ [key]: null }} />)
    expect(button.disabled).toBe(false)
    fireEvent.mouseDown(button)
    fireEvent.click(button)
    expect(screen.getByRole('status').textContent).toBe('1')
  })

  it.each(['{Enter}', ' '])('preserves standalone keyboard activation exactly once: %s', async (key) => {
    render(<ClipboardExample />)
    screen.getByRole('button', { name: 'Paste' }).focus()
    await userEvent.keyboard(key)
    expect(screen.getByRole('status').textContent).toBe('1')
  })
})

function ArrangeExample({ availability, selectedCount = 2 }) {
  const [action, setAction] = useState('Unchanged')
  return <>
    <ArrangeControls selectedCount={selectedCount} availability={availability}
      onGroup={() => setAction('Grouped')} onUngroup={() => setAction('Ungrouped')}
      onAlignElements={setAction} onBringForward={() => setAction('Forward')}
      onSendBackward={() => setAction('Backward')} onBringToFront={() => setAction('Front')}
      onSendToBack={() => setAction('Back')} />
    <output>{action}</output>
  </>
}

describe('arrange capability enforcement', () => {
  it('blocks alignment, stacking, and grouping for protected selections', async () => {
    render(<ArrangeExample availability={{ arrange: 'Selection is locked', group: 'Selection is locked', ungroup: 'Selection is locked' }} />)
    for (const button of screen.getAllByRole('button')) {
      expect(button.disabled).toBe(true)
      expect(button.title).toBe('Selection is locked')
      fireEvent.mouseDown(button)
      fireEvent.click(button)
      fireEvent.keyDown(button, { key: 'Enter' })
      fireEvent.keyDown(button, { key: ' ' })
      await userEvent.click(button)
    }
    expect(screen.getByRole('status').textContent).toBe('Unchanged')
  })

  it('makes ungroup available for a single selected group member', async () => {
    render(<ArrangeExample selectedCount={1} availability={{ group: 'Select at least two elements', ungroup: null }} />)
    const ungroup = screen.getByRole('button', { name: 'Ungroup elements' })
    ungroup.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('status').textContent).toBe('Ungrouped')
  })

  it('preserves standalone enabled stacking and alignment', async () => {
    render(<ArrangeExample />)
    await userEvent.click(screen.getByRole('button', { name: 'Align left' }))
    expect(screen.getByRole('status').textContent).toBe('left')
    screen.getByRole('button', { name: 'Bring to front' }).focus()
    await userEvent.keyboard(' ')
    expect(screen.getByRole('status').textContent).toBe('Front')
  })
})

describe('command model capabilities', () => {
  it('prevents unavailable history execution and reflects a later enabled action', () => {
    function Example({ disabled }) {
      const [content, setContent] = useState('After edit')
      const commands = useEditorCommandModel({
        undo: () => setContent('Before edit'),
        availability: { undo: disabled ? 'Nothing to undo' : null },
      })
      return <><CommandPalette open commands={commands} onClose={() => {}} /><output>{content}</output></>
    }
    const { rerender } = render(<Example disabled />)
    const undo = screen.getByRole('button', { name: /^Undo/ })
    expect(undo.disabled).toBe(true)
    expect(undo.title).toBe('Nothing to undo')
    fireEvent.click(undo)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(screen.getByRole('status').textContent).toBe('After edit')
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull()
    rerender(<Example disabled={false} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(screen.getByRole('status').textContent).toBe('Before edit')
  })
})
