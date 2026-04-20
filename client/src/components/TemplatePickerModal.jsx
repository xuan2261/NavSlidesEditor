import { X } from 'lucide-react'
import { SLIDE_TEMPLATES } from '../data/slide-templates'

export default function TemplatePickerModal({ onSelect, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Add Slide</h2>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        {['basic', 'content', 'layout', 'ending'].map((category) => (
          <div key={category} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'capitalize' }}>
              {category === 'basic' ? '📝 Basic' : category === 'content' ? '📄 Content' : category === 'layout' ? '📐 Layout' : '🎬 Ending'}
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}
            >
              {Object.entries(SLIDE_TEMPLATES)
                .filter(([_, tmpl]) => tmpl.category === category)
                .map(([key, tmpl]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onSelect(key)
                      onClose()
                    }}
                    style={{
                      background: 'var(--bg-card)',
                      border: '2px solid var(--border)',
                      borderRadius: 8,
                      padding: 12,
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.background = 'var(--bg-hover)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'var(--bg-card)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '16/9',
                        background: '#1e1e2e',
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                      }}
                    >
                      {tmpl.icon}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>
                      {tmpl.label}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ))}
        <div className="modal-footer" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
