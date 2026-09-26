import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import HomeTabContent from './home-tab-content'
import { CommandPalette } from '../command-palette'
import { useEditorCommandModel } from '../../hooks/editor-controller/use-editor-command-model'

afterEach(cleanup)

describe('unavailable editor commands', () => {
  it('does not cut a locked selection through Home controls', () => {
    function Example() {
      const [content, setContent] = useState('Protected element')
      return <><HomeTabContent selectedCount={1} availability={{ cut: 'Selection is locked', arrange: 'Selection is locked' }} onCut={() => setContent('Deleted')} /><output>{content}</output></>
    }
    render(<Example />)
    const cut = screen.getByRole('button', { name: 'Cut' })
    fireEvent.mouseDown(cut)
    fireEvent.keyDown(cut, { key: 'Enter' })
    expect(screen.getByRole('status').textContent).toBe('Protected element')
    expect(cut.disabled).toBe(true)
    expect(cut.title).toContain('Selection is locked')
  })

  it('exposes an existing undo action through the command palette', () => {
    function Example() {
      const [content, setContent] = useState('After edit')
      const commands = useEditorCommandModel({ undo: () => setContent('Before edit'), availability: {} })
      return <><CommandPalette open commands={commands} onClose={() => {}} /><output>{content}</output></>
    }
    render(<Example />)
    fireEvent.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByRole('status').textContent).toBe('Before edit')
  })
})
