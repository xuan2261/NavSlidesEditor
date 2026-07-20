import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowDownRight, ArrowUp, Copy, LayoutTemplate, Lock, Plus, Trash2, Unlock, Wand2 } from 'lucide-react'
import { Button } from './ui/Button'
import { SlideNavigatorItem } from './slide-panel/slide-navigator-item'

const menuClass = 'flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-hover focus:bg-hover focus:outline-none disabled:opacity-45'
const slideId = (slide, index) => slide?.id || `slide-${index}`

export default function SlidePanel(props) {
  const { slides, currentIndex, onSelect, onAdd, onDelete, onDuplicate, onDeleteSelected, onDuplicateSelected, onMove, onToggleLock, onToggleAutoAnimate, onAddVerticalSlide, onSelectVertical, currentVerticalIndex, onAddFromTemplate, resolution = {} } = props
  const [selectedIds, setSelectedIds] = useState(() => new Set([slideId(slides[currentIndex], currentIndex)]))
  const [focusIndex, setFocusIndex] = useState(currentIndex)
  const [activeActionIndex, setActiveActionIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const dragIndexRef = useRef(null)
  const buttonsRef = useRef([])
  const originRef = useRef(null)
  const menuRef = useRef(null)
  const ids = slides.map(slideId)
  const effectiveSelectedIds = ids.some((id) => selectedIds.has(id))
    ? selectedIds
    : new Set([ids[currentIndex]])
  const selectedIndices = ids.flatMap((id, index) => effectiveSelectedIds.has(id) ? [index] : [])

  useLayoutEffect(() => {
    if (!ctxMenu || !menuRef.current) return
    menuRef.current.style.top = `${ctxMenu.y}px`
    menuRef.current.style.left = `${ctxMenu.x}px`
  }, [ctxMenu])

  function activate(event, index) {
    const id = ids[index]
    setSelectedIds((previous) => {
      if (event.ctrlKey || event.metaKey) {
        const next = new Set(previous)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      }
      if (event.shiftKey && previous.size) {
        const anchor = ids.findIndex((candidate) => previous.has(candidate))
        return new Set(ids.slice(Math.min(anchor, index), Math.max(anchor, index) + 1))
      }
      return new Set([id])
    })
    onSelect(index)
  }

  function keyDown(event, index) {
    const destination = event.key === 'ArrowDown' ? Math.min(index + 1, slides.length - 1) : event.key === 'ArrowUp' ? Math.max(index - 1, 0) : event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : null
    if (destination !== null) {
      event.preventDefault(); setFocusIndex(destination); buttonsRef.current[destination]?.focus(); return
    }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event, index) }
    if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault(); originRef.current = event.currentTarget
      const rect = event.currentTarget.getBoundingClientRect(); setCtxMenu({ x: rect.left + 12, y: rect.top + 12, index })
    }
  }

  function closeMenu(restore = false) {
    setCtxMenu(null)
    if (restore) queueMicrotask(() => originRef.current?.focus())
  }

  return <div className="slide-panel tour-step-slide-panel flex h-full w-[200px] flex-col border-r border-border bg-secondary">
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 text-sm font-semibold"><span>Slides</span><span aria-hidden="true" className="text-[11px] text-text-muted">{slides.length}</span></div>
    <nav aria-label="Slides" className="flex-1 overflow-y-auto p-2">
      <ul className="space-y-2">{slides.map((slide, index) => <SlideNavigatorItem
        key={ids[index]} slide={slide} index={index} current={index === currentIndex} selected={effectiveSelectedIds.has(ids[index])} focused={index === focusIndex} actionsActive={index === activeActionIndex} dragOver={index === dragOverIndex} slideCount={slides.length}
        resolution={{ width: resolution.width || 960, height: resolution.height || 540 }} currentVerticalIndex={currentVerticalIndex} onSelectVertical={onSelectVertical}
        onActivate={(event) => activate(event, index)} onFocus={() => { setFocusIndex(index); setActiveActionIndex(index) }} onKeyDown={(event) => keyDown(event, index)}
        onContextMenu={(event) => { event.preventDefault(); originRef.current = event.currentTarget; setCtxMenu({ x: event.clientX, y: event.clientY, index }) }}
        onDuplicate={onDuplicate} onDelete={onDelete} onDragStart={() => { dragIndexRef.current = index }} onDragOver={(event) => { event.preventDefault(); setDragOverIndex(index) }} onDragLeave={() => setDragOverIndex(null)}
        onDrop={(event) => { event.preventDefault(); if (dragIndexRef.current !== null && dragIndexRef.current !== index) onMove(dragIndexRef.current, index); dragIndexRef.current = null; setDragOverIndex(null) }} onDragEnd={() => { dragIndexRef.current = null; setDragOverIndex(null) }}
        buttonRef={(node) => { buttonsRef.current[index] = node }}
      />)}</ul>
    </nav>
    {selectedIndices.length > 1 && <div className="flex items-center gap-2 border-t p-2 text-xs"><span>{selectedIndices.length} selected</span><Button variant="icon" title="Duplicate all selected" onClick={() => onDuplicateSelected ? onDuplicateSelected(selectedIndices) : selectedIndices.forEach(onDuplicate)}><Copy size={12}/> Duplicate</Button><Button variant="icon" title="Delete all selected" disabled={slides.length === selectedIndices.length} onClick={() => onDeleteSelected ? onDeleteSelected(selectedIndices) : [...selectedIndices].reverse().forEach(onDelete)}><Trash2 size={12}/> Delete</Button></div>}
    <div className="mt-auto flex flex-col gap-2 border-t p-4"><Button variant="secondary" className="add-slide-btn w-full" onClick={onAdd}><Plus size={14}/> Add Slide</Button>{onAddFromTemplate && <Button variant="secondary" onClick={onAddFromTemplate}><LayoutTemplate size={14}/> Insert Template</Button>}</div>
    {ctxMenu && <><div className="fixed inset-0 z-[9998]" onMouseDown={() => closeMenu()} /><div ref={menuRef} role="menu" aria-label="Slide actions" tabIndex={-1} className="absolute z-[9999] min-w-[180px] rounded-lg border bg-card py-1" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); return }
      const items = [...menuRef.current.querySelectorAll('[role=menuitem]:not(:disabled)')]; const current = items.indexOf(document.activeElement)
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus() }
    }}>
      <button role="menuitem" className={menuClass} onClick={() => { onDuplicate(ctxMenu.index); closeMenu() }}><Copy size={14}/> Duplicate</button>
      <button role="menuitem" className={menuClass} onClick={() => { onToggleLock?.(ctxMenu.index); closeMenu() }}>{slides[ctxMenu.index]?.locked ? <Unlock size={14}/> : <Lock size={14}/>} {slides[ctxMenu.index]?.locked ? 'Unlock' : 'Lock'}</button>
      <button role="menuitem" className={menuClass} onClick={() => { onToggleAutoAnimate?.(ctxMenu.index); closeMenu() }}><Wand2 size={14}/> {slides[ctxMenu.index]?.autoAnimate ? 'Disable' : 'Enable'} Auto-Animate</button>
      <button role="menuitem" className={menuClass} disabled={ctxMenu.index === 0} onClick={() => { onMove(ctxMenu.index, ctxMenu.index - 1); closeMenu() }}><ArrowUp size={14}/> Move Up</button>
      <button role="menuitem" className={menuClass} disabled={ctxMenu.index === slides.length - 1} onClick={() => { onMove(ctxMenu.index, ctxMenu.index + 1); closeMenu() }}><ArrowDown size={14}/> Move Down</button>
      {onAddVerticalSlide && <button role="menuitem" className={menuClass} onClick={() => { onAddVerticalSlide(ctxMenu.index); closeMenu() }}><ArrowDownRight size={14}/> Add Vertical Slide</button>}
      <button role="menuitem" className={`${menuClass} text-danger`} disabled={slides.length <= 1} onClick={() => { onDelete(ctxMenu.index); closeMenu() }}><Trash2 size={14}/> Delete</button>
    </div></>}
  </div>
}
