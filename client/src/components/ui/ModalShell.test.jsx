import React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ModalShell } from './ModalShell'

describe('ModalShell', () => {
  it('renders an accessible dialog shell with a labelled title and close button', () => {
    const html = renderToString(
      <ModalShell titleId="sample-modal-title" title="Sample modal" onClose={() => {}}>
        <p>Body content</p>
      </ModalShell>
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby="sample-modal-title"')
    expect(html).toContain('id="sample-modal-title"')
    expect(html).toContain('Sample modal')
    expect(html).toContain('aria-label="Close Sample modal"')
    expect(html).toContain('Body content')
  })

  it('uses viewport-safe width classes by size', () => {
    const html = renderToString(
      <ModalShell titleId="wide-modal-title" title="Wide modal" size="xl" onClose={() => {}}>
        Wide
      </ModalShell>
    )

    expect(html).toContain('max-w-[800px]')
    expect(html).toContain('max-h-[90vh]')
    expect(html).toContain('overflow-hidden')
  })

  it('supports large viewport-safe product modals', () => {
    const html = renderToString(
      <ModalShell titleId="media-modal-title" title="Media library" size="2xl" onClose={() => {}}>
        Media
      </ModalShell>
    )

    expect(html).toContain('max-w-[960px]')
    expect(html).toContain('w-full')
  })

  it('supports sticky footer actions outside the scroll body', () => {
    const html = renderToString(
      <ModalShell
        titleId="action-modal-title"
        title="Action modal"
        onClose={() => {}}
        footer={<button type="button">Create</button>}
      >
        Body
      </ModalShell>
    )

    expect(html).toContain('data-testid="modal-shell-footer"')
    expect(html).toContain('sticky bottom-0')
    expect(html).toContain('Create')
  })

  it('closes on Escape after rerenders update the close callback', () => {
    const firstClose = vi.fn()
    const latestClose = vi.fn()

    const { rerender } = render(
      <ModalShell titleId="escape-modal-title" title="Escape modal" onClose={firstClose}>
        Loading
      </ModalShell>
    )

    rerender(
      <ModalShell titleId="escape-modal-title" title="Escape modal" onClose={latestClose}>
        Loaded
      </ModalShell>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(firstClose).not.toHaveBeenCalled()
    expect(latestClose).toHaveBeenCalledTimes(1)
  })

  it('ignores missing or non-function Escape close handlers', () => {
    const { rerender } = render(
      <ModalShell titleId="optional-close-title" title="Optional close">
        Body
      </ModalShell>
    )

    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()

    rerender(
      <ModalShell titleId="optional-close-title" title="Optional close" onClose="invalid">
        Body
      </ModalShell>
    )

    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()
  })
})
