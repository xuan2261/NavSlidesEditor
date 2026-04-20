import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, CheckSquare, Square, Plus } from 'lucide-react';

/**
 * Lightweight slide thumbnail renderer — avoids full SlideCanvas 
 * which requires editor-specific callbacks.
 */
function SlideThumbnail({ slide, width = 960, height = 540, style }) {
  if (!slide) return null;
  const bg = slide.background;
  const bgStyle = !bg
    ? { backgroundColor: '#1e1e2e' }
    : bg.type === 'color'
      ? { backgroundColor: bg.color || '#1e1e2e' }
      : bg.type === 'gradient'
        ? { background: bg.gradient || '#1e1e2e' }
        : bg.type === 'image' && bg.image
          ? { backgroundImage: `url(${bg.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { backgroundColor: '#1e1e2e' };

  return (
    <div style={{ width, height, position: 'relative', overflow: 'hidden', ...bgStyle, ...style }}>
      {(slide.elements || []).map((el) => (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: el.x, top: el.y,
            width: el.width, height: el.height,
            overflow: 'hidden',
            zIndex: el.zIndex || 1,
          }}
        >
          {el.type === 'text' && (
            <div
              style={{ fontSize: 14, lineHeight: 1.4, color: el.color || '#fff', wordBreak: 'break-word' }}
              dangerouslySetInnerHTML={{ __html: el.content || '' }}
            />
          )}
          {el.type === 'image' && (
            <img
              src={el.src} alt=""
              style={{ width: '100%', height: '100%', objectFit: el.objectFit || 'contain', display: 'block' }}
              draggable={false}
            />
          )}
          {el.type === 'shape' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox={el.viewBox || '0 0 100 100'} style={{ width: '100%', height: '100%' }}>
                <path d={el.path || ''} fill={el.fill || '#6366f1'} stroke={el.stroke || 'none'} strokeWidth={el.strokeWidth || 0} />
              </svg>
            </div>
          )}
          {el.type === 'code' && (
            <pre style={{ margin: 0, padding: 12, background: 'rgba(0,0,0,0.6)', color: '#a5d6a7', fontSize: 12, borderRadius: 6, overflow: 'auto', width: '100%', height: '100%', fontFamily: 'monospace' }}>
              <code>{el.content || ''}</code>
            </pre>
          )}
          {el.type === 'latex' && (
            <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'serif', fontStyle: 'italic', fontSize: 18 }}>
              TeX: {(el.content || '').substring(0, 60)}
            </div>
          )}
          {el.type === 'html' && (
            <div style={{ width: '100%', height: '100%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              &lt;/&gt; HTML
            </div>
          )}
          {el.type === 'chart' && (
            <div style={{ width: '100%', height: '100%', background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              📊 Chart
            </div>
          )}
          {el.type === 'table' && (
            <div style={{ width: '100%', height: '100%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
              📋 Table
            </div>
          )}
          {el.type === 'markdown' && (
            <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 14 }}>
              MD
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TemplatePreview({ template, onUseAsNew, onInsertSlides, onClose, isFavorite, onToggleFavorite }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [insertMode, setInsertMode] = useState(false);
  const [selectedSlides, setSelectedSlides] = useState([]);
  const [insertPosition, setInsertPosition] = useState('after'); // 'after' or 'end'
  
  const slides = template?.slides || [];

  if (!template) return null;

  // Initialize selected slides to all when entering insert mode
  const handleStartInsert = () => {
    setSelectedSlides(slides.map((_, i) => i));
    setInsertMode(true);
  };

  const toggleSlideSelection = (index) => {
    setSelectedSlides(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleInsertConfirm = () => {
    const slidesToInsert = selectedSlides.sort((a,b) => a-b).map(i => slides[i]);
    onInsertSlides(slidesToInsert, insertPosition);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        style={{ width: 1000, height: '90vh', display: 'flex', flexDirection: 'column' }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{template.titleVi || template.title}</h2>
              {onToggleFavorite && (
                <button 
                  className="btn-icon" 
                  onClick={() => onToggleFavorite(template.id)}
                  style={{ color: isFavorite ? '#fbbf24' : 'var(--text-muted)' }}
                  title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <span style={{ fontSize: 18 }}>{isFavorite ? '★' : '☆'}</span>
                </button>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {slides.length} slides • {template.category} • {template.description}
            </p>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        
        <div style={{ flex: 1, backgroundColor: '#111', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!insertMode ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {slides.length > 0 ? (
                <div style={{ width: 960, height: 540, transform: 'scale(0.75)', transformOrigin: 'center', position: 'relative' }}>
                  <SlideThumbnail slide={slides[currentSlide]} />
                </div>
              ) : (
                <div style={{ color: '#fff' }}>No slides available</div>
              )}
              
              {slides.length > 1 && (
                <>
                  <button 
                    className="btn-icon" 
                    style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', width: 44, height: 44, borderRadius: '50%' }}
                    onClick={() => setCurrentSlide(s => Math.max(0, s - 1))}
                    disabled={currentSlide === 0}
                  >
                    <ChevronLeft size={24} color="#fff" />
                  </button>
                  <button 
                    className="btn-icon" 
                    style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', width: 44, height: 44, borderRadius: '50%' }}
                    onClick={() => setCurrentSlide(s => Math.min(slides.length - 1, s + 1))}
                    disabled={currentSlide === slides.length - 1}
                  >
                    <ChevronRight size={24} color="#fff" />
                  </button>
                  <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '4px 12px', borderRadius: 12, fontSize: 12 }}>
                    {currentSlide + 1} / {slides.length}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ color: 'white', margin: 0 }}>Select Slides to Insert</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedSlides(slides.map((_,i)=>i))}>Select All</button>
                  <button className="btn btn-secondary" onClick={() => setSelectedSlides([])}>Deselect All</button>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {slides.map((s, i) => {
                  const isSelected = selectedSlides.includes(i);
                  return (
                    <div 
                      key={i} 
                      style={{ 
                        border: `2px solid ${isSelected ? '#6366f1' : 'transparent'}`, 
                        borderRadius: 8, 
                        overflow: 'hidden', 
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.05)'
                      }}
                      onClick={() => toggleSlideSelection(i)}
                    >
                      <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', pointerEvents: 'none', overflow: 'hidden' }}>
                        <div style={{ transform: 'scale(0.22)', transformOrigin: 'top left', width: 960, height: 540 }}>
                          <SlideThumbnail slide={s} />
                        </div>
                      </div>
                      <div style={{ padding: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
                        <span style={{ color: 'white', fontSize: 12 }}>Slide {i + 1}</span>
                        {isSelected ? <CheckSquare size={16} color="#6366f1" /> : <Square size={16} color="#9ca3af" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {insertMode ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="radio" checked={insertPosition === 'after'} onChange={() => setInsertPosition('after')} />
                  After current slide
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="radio" checked={insertPosition === 'end'} onChange={() => setInsertPosition('end')} />
                  At the end
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => setInsertMode(false)}>Back</button>
                <button 
                  className="btn btn-primary" 
                  disabled={selectedSlides.length === 0}
                  onClick={handleInsertConfirm}
                >
                  <Plus size={16} />
                  Insert {selectedSlides.length} Slide{selectedSlides.length !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                {template.tags?.map(tag => (
                  <span key={tag} style={{ background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                    #{tag}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                {onInsertSlides && (
                  <button className="btn btn-secondary" onClick={handleStartInsert}>Insert into Current</button>
                )}
                {onUseAsNew && (
                  <button className="btn btn-primary" onClick={() => onUseAsNew(template)}>Use as New</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
