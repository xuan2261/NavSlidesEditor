import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Copy, ArrowUp, ArrowDown, Trash2, Lock, Unlock, Sparkles, ArrowDownRight } from 'lucide-react'

function getBgStyle(bg) {
  if (!bg) return { backgroundColor: '#1e1e2e' }
  if (bg.type === 'color') return { backgroundColor: bg.color || '#1e1e2e' }
  if (bg.type === 'gradient') return { background: bg.gradient || '#1e1e2e' }
  if (bg.type === 'image' && bg.image)
    return {
      backgroundImage: `url(${bg.image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  return { backgroundColor: '#1e1e2e' }
}

export default function SlidePanel({
  slides,
  currentIndex,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onMove,
  onToggleLock,
  onToggleAutoAnimate,
  onAddVerticalSlide,
  onSelectVertical,
  currentVerticalIndex,
  onAddFromTemplate,
}) {
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragIndexRef = useRef(null)
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, index }
  const [selectedIndices, setSelectedIndices] = useState([currentIndex])

  // Close context menu on click outside / Escape
  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    const handleKey = (e) => { if (e.key === 'Escape') close() }
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
  }, [])

  return (
    <div className="slide-panel">
      <div className="slide-panel-header">
        <span>Slides</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{slides.length}</span>
      </div>

      <div className="slide-list">
        {slides.map((slide, index) => {
          return (
            <div
              key={slide.id || index}
              className={`slide-item ${index === currentIndex ? 'active' : ''} ${selectedIndices.includes(index) && index !== currentIndex ? 'multi-selected' : ''}`}
              style={
                dragOverIndex === index
                  ? { outline: '2px solid var(--accent)', outlineOffset: '-2px' }
                  : undefined
              }
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
                  setSelectedIndices(prev =>
                    prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
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
                className="slide-number"
                style={slide.locked ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
              >
                {index + 1}
              </span>

              {/* Indicators */}
              <div style={{ display: 'flex', gap: 2, position: 'absolute', top: 2, right: 2, zIndex: 10 }}>
                {slide.locked && (
                  <span title="Slide locked" style={{ color: '#f59e0b', fontSize: 9 }}>
                    <Lock size={9} />
                  </span>
                )}
                {slide.autoAnimate && (
                  <span title="Auto-Animate" style={{ color: '#6366f1', fontSize: 9 }}>
                    <Sparkles size={9} />
                  </span>
                )}
              </div>

              {slide.section && (
                <div
                  style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: 2,
                    paddingLeft: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  § {slide.section}
                </div>
              )}
              <div
                className="slide-thumbnail"
                style={{
                  ...getBgStyle(slide.background),
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {(slide.elements || []).map((el) => (
                  <div
                    key={el.id}
                    style={{
                      position: 'absolute',
                      left: `${(el.x / 960) * 100}%`,
                      top: `${(el.y / 540) * 100}%`,
                      width: `${(el.width / 960) * 100}%`,
                      height: `${(el.height / 540) * 100}%`,
                      overflow: 'hidden',
                      fontSize: '4px',
                      lineHeight: 1.3,
                      color: 'white',
                      zIndex: el.zIndex || 1,
                    }}
                  >
                    {el.type === 'text' && (
                      <div className="slide-thumbnail-text" dangerouslySetInnerHTML={{ __html: el.content || '' }} />
                    )}
                    {el.type === 'image' && (
                      <img
                        src={el.src}
                        alt=""
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                        draggable={false}
                      />
                    )}
                    {el.type === 'html' && (
                      el.content ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          <iframe
                            srcDoc={el.content}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: `${el.width || 400}px`,
                              height: `${el.height || 300}px`,
                              border: 'none',
                              pointerEvents: 'none',
                              transformOrigin: 'top left',
                              transform: `scale(${180 / 960})`,
                            }}
                            sandbox="allow-scripts"
                            tabIndex={-1}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            background: 'rgba(99,102,241,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 6,
                            color: 'rgba(255,255,255,0.4)',
                          }}
                        >
                          &lt;/&gt;
                        </div>
                      )
                    )}
                    {el.type === 'code' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'rgba(0,0,0,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 5,
                          color: 'rgba(180,220,120,0.7)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {el.language || 'code'}
                      </div>
                    )}
                    {el.type === 'video' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'rgba(0,0,0,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 8,
                          color: 'rgba(255,255,255,0.5)',
                        }}
                      >
                        &#9654;
                      </div>
                    )}
                    {el.type === 'audio' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'rgba(99,102,241,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 6,
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        &#9835;
                      </div>
                    )}
                    {el.type === 'table' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'rgba(99,102,241,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 6,
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        &#9638;
                      </div>
                    )}
                    {el.type === 'latex' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'rgba(99,102,241,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 6,
                          color: 'rgba(255,255,255,0.4)',
                          fontFamily: 'serif',
                          fontStyle: 'italic',
                        }}
                      >
                        TeX
                      </div>
                    )}
                    {el.type === 'markdown' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 6,
                          color: 'rgba(255,255,255,0.4)',
                          fontWeight: 700,
                        }}
                      >
                        MD
                      </div>
                    )}
                    {el.type === 'chart' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: 'rgba(99,102,241,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 6,
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        &#9776;
                      </div>
                    )}
                    {el.type === 'callout' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: '60%',
                            height: '60%',
                            borderRadius: '50%',
                            background: el.calloutColor || '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: 5,
                            fontWeight: 700,
                          }}
                        >
                          {el.calloutNumber || 1}
                        </div>
                      </div>
                    )}
                    {el.type === 'icon' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 8,
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        &#9733;
                      </div>
                    )}
                    {el.type === 'drawing' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 6,
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        ✏
                      </div>
                    )}
                    {el.type === 'line' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 8,
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        ↗
                      </div>
                    )}
                    {el.type === 'svg' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 6,
                          color: 'rgba(255,255,255,0.4)',
                        }}
                      >
                        SVG
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="slide-actions">
                <button
                  className="slide-action-btn"
                  title="Duplicate"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate(index)
                  }}
                >
                  <Copy size={10} />
                </button>
                <button
                  className="slide-action-btn"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (slides.length > 1) onDelete(index)
                  }}
                  style={{ color: slides.length > 1 ? 'white' : 'rgba(255,255,255,0.3)' }}
                >
                  <Trash2 size={10} />
                </button>
              </div>

              {/* Vertical children */}
              {(slide.children || []).length > 0 && (
                <div style={{ marginTop: 2, paddingLeft: 8, borderLeft: '2px solid rgba(99,102,241,0.3)' }}>
                  {slide.children.map((child, ci) => (
                    <div
                      key={child.id || `${index}-${ci}`}
                      className={`slide-item ${currentVerticalIndex?.parent === index && currentVerticalIndex?.child === ci ? 'active' : ''}`}
                      style={{ marginBottom: 2, transform: 'scale(0.85)', transformOrigin: 'top left' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectVertical?.({ parent: index, child: ci })
                      }}
                    >
                      <span className="slide-number" style={{ fontSize: 8, color: '#818cf8' }}>
                        {index + 1}.{ci + 1}
                      </span>
                      <div
                        className="slide-thumbnail"
                        style={{
                          ...getBgStyle(child.background),
                          position: 'relative',
                          overflow: 'hidden',
                          minHeight: 30,
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="slide-panel-footer">
        <button className="add-slide-btn" onClick={onAdd}>
          <Plus size={14} />
          Add Slide
        </button>
        {onAddFromTemplate && (
          <button className="add-slide-btn" style={{ marginTop: 8, background: 'var(--bg-card)', color: 'var(--text-secondary)' }} onClick={onAddFromTemplate}>
            <Sparkles size={14} />
            Insert Template
          </button>
        )}
      </div>

      {/* Batch operations footer when multi-selecting */}
      {selectedIndices.length > 1 && (
        <div className="slide-panel-batch-footer">
          <span>{selectedIndices.length} selected</span>
          <button className="btn-icon" onClick={() => {
            const lastIdx = selectedIndices[selectedIndices.length - 1]
            selectedIndices.forEach(i => onDuplicate(i))
            setSelectedIndices([lastIdx])
          }} title="Duplicate all selected">
            <Copy size={12} /> Duplicate
          </button>
          <button
            className="btn-icon"
            onClick={() => {
              if (slides.length - selectedIndices.length < 1) return
              const toDelete = [...selectedIndices].sort((a, b) => b - a)
              let newIdx = currentIndex
              toDelete.forEach(i => {
                onDelete(i)
                if (i < currentIndex) newIdx--
              })
              setSelectedIndices([Math.max(0, newIdx)])
            }}
            title="Delete all selected"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <>
          <div className="slide-context-overlay" onMouseDown={() => setCtxMenu(null)} />
          <div
            className="slide-context-menu"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button onClick={() => { onDuplicate(ctxMenu.index); setCtxMenu(null) }}>
              <Copy size={14} /> Duplicate
            </button>
            <button
              onClick={() => { onToggleLock?.(ctxMenu.index); setCtxMenu(null) }}
            >
              {slides[ctxMenu.index]?.locked ? <Unlock size={14} /> : <Lock size={14} />}
              {slides[ctxMenu.index]?.locked ? 'Unlock' : 'Lock'}
            </button>
            <button
              onClick={() => { onToggleAutoAnimate?.(ctxMenu.index); setCtxMenu(null) }}
            >
              <Sparkles size={14} />
              {slides[ctxMenu.index]?.autoAnimate ? 'Disable' : 'Enable'} Auto-Animate
            </button>
            <div className="context-separator" />
            <button
              onClick={() => { onMove(ctxMenu.index, ctxMenu.index - 1); setCtxMenu(null) }}
              disabled={ctxMenu.index === 0}
            >
              <ArrowUp size={14} /> Move Up
            </button>
            <button
              onClick={() => { onMove(ctxMenu.index, ctxMenu.index + 1); setCtxMenu(null) }}
              disabled={ctxMenu.index === slides.length - 1}
            >
              <ArrowDown size={14} /> Move Down
            </button>
            {onAddVerticalSlide && (
              <button onClick={() => { onAddVerticalSlide?.(ctxMenu.index); setCtxMenu(null) }}>
                <ArrowDownRight size={14} /> Add Vertical Slide
              </button>
            )}
            <div className="context-separator" />
            <button
              onClick={() => { if (slides.length > 1) onDelete(ctxMenu.index); setCtxMenu(null) }}
              style={{ color: slides.length > 1 ? 'var(--danger)' : 'var(--text-muted)' }}
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
