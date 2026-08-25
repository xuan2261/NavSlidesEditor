import { useMemo, useState } from 'react'
import { Copy, Edit3, LayoutTemplate, Plus, Trash2 } from 'lucide-react'
import { changeLayout, detachLayout } from 'revealjs-shared'
import { getSystemLayoutMasters } from '../data/slide-template-layout-adapter'
import { Button, ModalShell } from './ui'

const MAX_LAYOUTS = 64
const MAX_NAME_LENGTH = 200
const blankMaster = (name) => ({
  id: `custom-layout:${crypto.randomUUID()}`,
  name,
  fixedElements: [],
  placeholders: [],
  safeArea: { x: 48, y: 32, width: 864, height: 476 },
})

function uniqueName(name, layouts) {
  const base = String(name || 'Custom layout').trim().slice(0, MAX_NAME_LENGTH) || 'Custom layout'
  const names = new Set(layouts.map((layout) => layout.name.toLocaleLowerCase()))
  if (!names.has(base.toLocaleLowerCase())) return base
  for (let number = 2; number <= MAX_LAYOUTS; number += 1) {
    const candidate = `${base.slice(0, MAX_NAME_LENGTH - String(number).length - 1)} ${number}`
    if (!names.has(candidate.toLocaleLowerCase())) return candidate
  }
  return ''
}

function mapSlides(slides, transform) {
  return (slides || []).map((slide) => ({
    ...transform(slide),
    ...(slide.children ? { children: mapSlides(slide.children, transform) } : {}),
  }))
}

export default function LayoutManagerModal({ presentation, onChange, onEditMaster, onClose }) {
  const stored = useMemo(() => presentation?.layoutMasters || [], [presentation?.layoutMasters])
  const layouts = useMemo(() => {
    const customIds = new Set(stored.map((layout) => layout.id))
    return [...getSystemLayoutMasters().filter((layout) => !customIds.has(layout.id)), ...stored]
  }, [stored])
  const [name, setName] = useState('Custom layout')
  const [deleteId, setDeleteId] = useState(null)
  const [replacement, setReplacement] = useState('detach')

  const commitMasters = (next) => onChange?.({ ...presentation, layoutMasters: next })
  const addBlank = () => {
    if (stored.length >= MAX_LAYOUTS) return
    const nextName = uniqueName(name, layouts)
    if (!nextName) return
    const master = blankMaster(nextName)
    commitMasters([...stored, master])
    onEditMaster?.(master.id)
  }
  const duplicate = (layout) => {
    if (stored.length >= MAX_LAYOUTS) return
    const copy = {
      ...layout,
      id: `custom-layout:${crypto.randomUUID()}`,
      name: uniqueName(`${layout.name} copy`, layouts),
      fixedElements: layout.fixedElements.map((element) => ({ ...element, id: crypto.randomUUID() })),
      placeholders: layout.placeholders.map((placeholder) => ({ ...placeholder, id: crypto.randomUUID() })),
      system: undefined,
    }
    commitMasters([...stored, copy])
  }
  const rename = (layout) => {
    const nextName = uniqueName(name, layouts.filter((candidate) => candidate.id !== layout.id))
    if (!nextName) return
    commitMasters(stored.map((candidate) => candidate.id === layout.id ? { ...candidate, name: nextName } : candidate))
  }
  const remove = () => {
    const target = stored.find((layout) => layout.id === deleteId)
    if (!target || target.system) return
    let slides = presentation.slides || []
    if (replacement === 'detach') {
      slides = mapSlides(slides, (slide) => slide.layoutId === target.id ? detachLayout(slide, layouts).slide : slide)
    } else {
      slides = mapSlides(slides, (slide) => slide.layoutId === target.id ? changeLayout(slide, layouts, replacement).slide : slide)
    }
    onChange?.({ ...presentation, slides, layoutMasters: stored.filter((layout) => layout.id !== target.id) })
    setDeleteId(null)
  }

  return <ModalShell title="Layout Manager" titleId="layout-manager-title" size="lg" onClose={onClose}>
    <div className="mb-4 flex gap-2">
      <label className="sr-only" htmlFor="layout-name">Custom layout name</label>
      <input id="layout-name" value={name} maxLength={MAX_NAME_LENGTH} onChange={(event) => setName(event.target.value)} className="min-w-0 flex-1 rounded border border-border bg-secondary px-2 py-1 text-sm" />
      <Button variant="secondary" onClick={addBlank} disabled={stored.length >= MAX_LAYOUTS}><Plus size={14} /> Create blank</Button>
    </div>
    <p className="mb-3 text-xs text-text-muted">System layouts are read-only. Duplicate one before editing it. Custom layouts: {stored.length} / {MAX_LAYOUTS}.</p>
    <ul className="max-h-[52vh] space-y-2 overflow-y-auto" aria-label="Layouts">
      {layouts.map((layout) => <li key={layout.id} className="flex items-center gap-2 rounded border border-border p-2">
        <LayoutTemplate size={16} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-sm">{layout.name}</span>
        {layout.system && <span className="text-xs text-text-muted">System</span>}
        <Button variant="icon" title={`Duplicate ${layout.name}`} aria-label={`Duplicate ${layout.name}`} onClick={() => duplicate(layout)} disabled={stored.length >= MAX_LAYOUTS}><Copy size={14} /></Button>
        {!layout.system && <>
          <Button variant="icon" title={`Rename ${layout.name}`} aria-label={`Rename ${layout.name}`} onClick={() => rename(layout)}><Edit3 size={14} /></Button>
          <Button variant="icon" title={`Edit master ${layout.name}`} aria-label={`Edit master ${layout.name}`} onClick={() => onEditMaster?.(layout.id)}><LayoutTemplate size={14} /></Button>
          <Button variant="icon" title={`Delete ${layout.name}`} aria-label={`Delete ${layout.name}`} onClick={() => { setDeleteId(layout.id); setReplacement('detach') }}><Trash2 size={14} /></Button>
        </>}
      </li>)}
    </ul>
    {deleteId && <div className="mt-4 rounded border border-danger p-3" role="group" aria-label="Delete linked layout">
      <p className="mb-2 text-sm">Linked slides must be detached or moved to another layout before deletion.</p>
      <label className="flex items-center gap-2 text-sm"><span>On delete</span><select value={replacement} onChange={(event) => setReplacement(event.target.value)} className="rounded border border-border bg-secondary px-2 py-1"><option value="detach">Detach linked slides</option>{layouts.filter((layout) => layout.id !== deleteId).map((layout) => <option value={layout.id} key={layout.id}>Change to {layout.name}</option>)}</select></label>
      <div className="mt-3 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button><Button variant="danger" onClick={remove}>Delete layout</Button></div>
    </div>}
    <div className="mt-5 flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>
  </ModalShell>
}
