import { X } from 'lucide-react'

export default function CSSEditorModal({ customCSS, onUpdate, onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#1e1e2e', borderRadius: 12, width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Custom CSS</span>
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4 }}><X size={16} /></button>
        </div>
        <div style={{ padding: '12px 18px', flex: 1, overflow: 'auto' }}>
          <div style={{ fontSize: 11, color: '#a0a0b0', marginBottom: 8 }}>
            Add CSS rules to customize your presentation. These styles are injected into the generated HTML and applied during presentation mode.
          </div>
          <textarea
            value={customCSS || ''}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder={`.reveal .slides section {\n  /* your styles here */\n}\n\n.reveal .slides section h1 {\n  color: #6366f1;\n  text-shadow: 0 2px 8px rgba(0,0,0,0.3);\n}`}
            style={{
              width: '100%', minHeight: 240, background: '#0d0d14', color: '#e0e0e0',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px',
              fontFamily: "'Fira Code', 'JetBrains Mono', 'Courier New', monospace",
              fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none',
            }}
          />
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => onUpdate('')}>Clear</button>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
