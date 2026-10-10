import { memo, useCallback } from 'react'
import { Copy, Lock, Trash2, Wand2 } from 'lucide-react'
import { SlideThumbnailPreview } from './slide-thumbnail-preview'

const ITEM_CLASS =
  'slide-item group relative rounded-md border-2 transition-colors focus-within:ring-2 focus-within:ring-focus/25'

export const SlideNavigatorItem = memo(function SlideNavigatorItem({
  slide, index, current, selected, focused, actionsActive, dragOver, slideCount, resolution, designTokens, layoutMasters,
  onActivate, onFocus, onKeyDown, onContextMenu, onDuplicate, onDelete,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  currentVerticalIndex, onSelectVertical, onChildContextMenu, buttonRef,
}) {
  const handleItemClick = useCallback((event) => {
    if (event.target === event.currentTarget && onActivate) {
      onActivate(event, index)
    }
  }, [onActivate, index])

  const handleItemContextMenu = useCallback((event) => {
    if (onContextMenu) onContextMenu(event, index)
  }, [onContextMenu, index])

  const handleButtonClick = useCallback((event) => {
    if (onActivate) onActivate(event, index)
  }, [onActivate, index])

  const handleButtonFocus = useCallback(() => {
    if (onFocus) onFocus(index)
  }, [onFocus, index])

  const handleButtonKeyDown = useCallback((event) => {
    if (onKeyDown) onKeyDown(event, index)
  }, [onKeyDown, index])

  const handleButtonDragStart = useCallback((event) => {
    if (onDragStart) onDragStart(event, index)
  }, [onDragStart, index])

  const handleButtonDragOver = useCallback((event) => {
    if (onDragOver) onDragOver(event, index)
  }, [onDragOver, index])

  const handleButtonDrop = useCallback((event) => {
    if (onDrop) onDrop(event, index)
  }, [onDrop, index])

  const handleButtonDuplicate = useCallback(() => {
    if (onDuplicate) onDuplicate(index)
  }, [onDuplicate, index])

  const handleButtonDelete = useCallback(() => {
    if (onDelete) onDelete(index)
  }, [onDelete, index])

  const handleButtonRef = useCallback((node) => {
    if (buttonRef) buttonRef(node, index)
  }, [buttonRef, index])
  return (
    <li
      data-testid="slide-panel-item"
      onClick={handleItemClick}
      onContextMenu={handleItemContextMenu}
      className={`${ITEM_CLASS} ${current ? 'border-accent' : 'border-transparent'} ${selected && !current ? 'outline outline-2 outline-accent' : ''} ${dragOver ? 'outline outline-2 outline-accent' : ''}`}
    >
      <button
        type="button"
        ref={handleButtonRef}
        className="block w-full cursor-pointer text-left"
        aria-label={`Select slide ${index + 1}`}
        aria-current={current ? 'true' : undefined}
        aria-pressed={selected}
        tabIndex={focused ? 0 : -1}
        draggable
        onClick={handleButtonClick}
        onFocus={handleButtonFocus}
        onKeyDown={handleButtonKeyDown}
        onDragStart={handleButtonDragStart}
        onDragOver={handleButtonDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleButtonDrop}
        onDragEnd={onDragEnd}
      >
        <span className="absolute left-1 top-1 z-10 rounded bg-surface-2/80 px-1 text-[10px] text-text-muted">
          {index + 1}
        </span>
        <span className="absolute right-1 top-1 z-10 flex gap-1" aria-hidden="true">
          {slide.locked && <Lock size={9} />}
          {slide.autoAnimate && <Wand2 size={9} />}
        </span>
        {slide.section && (
          <span className="block truncate pl-1 text-[9px] text-white/50">§ {slide.section}</span>
        )}
        <SlideThumbnailPreview
          slide={slide}
          resolution={resolution}
          designTokens={designTokens}
          layoutMasters={layoutMasters}
          className="m-1.5"
        />
      </button>
      <div className="absolute right-1 top-1 z-20 flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
        <button type="button" title="Duplicate" aria-label={`Duplicate slide ${index + 1}`} tabIndex={actionsActive ? 0 : -1} onClick={handleButtonDuplicate} className="flex min-h-11 min-w-11 items-center justify-center rounded bg-black/60 p-1 text-white"><Copy size={12} /></button>
        <button type="button" title={slideCount <= 1 ? 'Cannot delete last slide' : 'Delete'} aria-label={slideCount <= 1 ? 'Cannot delete last slide' : `Delete slide ${index + 1}`} disabled={slideCount <= 1} tabIndex={actionsActive ? 0 : -1} onClick={handleButtonDelete} className="flex min-h-11 min-w-11 items-center justify-center rounded bg-black/60 p-1 text-white disabled:opacity-40"><Trash2 size={12} /></button>
      </div>
      {(slide.children || []).length > 0 && (
        <ul className="ml-2 border-l-2 border-accent/30 pl-2">
          {slide.children.map((child, childIndex) => {
            const childCurrent =
              currentVerticalIndex?.parent === index && currentVerticalIndex?.child === childIndex
            return (
              <li key={child.id || childIndex} className="mb-1">
                <button
                  type="button"
                  className={`relative block w-full rounded border-2 ${childCurrent ? 'border-accent' : 'border-transparent'}`}
                  aria-label={`Select vertical slide ${index + 1}.${childIndex + 1}`}
                  aria-current={childCurrent ? 'true' : undefined}
                  onClick={() => onSelectVertical?.({ parent: index, child: childIndex })}
                  onContextMenu={(event) => onChildContextMenu?.(event, index, childIndex)}
                  onKeyDown={(event) => {
                    if (event.key === 'F10' && event.shiftKey) onChildContextMenu?.(event, index, childIndex)
                  }}
                >
                  <span className="absolute left-1 top-1 z-10 text-[8px]">
                    {index + 1}.{childIndex + 1}
                  </span>
                  <SlideThumbnailPreview
                    slide={child}
                    resolution={resolution}
                    designTokens={designTokens}
                    layoutMasters={layoutMasters}
                    className="min-h-[24px]"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
})
