import { useRef, useState } from 'react'
import { Button } from '../ui'
import inheritanceOperations from 'revealjs-shared/src/pptx-inheritance-operations.js'
import capabilities from 'revealjs-shared/src/pptx-projection-capabilities.js'
import { normalizeTextDocument } from 'revealjs-shared/src/pptx-text-document.js'
import { semanticInstance, semanticDefinition } from 'revealjs-shared/src/pptx-semantic-records.js'
import NativeTextBodyControls from './native-text-body-controls'
import NativeTextParagraphControls from './native-text-paragraph-controls'
import { withTextProperties } from './native-text-fields'

function SourceTextEditor({ presentation, element, document, disabled, onUpdate }) {
  const [draft, setDraft] = useState(document)
  const [review, setReview] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const controls = useRef(null)
  const busy = useRef(false)
  // A preview is authority for this exact presentation and command only.
  const currentReview = review?.presentation === presentation ? review : null
  const changeDocument = (next) => {
    setDraft(next)
    setReview(null)
    setError('')
  }
  const validDraft = () => {
    if (controls.current?.querySelector('[aria-invalid="true"], :invalid')) return false
    return true
  }
  const intent = (scope) => ({
    type: inheritanceOperations.INHERITANCE_EDIT,
    instanceId: element.pptxInstanceId,
    scope,
    command: { type: 'text-document', document: normalizeTextDocument(draft) },
  })
  const previewAll = () => {
    if (disabled || busy.current || !validDraft()) return
    try {
      const operation = intent('all')
      const preview = inheritanceOperations.previewInheritanceEdit(presentation, operation)
      setReview({ presentation, operation, preview })
      setError('')
    } catch (cause) {
      setReview(null)
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }
  const submit = async (all) => {
    if (disabled || busy.current || !validDraft() || (all && !currentReview)) return
    busy.current = true
    setPending(true)
    setReview(null)
    setError('')
    try {
      await onUpdate({ pptxProjectionOperation: all
        ? { ...currentReview.operation, preview: currentReview.preview }
        : intent('selected') })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  const impactedSlides = currentReview && [...new Map(currentReview.preview.occurrences.map(
    (occurrence) => [occurrence.slideId, occurrence]
  )).values()]
  const lockedTargets = currentReview?.preview.occurrences.some((occurrence) => occurrence.locked)

  return (
    <section aria-label="Source-bound PPTX text" className="my-3 flex min-w-0 flex-col gap-2">
      <h4 className="text-xs font-semibold">Source-bound PPTX text</h4>
      <p className="break-words text-xs text-text-secondary">
        Scope: Selected occurrence. Other occurrences remain unchanged unless you explicitly review
        and apply an edit to all linked occurrences.
      </p>
      <fieldset ref={controls} disabled={disabled || pending} className="flex min-w-0 flex-col gap-2"
        onChange={() => { setReview(null); setError('') }}>
        <legend className="sr-only">Occurrence text</legend>
        <NativeTextBodyControls body={draft.body}
          onValue={(key, value) => changeDocument(withTextProperties(draft, 'body', key, value))} />
        {draft.paragraphs.map((paragraph, index) => <NativeTextParagraphControls key={paragraph.componentId}
          paragraph={paragraph} index={index} onChange={(next) => changeDocument({
            ...draft, paragraphs: draft.paragraphs.map((current, p) => p === index ? next : current),
          })} />)}
        <Button onClick={() => submit(false)}>Apply to selected occurrence</Button>
        <Button variant="secondary" onClick={previewAll}>Preview edit all occurrences</Button>
      </fieldset>
      {currentReview && (
        <section aria-label="Edit all impact preview" className="flex flex-col gap-2 border border-border p-2">
          <p className="text-xs text-text-secondary">
            {currentReview.preview.occurrences.length} linked occurrences on {impactedSlides.length} slides:
          </p>
          <ul aria-label="Impacted slides" className="break-words text-xs">
            {impactedSlides.map((occurrence) => (
              <li key={occurrence.slideId}>
                {occurrence.slideTitle || 'Untitled slide'} ({occurrence.slideId})
              </li>
            ))}
          </ul>
          {lockedTargets && <p role="alert">A linked occurrence is locked. No edit can be applied to all.</p>}
          <Button disabled={disabled || pending || lockedTargets} onClick={() => submit(true)}>
            Apply to all linked occurrences
          </Button>
          <Button disabled={pending} variant="secondary" onClick={() => setReview(null)}>Cancel edit all</Button>
        </section>
      )}
      {error && <p role="alert" className="break-words text-xs">{error}</p>}
    </section>
  )
}

export default function NativeInheritanceTextProperties({ presentation, element, slide, onUpdate }) {
  const model = presentation?.pptxSemantic
  const instance = semanticInstance(model, element.pptxInstanceId)
  const source = semanticDefinition(model, instance?.definitionId)?.content?.textDocument
  if (!source || !capabilities.getProjectionCapabilities(model, instance.id)
    .operations.includes(inheritanceOperations.INHERITANCE_EDIT)) return null
  // Keep authored inheritance and rich-run metadata; do not freeze materialized style defaults.
  const document = instance.overrides.components?.[source.componentId]?.textDocument ?? source
  return (
    <SourceTextEditor
      key={`${instance.id}:${JSON.stringify(document)}`}
      {...{ presentation, element, document, onUpdate }}
      disabled={!!(element.locked || slide.locked || !onUpdate)}
    />
  )
}
