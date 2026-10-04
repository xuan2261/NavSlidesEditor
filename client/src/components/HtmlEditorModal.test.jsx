import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HtmlEditorModal from './HtmlEditorModal.jsx'
import { MERMAID_SOURCE_LIMIT } from '../hooks/use-element-creation'
const source = '<script>window.counter = 1</script><button>Count</button>'
function Editor({ onApply, onCancel = () => {}, initial = {} }) {
  const [state, onChange] = useState({ content: source, ...initial })
  return <HtmlEditorModal state={state} onChange={onChange} onApply={onApply} onCancel={onCancel} />
}
describe('authored HTML capability editor', () => {
  it('applies explicit local capabilities without changing the script source', () => {
    const onApply = vi.fn()
    render(<Editor onApply={onApply} />)
    fireEvent.click(
      screen.getByLabelText('I declare this embed can run offline with only the listed resources')
    )
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: source,
        htmlDependencies: {
          network: false,
          offlineCapable: true,
          resources: [],
          dynamicResources: [],
        },
      })
    )
  })
  it('blocks invalid resources and applies hosted metadata with unchanged content', () => {
    const onApply = vi.fn()
    render(<Editor onApply={onApply} />)
    fireEvent.click(screen.getByLabelText('Allow declared hosted network origins'))
    const resources = screen.getByLabelText('Static resources (JSON)')
    fireEvent.change(resources, {
      target: { value: '[{"kind":"anything","url":"https://x.example"}]' },
    })
    expect(screen.getByRole('button', { name: 'Apply' }).disabled).toBe(true)
    fireEvent.change(resources, {
      target: { value: '[{"kind":"image","url":"https://x.example/a.png"}]' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: source,
        htmlDependencies: {
          network: true,
          offlineCapable: false,
          resources: [{ kind: 'image', url: 'https://x.example/a.png' }],
          dynamicResources: [],
        },
      })
    )
  })
  it('does not retain audited builtin provenance after editing authored content', () => {
    const onApply = vi.fn()
    render(
      <Editor
        onApply={onApply}
        initial={{ sourceMetadata: { presetId: 'logic', sourceId: 'builtin' } }}
      />
    )
    fireEvent.change(screen.getByLabelText('HTML source'), {
      target: { value: '<p>My source</p>' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ content: '<p>My source</p>', sourceMetadata: undefined })
    )
  })
  it('blocks over-limit Mermaid source and accepts a valid edited diagram', () => {
    const onApply = vi.fn()
    render(
      <Editor
        onApply={onApply}
        initial={{
          embedKind: 'mermaid',
          mermaidSource: 'x'.repeat(MERMAID_SOURCE_LIMIT + 1),
          sourceMetadata: { presetId: 'diagram', sourceId: 'builtin' },
        }}
      />
    )
    expect(screen.getByRole('button', { name: 'Apply' }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Mermaid source'), {
      target: { value: 'flowchart TD\nA-->B' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        embedKind: 'mermaid',
        mermaidSource: 'flowchart TD\nA-->B',
        sourceMetadata: undefined,
      })
    )
  })
  it('cancels without applying partially edited capabilities', () => {
    const onApply = vi.fn(),
      onCancel = vi.fn()
    render(<Editor onApply={onApply} onCancel={onCancel} />)
    fireEvent.click(screen.getByLabelText('Allow declared hosted network origins'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onApply).not.toHaveBeenCalled()
  })
})
