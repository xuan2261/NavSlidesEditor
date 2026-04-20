import { X, Eye, Play } from 'lucide-react'

export default function TemplatePreview({ template, onClose, onUseTemplate, onUse }) {
  if (!template) return null

  const bgStyle = template.colorScheme
    ? { background: `linear-gradient(135deg, ${template.colorScheme.background}, ${template.colorScheme.primary}30)` }
    : template.thumbnail?.gradient
      ? { background: template.thumbnail.gradient }
      : { background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-hover))' }

  const diffLabel = { basic: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' }
  const diffColor = { basic: '#00ff87', intermediate: '#ffd700', advanced: '#ff4757' }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: 24,
          width: 560, maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>
            {template.title || 'Template Preview'}
          </h3>
          <button onClick={onClose} className="btn-icon" style={{ padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{
          height: 240, borderRadius: 8, marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 14, ...bgStyle,
        }}>
          <Eye size={32} style={{ opacity: 0.3 }} />
        </div>

        {/* Metadata badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
            📄 {template.slides?.length || 0} slides
          </span>
          {template.category && (
            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
              📁 {template.category}
            </span>
          )}
          {template.difficulty && (
            <span style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
              background: `${diffColor[template.difficulty] || 'var(--bg-hover)'}18`,
              color: diffColor[template.difficulty] || 'var(--text-muted)',
            }}>
              {diffLabel[template.difficulty] || template.difficulty}
            </span>
          )}
          {(template.tags || []).includes('interactive') && (
            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'rgba(0,212,255,0.15)', color: '#00d4ff' }}>
              ⚡ Tương tác
            </span>
          )}
        </div>

        {/* Tags */}
        {template.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {template.tags.filter(t => t !== 'interactive').slice(0, 6).map(tag => (
              <span key={tag} style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
          {template.description || `${template.slides?.length || 0} slides`}
        </p>

        <button
          className="btn btn-primary"
          onClick={() => { const handler = onUseTemplate || onUse; handler?.(template); onClose() }}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <Play size={14} /> Use This Template
        </button>
      </div>
    </div>
  )
}
