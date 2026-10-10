import { useEffect, useMemo, useRef } from 'react'
import { normalizeElementAction, resolveEffectiveElements } from 'revealjs-shared'
import { Button, Input, Select } from '../../components/ui'

const KINDS = [
  ['none', 'No action'],
  ['url', 'Open URL'],
  ['slide', 'Go to slide'],
  ['next', 'Next slide'],
  ['previous', 'Previous slide'],
  ['first', 'First slide'],
  ['last', 'Last slide'],
  ['email', 'Send email'],
  ['download', 'Download file'],
  ['show', 'Show element'],
  ['hide', 'Hide element'],
  ['toggle', 'Toggle element'],
  ['score-add', 'Add score'],
  ['score-subtract', 'Subtract score'],
  ['reset-slide', 'Reset slide'],
]
const URL_KINDS = new Set(['url', 'email', 'download'])
const NAV_KINDS = new Set(['next', 'previous', 'first', 'last'])
const VISIBILITY_KINDS = new Set(['show', 'hide', 'toggle'])
const SCORE_KINDS = new Set(['score-add', 'score-subtract'])

function slideChoices(presentation) {
  return (presentation?.slides || [])
    .flatMap((slide, horizontal) => [
      { id: slide.id, label: `Slide ${horizontal + 1}` },
      ...(slide.children || []).map((child, vertical) => ({
        id: child.id,
        label: `Slide ${horizontal + 1}.${vertical + 1}`,
      })),
    ])
    .filter((slide) => typeof slide.id === 'string' && slide.id)
}

