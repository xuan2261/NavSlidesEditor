/**
 * Image-specific properties: object fit, brightness, contrast, grayscale, round corners.
 */

export default function ImageProperties({ element, onUpdate }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
        Object Fit
      </div>
      <select
        className="prop-input"
        value={element.objectFit || 'contain'}
        onChange={(e) => onUpdate({ objectFit: e.target.value })}
        style={{ padding: '4px 6px', marginBottom: 10 }}
      >
        {['contain', 'cover', 'fill', 'none'].map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
          Brightness: {element.filterBrightness ?? 100}%
        </div>
        <input
          type="range" min="0" max="200"
          value={element.filterBrightness ?? 100}
          onChange={(e) => onUpdate({ filterBrightness: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
          Contrast: {element.filterContrast ?? 100}%
        </div>
        <input
          type="range" min="0" max="200"
          value={element.filterContrast ?? 100}
          onChange={(e) => onUpdate({ filterContrast: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
          Grayscale: {element.filterGrayscale ?? 0}%
        </div>
        <input
          type="range" min="0" max="100"
          value={element.filterGrayscale ?? 0}
          onChange={(e) => onUpdate({ filterGrayscale: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
          Round Corners: {element.borderRadius || 0}px
        </div>
        <input
          type="range" min="0" max="100"
          value={element.borderRadius || 0}
          onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}
