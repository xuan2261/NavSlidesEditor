import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus,
  Copy,
  ArrowUp,
  ArrowDown,
  Trash2,
  Lock,
  Unlock,
  Sparkles,
  ArrowDownRight,
} from 'lucide-react'
import { Button } from './ui/Button'

const DEFAULT_SLIDE_WIDTH = 960
const DEFAULT_SLIDE_HEIGHT = 540
const THUMBNAIL_PREVIEW_WIDTH = 180

function getBgStyle(bg) {
  if (!bg || bg.type === 'none') return { backgroundColor: 'var(--bg-canvas-default, #ffffff)' }
  if (bg.type === 'color') return { backgroundColor: bg.color || 'var(--bg-canvas-default, #ffffff)' }
  if (bg.type === 'gradient') return { background: bg.gradient || 'var(--bg-canvas-default, #ffffff)' }
  if (bg.type === 'image' && bg.image)
    return {
      backgroundImage: `url(${bg.image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  return { backgroundColor: 'var(--bg-canvas-default, #ffffff)' }
}

function getPreviewScale(slideWidth) {
  return THUMBNAIL_PREVIEW_WIDTH / (slideWidth || DEFAULT_SLIDE_WIDTH)
}

function getPreviewFrameStyle(bg, slideWidth, slideHeight) {
  return {
    ...getBgStyle(bg),
    aspectRatio: `${slideWidth} / ${slideHeight}`,
  }
}

function getPreviewElementStyle(el, slideWidth, slideHeight) {
  return {
    position: 'absolute',
    left: `${(el.x / slideWidth) * 100}%`,
    top: `${(el.y / slideHeight) * 100}%`,
    width: `${(el.width / slideWidth) * 100}%`,
    height: `${(el.height / slideHeight) * 100}%`,
    overflow: 'hidden',
    zIndex: el.zIndex || 1,
  }
}

function getPreviewIframeStyle(el, slideWidth) {
  return {
    position: 'absolute',
    top: 0,
    left: 0,
    width: `${el.width || 400}px`,
    height: `${el.height || 300}px`,
    border: 'none',
    pointerEvents: 'none',
    transformOrigin: 'top left',
    transform: `scale(${getPreviewScale(slideWidth)})`,
  }
}

function getPreviewTextStyle(el, slideWidth) {
  return {
    width: `${el.width || 0}px`,
    height: `${el.height || 0}px`,
    overflow: 'hidden',
    color: 'white',
    padding: '8px 12px',
    boxSizing: 'border-box',
    fontSize: '16px',
    transformOrigin: 'top left',
    transform: `scale(${getPreviewScale(slideWidth)})`,
  }
}

function getPreviewTableCellStyle(el, rowIndex) {
  const headerBg = el.headerBgColor || 'rgba(99,102,241,0.3)'
  const cellBg = el.cellBgColor || 'transparent'
  const borderColor = el.borderColor || 'rgba(255,255,255,0.2)'
  const borderWidth = Math.max(0.5, (el.borderWidth ?? 1) / 4)
  const textColor = el.textColor || '#ffffff'

  return {
    padding: 2,
    border: `${borderWidth}px solid ${borderColor}`,
    background: el.headerRow && rowIndex === 0 ? headerBg : cellBg,
    color: textColor,
    fontSize: 4,
    fontWeight: el.headerRow && rowIndex === 0 ? 600 : 400,
    verticalAlign: 'middle',
    overflow: 'hidden',
  }
}

function getPreviewCalloutStyle(el) {
  return { background: el.calloutColor || '#ef4444' }
}

function getContextMenuStyle(ctxMenu) {
  return { top: ctxMenu.y, left: ctxMenu.x }
}

export default function SlidePanel({
  slides,
  currentIndex,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onDeleteSelected,
  onDuplicateSelected,
  onMove,
  onToggleLock,
  onToggleAutoAnimate,
  onAddVerticalSlide,
  onSelectVertical,
  currentVerticalIndex,
  onAddFromTemplate,
  resolution,
}) {
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragIndexRef = useRef(null)
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, index }
  const ctxMenuRef = useRef(null)
  const [selectedIndices, setSelectedIndices] = useState([currentIndex])
  const slideWidth = resolution?.width || DEFAULT_SLIDE_WIDTH
  const slideHeight = resolution?.height || DEFAULT_SLIDE_HEIGHT

  // Close context menu on click outside / Escape
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const handleKey = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', handleKey)
    }
  }, [ctxMenu])

  const handleContextMenu = useCallback((e, index) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, index })
  }, [setCtxMenu])

  return (
    <div className="slide-panel tour-step-slide-panel flex flex-col w-[200px] bg-secondary border-r border-border h-full">
      <div className="slide-panel-header px-4 py-3 flex items-center justify-between border-b border-border bg-card font-medium text-text-primary text-sm">
        <span>Slides</span>
        <span className="text-text-muted text-[11px]">{slides.length}</span>
      </div>

      <div className="slide-list flex-1 overflow-y-auto p-2 space-y-2">
        {slides.map((slide, index) => {
          return (
            <div
              key={slide.id || index}
              className={`slide-item group rounded-sm border-2 cursor-pointer relative transition-all hover:border-border-strong ${index === currentIndex ? 'border-accent' : 'border-transparent'} ${selectedIndices.includes(index) && index !== currentIndex ? 'outline outline-2 outline-accent outline-offset-[-2px]' : ''} ${dragOverIndex === index ? 'outline outline-2 outline-accent outline-offset-[-2px]' : ''}`}
              draggable
              onDragStart={() => {
                dragIndexRef.current = index
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(index)
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOverIndex(null)
                const from = dragIndexRef.current
                if (from !== null && from !== index) onMove(from, index)
                dragIndexRef.current = null
              }}
              onDragEnd={() => {
                setDragOverIndex(null)
                dragIndexRef.current = null
              }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  setSelectedIndices((prev) =>
                    prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
                  )
                } else if (e.shiftKey && selectedIndices.length > 0) {
                  const last = selectedIndices[selectedIndices.length - 1]
                  const start = Math.min(last, index)
                  const end = Math.max(last, index)
                  const range = Array.from({ length: end - start + 1 }, (_, i) => start + i)
                  setSelectedIndices(range)
                } else {
                  setSelectedIndices([index])
                }
                onSelect(index)
              }}
              onContextMenu={(e) => handleContextMenu(e, index)}
            >
              <span
                className={`absolute top-1 left-1 text-[10px] text-text-muted bg-surface-2/80 px-1 py-[1px] rounded-[3px] z-10 ${
                  slide.locked ? 'line-through opacity-50' : ''
                }`}
              >
                {index + 1}
              </span>

              {/* Indicators */}
              <div className="flex gap-0.5 absolute top-0.5 right-0.5 z-10">
                {slide.locked && (
                  <span title="Slide locked" className="text-amber-400 text-[9px]">
                    <Lock size={9} />
                  </span>
                )}
                {slide.autoAnimate && (
                  <span title="Auto-Animate" className="text-accent text-[9px]">
                    <Sparkles size={9} />
                  </span>
                )}
              </div>

              {slide.section && (
                <div className="text-[9px] text-white/50 mb-0.5 pl-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  § {slide.section}
                </div>
              )}
              <div
                className="flex items-start p-1.5 overflow-hidden relative"
                style={getPreviewFrameStyle(slide.background, slideWidth, slideHeight)}
              >
                {(slide.elements || []).map((el) => (
                  <div
                    key={el.id}
                    style={getPreviewElementStyle(el, slideWidth, slideHeight)}
                  >
                    {el.type === 'text' && (
                      <div
                        className="slide-text-content ProseMirror-preview"
                        style={getPreviewTextStyle(el, slideWidth)}
                        dangerouslySetInnerHTML={{ __html: el.content || '' }}
                      />
                    )}
                    {el.type === 'image' && (
                      <img
                        src={el.src}
                        alt=""
                        className="w-full h-full object-cover block"
                        draggable={false}
                      />
                    )}
                    {el.type === 'html' &&
                      (el.content ? (
                        <div className="w-full h-full overflow-hidden relative">
                          <iframe
                            srcDoc={el.content}
                            style={getPreviewIframeStyle(el, slideWidth)}
                            sandbox="allow-scripts"
                            tabIndex={-1}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full bg-primary/15 flex items-center justify-center text-[6px] text-white/40">
                          &lt;/&gt;
                        </div>
                      ))}
                    {el.type === 'code' && (
                      <div className="w-full h-full bg-black/50 flex items-center justify-center text-[5px] text-lime-200/70 font-mono">
                        {el.language || 'code'}
                      </div>
                    )}
                    {el.type === 'video' && (
                      <div className="w-full h-full bg-black/40 flex items-center justify-center text-[8px] text-white/50">
                        &#9654;
                      </div>
                    )}
                    {el.type === 'audio' && (
                      <div className="w-full h-full bg-primary/15 flex items-center justify-center text-[6px] text-white/40">
                        &#9835;
                      </div>
                    )}
                    {el.type === 'table' &&
                      (() => {
                        const data = el.data || [['']]
                        return (
                          <div className="w-full h-full overflow-hidden">
                            <table className="w-full h-full border-collapse table-fixed">
                              <tbody>
                                {data.map((row, ri) => (
                                  <tr key={ri}>
                                    {(row || []).map((cell, ci) => (
                                      <td
                                        key={ci}
                                        style={getPreviewTableCellStyle(el, ri)}
                                      >
                                        {cell || ''}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      })()}
                    {el.type === 'latex' && (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center text-[6px] text-white/40 font-serif italic">
                        TeX
                      </div>
                    )}
                    {el.type === 'markdown' && (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center text-[6px] text-white/40 font-bold">
                        MD
                      </div>
                    )}
                    {el.type === 'chart' && (
                      <div className="w-full h-full bg-primary/15 flex items-center justify-center text-[6px] text-white/40">
                        &#9776;
                      </div>
                    )}
                    {el.type === 'callout' && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div
                          className="w-[60%] h-[60%] rounded-full flex items-center justify-center text-white text-[5px] font-bold"
                          style={getPreviewCalloutStyle(el)}
                        >
                          {el.calloutNumber || 1}
                        </div>
                      </div>
                    )}
                    {el.type === 'icon' && (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-white/40">
                        &#9733;
                      </div>
                    )}
                    {el.type === 'drawing' && (
                      <div className="w-full h-full flex items-center justify-center text-[6px] text-white/40">
                        ✏
                      </div>
                    )}
                    {el.type === 'line' && (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-white/40">
                        ↗
                      </div>
                    )}
                    {el.type === 'svg' && (
                      <div className="w-full h-full flex items-center justify-center text-[6px] text-white/40">
                        SVG
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 transition-opacity z-10 group-hover:opacity-100">
                <button
                  className="bg-black/60 border-none text-white p-1 rounded-[3px] cursor-pointer flex items-center justify-center hover:bg-accent/80"
                  title="Duplicate"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate(index)
                  }}
                >
                  <Copy size={12} />
                </button>
                <button
                  className={`bg-black/60 border-none p-1 rounded-[3px] flex items-center justify-center ${slides.length > 1 ? 'text-white hover:bg-accent/80 cursor-pointer' : 'text-white/30 cursor-not-allowed opacity-50'}`}
                  title={slides.length <= 1 ? 'Cannot delete last slide' : 'Delete'}
                  disabled={slides.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (slides.length > 1) onDelete(index)
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Vertical children */}
              {(slide.children || []).length > 0 && (
                <div className="mt-0.5 pl-2 border-l-2 border-accent/30">
                  {slide.children.map((child, ci) => (
                    <div
                      key={child.id || `${index}-${ci}`}
                      className={`group rounded-sm border-2 cursor-pointer relative transition-all hover:border-border-strong mb-0.5 ${currentVerticalIndex?.parent === index && currentVerticalIndex?.child === ci ? 'border-accent' : 'border-transparent'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectVertical?.({ parent: index, child: ci })
                      }}
                    >
                      <span
                        className="absolute top-1 left-1 text-[8px] text-text-muted bg-surface-2/80 px-1 py-[1px] rounded-[3px] z-10"
                      >
                        {index + 1}.{ci + 1}
                      </span>
                      <div
                        className="flex items-start p-1 overflow-hidden relative min-h-[24px]"
                        style={getPreviewFrameStyle(child.background, slideWidth, slideHeight)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="p-4 border-t border-border bg-secondary mt-auto flex flex-col gap-2">
        <Button
          variant="secondary"
          className="add-slide-btn w-full flex items-center justify-center gap-1.5 border border-dashed border-border hover:border-accent hover:text-accent hover:bg-hover"
          onClick={onAdd}
        >
          <Plus size={14} />
          Add Slide
        </Button>
        {onAddFromTemplate && (
          <Button
            variant="secondary"
            className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border hover:border-accent hover:text-accent hover:bg-hover"
            onClick={onAddFromTemplate}
          >
            <Sparkles size={14} />
            Insert Template
          </Button>
        )}
      </div>

      {/* Batch operations footer when multi-selecting */}
      {selectedIndices.length > 1 && (
        <div className="flex items-center gap-2 py-1.5 px-3 border-t border-border bg-surface-2 text-xs text-text-muted">
          <span>{selectedIndices.length} selected</span>
          <Button
            variant="icon"
            onClick={() => {
              const lastIdx = selectedIndices[selectedIndices.length - 1]
              if (onDuplicateSelected) {
                onDuplicateSelected(selectedIndices)
              } else {
                selectedIndices.forEach((i) => onDuplicate(i))
              }
              setSelectedIndices([lastIdx])
            }}
            title="Duplicate all selected"
          >
            <Copy size={12} /> Duplicate
          </Button>
          <Button
            variant="icon"
            onClick={() => {
              if (slides.length - selectedIndices.length < 1) return
              if (onDeleteSelected) {
                onDeleteSelected(selectedIndices)
              } else {
                [...selectedIndices].sort((a, b) => b - a).forEach((i) => onDelete(i))
              }
              setSelectedIndices([
                Math.max(0, Math.min(currentIndex, slides.length - selectedIndices.length - 1)),
              ])
            }}
            title="Delete all selected"
          >
            <Trash2 size={12} /> Delete
          </Button>
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[9998]" onMouseDown={() => setCtxMenu(null)} />
          <div
            role="menu"
            aria-label="Slide actions"
            className="absolute z-[9999] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
            style={getContextMenuStyle(ctxMenu)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setCtxMenu(null); return }
              const items = Array.from(ctxMenuRef.current?.querySelectorAll?.('[role="menuitem"]') || [])
              if (!items.length) return
              const current = document.activeElement
              const idx = items.indexOf(current)
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                items[(idx + 1) % items.length]?.focus()
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                items[(idx - 1 + items.length) % items.length]?.focus()
              }
            }}
            ref={ctxMenuRef}
          >
            <button
              role="menuitem"
              tabIndex={0}
              onClick={() => {
                onDuplicate(ctxMenu.index)
                setCtxMenu(null)
              }}
            >
              <Copy size={14} /> Duplicate
            </button>
            <button
              role="menuitem"
              tabIndex={0}
              onClick={() => {
                onToggleLock?.(ctxMenu.index)
                setCtxMenu(null)
              }}
            >
              {slides[ctxMenu.index]?.locked ? <Unlock size={14} /> : <Lock size={14} />}
              {slides[ctxMenu.index]?.locked ? 'Unlock' : 'Lock'}
            </button>
            <button
              role="menuitem"
              tabIndex={0}
              onClick={() => {
                onToggleAutoAnimate?.(ctxMenu.index)
                setCtxMenu(null)
              }}
            >
              <Sparkles size={14} />
              {slides[ctxMenu.index]?.autoAnimate ? 'Disable' : 'Enable'} Auto-Animate
            </button>
            <div className="h-px bg-border my-1 mx-2" />
            <button
              role="menuitem"
              tabIndex={0}
              onClick={() => {
                onMove(ctxMenu.index, ctxMenu.index - 1)
                setCtxMenu(null)
              }}
              disabled={ctxMenu.index === 0}
            >
              <ArrowUp size={14} /> Move Up
            </button>
            <button
              role="menuitem"
              tabIndex={0}
              onClick={() => {
                onMove(ctxMenu.index, ctxMenu.index + 1)
                setCtxMenu(null)
              }}
              disabled={ctxMenu.index === slides.length - 1}
            >
              <ArrowDown size={14} /> Move Down
            </button>
            {onAddVerticalSlide && (
              <button
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  onAddVerticalSlide?.(ctxMenu.index)
                  setCtxMenu(null)
                }}
              >
                <ArrowDownRight size={14} /> Add Vertical Slide
              </button>
            )}
            <div className="h-px bg-border my-1 mx-2" />
            <button
              role="menuitem"
              tabIndex={0}
              onClick={() => {
                if (slides.length > 1) onDelete(ctxMenu.index)
                setCtxMenu(null)
              }}
              className={slides.length > 1 ? 'text-danger' : 'text-text-muted'}
              disabled={slides.length <= 1}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
