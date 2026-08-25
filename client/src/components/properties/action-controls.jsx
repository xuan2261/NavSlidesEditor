import { useEffect, useRef } from 'react'
import { normalizeElementAction } from 'revealjs-shared'
import { Button, Input, Select } from '../../components/ui'

const KINDS = [
  ['none', 'No action'], ['url', 'Open URL'], ['slide', 'Go to slide'],
  ['next', 'Next slide'], ['previous', 'Previous slide'], ['first', 'First slide'], ['last', 'Last slide'],
  ['email', 'Send email'], ['download', 'Download file'],
]
const URL_KINDS = new Set(['url', 'email', 'download'])
const NAV_KINDS = new Set(['next', 'previous', 'first', 'last'])

function slideChoices(presentation) {
  return (presentation?.slides || []).flatMap((slide, horizontal) => [
    { id: slide.id, label: `Slide ${horizontal + 1}` },
    ...(slide.children || []).map((child, vertical) => ({ id: child.id, label: `Slide ${horizontal + 1}.${vertical + 1}` })),
  ]).filter((slide) => typeof slide.id === 'string' && slide.id)
}

/** Shared controls for every existing element; action execution belongs to the presentation runtime. */
export default function ActionControls({ element, onUpdate, presentation, compact = false }) {
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
    onUpdate?.({ action: next })
  }
  const clear = () => onUpdate?.({ action: null })
  const begin = (nextKind) => {
    if (nextKind === 'none') return clear()
    const next = NAV_KINDS.has(nextKind) ? { kind: nextKind } : { kind: nextKind, ...(nextKind === 'slide' ? { slideId: '' } : { url: '' }) }
    onUpdate?.({ action: next })
  }
  const classes = compact ? 'w-28 h-7 rounded border border-border bg-secondary px-1 text-[11px]' : 'w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs'
  const slides = slideChoices(presentation)
  return (
    <div ref={editorRef} className={compact ? 'flex items-center gap-1' : 'flex flex-col gap-2'} data-action-editor>
      <label className={compact ? 'sr-only' : 'text-[11px] text-text-muted'}>
        <Select aria-label="Element action" className={classes} value={kind} onChange={(event) => begin(event.target.value)}>
          {KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </label>
      {kind === 'slide' && <Select aria-label="Destination slide" className={classes} value={draft?.slideId || ''} onChange={(event) => update({ slideId: event.target.value })}>
        <option value="">Choose slide…</option>{slides.map((slide) => <option key={slide.id} value={slide.id}>{slide.label}</option>)}
      </Select>}
      {URL_KINDS.has(kind) && <Input aria-label="Action URL" className={classes} value={draft?.url || ''} placeholder={kind === 'email' ? 'mailto:name@example.com' : 'https://example.com'} onChange={(event) => update({ url: event.target.value })} />}
      {!NAV_KINDS.has(kind) && kind !== 'none' && <label className="flex items-center gap-1 text-[11px] text-text-muted"><input aria-label="Open in new window" type="checkbox" checked={draft?.target === 'new'} onChange={(event) => update({ target: event.target.checked ? 'new' : 'same' })} />New window</label>}
      {kind !== 'none' && <><Input aria-label="Action label" className={classes} value={draft?.label || ''} placeholder="Accessible label (optional)" onChange={(event) => update({ label: event.target.value })} /><label className="flex items-center gap-1 text-[11px] text-text-muted"><input aria-label="Transparent hotspot" type="checkbox" checked={draft?.hotspot === true} onChange={(event) => update({ hotspot: event.target.checked })} />Transparent hotspot</label></>}
      {validation.error && <span role="alert" className="text-[11px] text-danger">{validation.error}</span>}
      {!compact && kind !== 'none' && <Button variant="ghost" className="self-start text-[11px]" onClick={clear}>Clear action</Button>}
    </div>
  )
}