/** Shared controls for every existing element; action execution belongs to the presentation runtime. */
export default function ActionControls({
  element,
  onUpdate,
  presentation,
  slide,
  compact = false,
}) {
  const draft = element.action || null
  const validation = normalizeElementAction(draft)
  const editorRef = useRef(null)
  useEffect(() => {
    const focus = (event) => {
      if (event.detail?.elementId !== element.id) return
      editorRef.current?.querySelector('select, input')?.focus()
    }
    window.addEventListener('navslides:focus-action', focus)
    return () => window.removeEventListener('navslides:focus-action', focus)
  }, [element.id])
  const kind = draft?.kind || 'none'
  const update = (patch) => {
    const next = { ...(draft || { kind: 'url' }), ...patch }
    if ('targetElementId' in patch) delete next.referenceError
    onUpdate?.({ action: next })
  }
  const clear = () => onUpdate?.({ action: null })
  const begin = (nextKind) => {
    if (nextKind === 'none') return clear()
    const next = VISIBILITY_KINDS.has(nextKind)
      ? { kind: nextKind, targetElementId: '' }
      : SCORE_KINDS.has(nextKind)
        ? { kind: nextKind, variableId: '', amount: 1 }
        : nextKind === 'reset-slide'
          ? { kind: nextKind, resetVariables: false }
          : NAV_KINDS.has(nextKind)
            ? { kind: nextKind }
            : { kind: nextKind, ...(nextKind === 'slide' ? { slideId: '' } : { url: '' }) }
    onUpdate?.({ action: next })
  }
  const classes = compact
    ? 'w-28 h-7 rounded border border-border bg-secondary px-1 text-[11px]'
    : 'w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs'
  const slides = slideChoices(presentation)
  const targets = useMemo(() => {
    const elements = slide?.layoutId
      ? resolveEffectiveElements(slide, presentation?.layoutMasters).elements
      : slide?.elements || []
    return elements.filter((target) => !target.hidden)
  }, [slide, presentation?.layoutMasters])
  const variables = presentation?.interactionVariables || []
  const missingTarget =
    slide &&
    VISIBILITY_KINDS.has(kind) &&
    draft?.targetElementId &&
    !targets.some((target) => target.id === draft.targetElementId)
  const missingVariable =
    SCORE_KINDS.has(kind) &&
    draft?.variableId &&
    !variables.some((variable) => variable.id === draft.variableId)
  const error =
    draft?.referenceError ||
    validation.error ||
    (missingTarget
      ? 'Target is unavailable in this effective slide.'
      : missingVariable
        ? 'Score variable is unavailable. Choose a declared variable.'
        : '')
  return (
    <div
      ref={editorRef}
      className={compact ? 'flex items-center gap-1' : 'flex flex-col gap-2'}
      data-action-editor
    >
      <label className={compact ? 'sr-only' : 'text-[11px] text-text-muted'}>
        <Select
          aria-label="Element action"
          className={classes}
          value={kind}
          onChange={(event) => begin(event.target.value)}
        >
          {KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </label>
      {kind === 'slide' && (
        <Select
          aria-label="Destination slide"
          className={classes}
          value={draft?.slideId || ''}
          onChange={(event) => update({ slideId: event.target.value })}
        >
          <option value="">Choose slide…</option>
          {slides.map((slide) => (
            <option key={slide.id} value={slide.id}>
              {slide.label}
            </option>
          ))}
        </Select>
      )}
      {VISIBILITY_KINDS.has(kind) && (
        <Select
          aria-label="Target element"
          className={classes}
          value={draft?.targetElementId || ''}
          onChange={(event) => update({ targetElementId: event.target.value })}
        >
          <option value="">Choose element…</option>
          {missingTarget && <option value={draft.targetElementId}>Unavailable target</option>}
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name || `${target.type}: ${target.id}`}
            </option>
          ))}
        </Select>
      )}
      {SCORE_KINDS.has(kind) && (
        <>
          <Select
            aria-label="Score variable"
            className={classes}
            value={draft?.variableId || ''}
            onChange={(event) => update({ variableId: event.target.value })}
          >
            <option value="">Choose variable…</option>
            {missingVariable && <option value={draft.variableId}>Unavailable variable</option>}
            {variables.map((variable) => (
              <option key={variable.id} value={variable.id}>
                {variable.name}
              </option>
            ))}
          </Select>
          <Input
            aria-label="Score amount"
            type="number"
            min="0.000001"
            max="1000000"
            step="any"
            className={classes}
            value={draft?.amount ?? ''}
            onChange={(event) =>
              update({ amount: event.target.value === '' ? NaN : Number(event.target.value) })
            }
          />
        </>
      )}
      {kind === 'reset-slide' && (
        <label className="text-xs">
          <input
            aria-label="Reset deck variables"
            type="checkbox"
            checked={draft?.resetVariables === true}
            onChange={(event) => update({ resetVariables: event.target.checked })}
          />
          Reset deck variables (otherwise preserve scores)
        </label>
      )}
      {!compact && (
        <Select
          aria-label="Initial runtime visibility"
          className={classes}
          value={element.initialVisibility || 'visible'}
          onChange={(event) => onUpdate?.({ initialVisibility: event.target.value })}
        >
          <option value="visible">Initially visible</option>
          <option value="hidden">Initially hidden at runtime</option>
        </Select>
      )}
      {URL_KINDS.has(kind) && (
        <Input
          aria-label="Action URL"
          className={classes}
          value={draft?.url || ''}
          placeholder={kind === 'email' ? 'mailto:name@example.com' : 'https://example.com'}
          onChange={(event) => update({ url: event.target.value })}
        />
      )}
      {URL_KINDS.has(kind) && (
        <label className="flex items-center gap-1 text-[11px] text-text-muted">
          <input
            aria-label="Open in new window"
            type="checkbox"
            checked={draft?.target === 'new'}
            onChange={(event) => update({ target: event.target.checked ? 'new' : 'same' })}
          />
          New window
        </label>
      )}
      {kind !== 'none' && (
        <>
          <Input
            aria-label="Action label"
            className={classes}
            value={draft?.label || ''}
            placeholder="Accessible label (optional)"
            onChange={(event) => update({ label: event.target.value })}
          />
          <label className="flex items-center gap-1 text-[11px] text-text-muted">
            <input
              aria-label="Transparent hotspot"
              type="checkbox"
              checked={draft?.hotspot === true}
              onChange={(event) => update({ hotspot: event.target.checked })}
            />
            Transparent hotspot
          </label>
        </>
      )}
      {error && (
        <span role="alert" className="text-[11px] text-danger">
          {error}
        </span>
      )}
      {!compact && kind !== 'none' && (
        <Button variant="ghost" className="self-start text-[11px]" onClick={clear}>
          Clear action
        </Button>
      )}
    </div>
  )
}
