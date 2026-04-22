import { Input, Select } from '../../components/ui'
/**
 * Video/Audio media properties: source URL, poster, controls, autoplay, loop, muted.
 */

export default function MediaProperties({ element, onUpdate }) {
  const isVideo = element.type === 'video'

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Source URL</div>
      <Input
        className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
        type="text"
        value={element.src || ''}
        onChange={(e) => onUpdate({ src: e.target.value })}
        placeholder={isVideo ? 'Video URL' : 'Audio URL'}
        style={{ marginBottom: 8 }}
      />
      {isVideo && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Poster Image URL
          </div>
          <Input
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="text"
            value={element.poster || ''}
            onChange={(e) => onUpdate({ poster: e.target.value })}
            placeholder="Thumbnail URL (optional)"
            style={{ marginBottom: 8 }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Object Fit
          </div>
          <Select
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            value={element.objectFit || 'contain'}
            onChange={(e) => onUpdate({ objectFit: e.target.value })}
            style={{ padding: '4px 6px', marginBottom: 8 }}
          >
            {['contain', 'cover', 'fill', 'none'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(isVideo
          ? [
              ['controls', 'Show controls'],
              ['autoplay', 'Autoplay'],
              ['loop', 'Loop'],
              ['muted', 'Muted'],
            ]
          : [
              ['autoplay', 'Autoplay'],
              ['loop', 'Loop'],
              ['muted', 'Muted'],
            ]
        ).map(([key, label]) => (
          <label
            key={key}
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={key === 'controls' ? element[key] !== false : element[key] || false}
              onChange={(e) => onUpdate({ [key]: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
