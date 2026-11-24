import { useState, useEffect } from 'react'
import { Button, useModalFocusTrap } from '../components/ui'
import { isBackdropClick } from '../lib/utils'
import { MERMAID_SOURCE_LIMIT } from '../hooks/use-element-creation'
import { validateHtmlDependencies } from 'revealjs-shared/src/education/html-sandbox-policy.js'

export default function HtmlEditorModal({ state, onChange, onApply, onCancel }) {
  const [isOpen, setIsOpen] = useState(true)
  const [network, setNetwork] = useState(state.htmlDependencies?.network === true)
  const [offlineCapable, setOfflineCapable] = useState(
    state.htmlDependencies?.offlineCapable === true
  )
  const [resources, setResources] = useState(
    JSON.stringify(state.htmlDependencies?.resources || [])
  )
  const [dynamicResources, setDynamicResources] = useState(
    JSON.stringify(state.htmlDependencies?.dynamicResources || [])
  )
  const { dialogRef, handleFocusTrapKeyDown } = useModalFocusTrap({ autoFocus: false })
  const isMermaid = state.embedKind === 'mermaid'
  const mermaidSource = state.mermaidSource || ''
  const isTooLong = isMermaid && mermaidSource.length > MERMAID_SOURCE_LIMIT
  let metadata,
    metadataError = ''
  if (!isMermaid) {
    try {
      metadata = validateHtmlDependencies({
        network,
        offlineCapable,
        resources: JSON.parse(resources),
        dynamicResources: JSON.parse(dynamicResources),
      })
    } catch (failure) {
      metadataError = failure.message
    }
  }
  const handleClose = () => {
    setIsOpen(false)
    onCancel()
  }
  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const updateContent = (value) =>
    onChange(
      isMermaid
        ? { ...state, mermaidSource: value, sourceMetadata: undefined }
        : { ...state, content: value, sourceMetadata: undefined }
    )
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
      aria-describedby="html-editor-helper html-trusted-content-warning"
      ref={dialogRef}
      onKeyDown={handleFocusTrapKeyDown}
    >
      <div
        className="bg-card border border-border rounded-xl w-[90vw] max-w-[960px] h-[90vh] flex flex-col shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex justify-between items-center shrink-0 gap-2">
          <div>
            <h2 id="html-editor-modal-title" className="font-semibold text-sm">
              {isMermaid ? 'Mermaid Diagram' : 'HTML / D3 Embed'}
            </h2>
            <p id="html-editor-helper" className="text-xs text-text-muted">
              {isMermaid
                ? 'Edit Mermaid source — renders through the isolated HTML embed pipeline'
                : 'JavaScript runs inside an isolated iframe; your script source is preserved.'}
            </p>
            <p
              id="html-trusted-content-warning"
              data-testid="html-trusted-content-warning"
              className="text-xs text-amber-300"
            >
              Parent DOM, parent storage and desktop APIs are unavailable. Use local DOM/state or an
              audited plugin message channel. Network APIs are blocked unless their resource origins
              and capabilities are declared below. Download / Export HTML validates a portable file;
              hosted Share is a separate online option. If portable validation fails, no hosted
              fallback is downloaded. Upload missing assets or choose hosted Share.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" className="text-xs" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="text-xs"
              onClick={() => onApply(isMermaid ? state : { ...state, htmlDependencies: metadata })}
              disabled={isTooLong || Boolean(metadataError)}
            >
              Apply
            </Button>
          </div>
        </div>
        {isMermaid ? (
          <div
            id="mermaid-editor-helper"
            className="border-b border-border px-4 py-2 text-xs text-text-muted"
          >
            <span>Mermaid diagrams render as isolated author HTML embeds. </span>
            <span data-testid="mermaid-source-count">
              {mermaidSource.length}/{MERMAID_SOURCE_LIMIT}
            </span>
            {isTooLong && (
              <span data-testid="mermaid-source-error" role="alert" className="ml-3 text-amber-300">
                Mermaid source is too long.
              </span>
            )}
          </div>
        ) : (
          <fieldset className="border-b border-border px-4 py-2 text-xs space-y-2 max-h-[35vh] overflow-auto">
            <legend>Resource and portable capabilities</legend>
            <label className="block">
              <input
                type="checkbox"
                checked={network}
                onChange={(event) => setNetwork(event.target.checked)}
              />{' '}
              Allow declared hosted network origins
            </label>
            <label className="block">
              <input
                type="checkbox"
                checked={offlineCapable}
                onChange={(event) => setOfflineCapable(event.target.checked)}
              />{' '}
              I declare this embed can run offline with only the listed resources
            </label>
            <p className="text-text-muted">
              Kinds: script, style, image, media, font, frame, connect. Each entry needs a URL and
              kind. List every static and finite dynamic resource; undeclared fetches, workers and
              sockets cannot be certified portable.
              {network &&
                ' Hosted providers may require online Share and are not automatically portable.'}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <label>
                Static resources (JSON)
                <textarea
                  value={resources}
                  onChange={(event) => setResources(event.target.value)}
                  className="block w-full bg-[#0d0d1a] font-mono p-2"
                  rows={2}
                  spellCheck={false}
                />
              </label>
              <label>
                Dynamic resources (JSON)
                <textarea
                  value={dynamicResources}
                  onChange={(event) => setDynamicResources(event.target.value)}
                  className="block w-full bg-[#0d0d1a] font-mono p-2"
                  rows={2}
                  spellCheck={false}
                />
              </label>
            </div>
            {metadataError && (
              <p role="alert" className="text-amber-300">
                {metadataError}
              </p>
            )}
          </fieldset>
        )}
        <textarea
          aria-label={isMermaid ? 'Mermaid source' : 'HTML source'}
          value={isMermaid ? mermaidSource : state.content}
          onChange={(event) => updateContent(event.target.value)}
          className="flex-1 min-h-0 bg-[#0d0d1a] text-[#e2e8f0] font-mono text-[13px] p-4 md:p-5 border-none outline-none resize-none rounded-b-xl leading-relaxed"
          style={{ tabSize: 2 }}
          spellCheck={false}
          autoFocus
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return
            event.preventDefault()
            const { selectionStart: start, selectionEnd: end, value } = event.target
            updateContent(value.substring(0, start) + '  ' + value.substring(end))
            const target = event.target
            requestAnimationFrame(() => {
              target.selectionStart = target.selectionEnd = start + 2
            })
          }}
        />
      </div>
    </div>
  )
}
