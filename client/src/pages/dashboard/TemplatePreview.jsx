import { X, Eye, Play } from 'lucide-react'
import { Button } from '../../components/ui'

export default function TemplatePreview({ template, onClose, onUseTemplate, onUse }) {
  if (!template) return null

  const bgStyle = template.colorScheme
    ? {
        background: `linear-gradient(135deg, ${template.colorScheme.background}, ${template.colorScheme.primary}30)`,
      }
    : template.thumbnail?.gradient
      ? { background: template.thumbnail.gradient }
      : { background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-hover))' }

  const diffLabel = { basic: 'Cơ bản', intermediate: 'Trung cấp', advanced: 'Nâng cao' }
  const diffColor = { basic: '#00ff87', intermediate: '#ffd700', advanced: '#ff4757' }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl p-6 w-[560px] max-w-[90vw] max-h-[80vh] overflow-y-auto shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0 text-base text-text-primary">
            {template.title || 'Template Preview'}
          </h3>
          <Button variant="icon" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </Button>
        </div>

        <div
          className="h-[240px] rounded-lg mb-3 flex items-center justify-center text-text-muted text-sm"
          style={bgStyle}
        >
          <Eye size={32} className="opacity-30" />
        </div>

        {/* Metadata badges */}
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          <span className="px-2 py-0.5 rounded-[10px] text-[11px] bg-hover text-text-muted">
            📄 {template.slides?.length || 0} slides
          </span>
          {template.category && (
            <span className="px-2 py-0.5 rounded-[10px] text-[11px] bg-hover text-text-muted">
              📁 {template.category}
            </span>
          )}
          {template.difficulty && (
            <span
              className="px-2 py-0.5 rounded-[10px] text-[11px] font-semibold"
              style={{
                background: `${diffColor[template.difficulty] || 'var(--bg-hover)'}18`,
                color: diffColor[template.difficulty] || 'var(--text-muted)',
              }}
            >
              {diffLabel[template.difficulty] || template.difficulty}
            </span>
          )}
          {(template.tags || []).includes('interactive') && (
            <span className="px-2 py-0.5 rounded-[10px] text-[11px] font-semibold bg-[rgba(0,212,255,0.15)] text-[#00d4ff]">
              ⚡ Tương tác
            </span>
          )}
        </div>

        {/* Tags */}
        {template.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-2.5">
            {template.tags
              .filter((t) => t !== 'interactive')
              .slice(0, 6)
              .map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-px rounded-md text-[10px] bg-hover text-text-muted"
                >
                  #{tag}
                </span>
              ))}
          </div>
        )}

        <p className="text-[13px] text-text-muted mb-4 leading-relaxed">
          {template.description || `${template.slides?.length || 0} slides`}
        </p>

        <Button
          variant="primary"
          onClick={() => {
            const handler = onUseTemplate || onUse
            handler?.(template)
            onClose()
          }}
          className="w-full justify-center"
        >
          <Play size={14} /> Use This Template
        </Button>
      </div>
    </div>
  )
}
