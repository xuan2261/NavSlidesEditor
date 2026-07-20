import { Copy, Lock, Trash2, Wand2 } from 'lucide-react'
import { SlideThumbnailPreview } from './slide-thumbnail-preview'

const ITEM_CLASS = 'slide-item group relative rounded-md border-2 transition-colors focus-within:ring-2 focus-within:ring-focus/25'

export function SlideNavigatorItem({
  slide, index, current, selected, focused, actionsActive, dragOver, slideCount, resolution,
  onActivate, onFocus, onKeyDown, onContextMenu, onDuplicate, onDelete,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  currentVerticalIndex, onSelectVertical, buttonRef,
}) {
  return (
    <li
      data-testid="slide-panel-item"
      onClick={(event) => {
        if (event.target === event.currentTarget) onActivate(event)
      }}
      onContextMenu={onContextMenu}
      className={`${ITEM_CLASS} ${current ? 'border-accent' : 'border-transparent'} ${selected && !current ? 'outline outline-2 outline-accent' : ''} ${dragOver ? 'outline outline-2 outline-accent' : ''}`}
    >
      <button
        type="button"
        ref={buttonRef}
        className="block w-full cursor-pointer text-left"
        aria-label={`Select slide ${index + 1}`}
        aria-current={current ? 'true' : undefined}
        aria-pressed={selected}
        tabIndex={focused ? 0 : -1}
        draggable
        onClick={onActivate}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <span className="absolute left-1 top-1 z-10 rounded bg-surface-2/80 px-1 text-[10px] text-text-muted">{index + 1}</span>
        <span className="absolute right-1 top-1 z-10 flex gap-1" aria-hidden="true">
          {slide.locked && <Lock size={9} />}
          {slide.autoAnimate && <Wand2 size={9} />}
        </span>
        {slide.section && <span className="block truncate pl-1 text-[9px] text-white/50">§ {slide.section}</span>}
        <SlideThumbnailPreview slide={slide} width={resolution.width} height={resolution.height} className="m-1.5" />
      </button>
      <div className="absolute right-1 top-1 z-20 flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
        <button type="button" title="Duplicate" aria-label={`Duplicate slide ${index + 1}`} tabIndex={actionsActive ? 0 : -1} onClick={() => onDuplicate(index)} className="flex min-h-11 min-w-11 items-center justify-center rounded bg-black/60 p-1 text-white"><Copy size={12} /></button>
        <button type="button" title={slideCount <= 1 ? 'Cannot delete last slide' : 'Delete'} aria-label={slideCount <= 1 ? 'Cannot delete last slide' : `Delete slide ${index + 1}`} disabled={slideCount <= 1} tabIndex={actionsActive ? 0 : -1} onClick={() => onDelete(index)} className="flex min-h-11 min-w-11 items-center justify-center rounded bg-black/60 p-1 text-white disabled:opacity-40"><Trash2 size={12} /></button>
      </div>
      {(slide.children || []).length > 0 && (
        <ul className="ml-2 border-l-2 border-accent/30 pl-2">
          {slide.children.map((child, childIndex) => {
            const childCurrent = currentVerticalIndex?.parent === index && currentVerticalIndex?.child === childIndex
            return (
              <li key={child.id || childIndex} className="mb-1">
                <button type="button" className={`relative block w-full rounded border-2 ${childCurrent ? 'border-accent' : 'border-transparent'}`} aria-label={`Select vertical slide ${index + 1}.${childIndex + 1}`} aria-current={childCurrent ? 'true' : undefined} onClick={() => onSelectVertical?.({ parent: index, child: childIndex })}>
                  <span className="absolute left-1 top-1 z-10 text-[8px]">{index + 1}.{childIndex + 1}</span>
                  <SlideThumbnailPreview slide={child} width={resolution.width} height={resolution.height} className="min-h-[24px]" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
