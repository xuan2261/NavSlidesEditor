import { useState, useEffect } from 'react'
import { Button } from '../components/ui'
import { isBackdropClick } from '../lib/utils'
import { MERMAID_SOURCE_LIMIT } from '../hooks/use-element-creation'

export default function HtmlEditorModal({ state, onChange, onApply, onCancel }) {
  const [isOpen, setIsOpen] = useState(true)
  const isMermaid = state.embedKind === 'mermaid'
  const mermaidSource = state.mermaidSource || ''
  const isTooLong = isMermaid && mermaidSource.length > MERMAID_SOURCE_LIMIT

  const handleClose = () => {
    setIsOpen(false)
    onCancel()
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center"
      onClick={(event) => {
        if (isBackdropClick(event)) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="html-editor-modal-title"
      aria-describedby={
        isMermaid
          ? 'html-editor-helper html-trusted-content-warning mermaid-editor-helper'
          : 'html-editor-helper html-trusted-content-warning'
      }
    >
      <div
        className="bg-card border border-border rounded-xl w-[78vw] max-w-[960px] h-[78vh] flex flex-col shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex justify-between items-center shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <h2 id="html-editor-modal-title" className="font-semibold text-sm">
              {isMermaid ? 'Mermaid Diagram' : 'HTML / D3 Embed'}
            </h2>
            <span id="html-editor-helper" className="text-xs text-text-muted">
              {isMermaid
                ? 'Edit Mermaid source — renders through the trusted HTML embed pipeline'
                : 'D3, plain HTML, or any JavaScript — renders in an iframe'}
            </span>
            <span
              id="html-trusted-content-warning"
              data-testid="html-trusted-content-warning"
              className="text-xs text-amber-300"
            >
              Trusted author content only; scripts are preserved in preview and export.
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" className="text-xs" onClick={onApply} disabled={isTooLong}>
              Apply
            </Button>
          </div>
        </div>
        {isMermaid && (
          <div
            id="mermaid-editor-helper"
            className="border-b border-border px-4 py-2 text-xs text-text-muted"
          >
            <span>Mermaid diagrams render as trusted author HTML embeds. </span>
            <span data-testid="mermaid-source-count">
              {mermaidSource.length}/{MERMAID_SOURCE_LIMIT}
            </span>
            {isTooLong && (
              <span
                data-testid="mermaid-source-error"
                role="alert"
                className="ml-3 text-amber-300"
              >
                Mermaid source is too long.
              </span>
            )}
          </div>
        )}
        <textarea
          value={isMermaid ? mermaidSource : state.content}
          onChange={(e) =>
            onChange(
              isMermaid
                ? { ...state, mermaidSource: e.target.value }
                : { ...state, content: e.target.value }
            )
          }
          className="flex-1 bg-[#0d0d1a] text-[#e2e8f0] font-mono text-[13px] p-4 md:p-5 border-none outline-none resize-none rounded-b-xl leading-relaxed"
          style={{ tabSize: 2 }}
          spellCheck={false}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const { selectionStart: s, selectionEnd: end, value } = e.target
              const next = value.substring(0, s) + '  ' + value.substring(end)
              e.target.value = next
              onChange(isMermaid ? { ...state, mermaidSource: next } : { ...state, content: next })
              requestAnimationFrame(() => {
                e.target.selectionStart = e.target.selectionEnd = s + 2
              })
            }
          }}
        />
      </div>
    </div>
  )
}
