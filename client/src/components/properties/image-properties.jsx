import { Select } from '../../components/ui'
/**
 * Image-specific properties: object fit, brightness, contrast, grayscale, round corners.
 */

export default function ImageProperties({ element, onUpdate }) {
  return (
    <div className="mb-2.5">
      <div className="text-[11px] text-text-muted mb-1">Object Fit</div>
      <Select
        className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted mb-2.5"
        value={element.objectFit || 'contain'}
        onChange={(e) => onUpdate({ objectFit: e.target.value })}
      >
        {['contain', 'cover', 'fill', 'none'].map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>
      <div className="mb-1.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Brightness: {element.filterBrightness ?? 100}%
        </div>
        <input
          type="range"
          className="w-full accent-accent"
          min="0"
          max="200"
          value={element.filterBrightness ?? 100}
          onChange={(e) => onUpdate({ filterBrightness: Number(e.target.value) })}
        />
      </div>
      <div className="mb-1.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Contrast: {element.filterContrast ?? 100}%
        </div>
        <input
          type="range"
          className="w-full accent-accent"
          min="0"
          max="200"
          value={element.filterContrast ?? 100}
          onChange={(e) => onUpdate({ filterContrast: Number(e.target.value) })}
        />
      </div>
      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Grayscale: {element.filterGrayscale ?? 0}%
        </div>
        <input
          type="range"
          className="w-full accent-accent"
          min="0"
          max="100"
          value={element.filterGrayscale ?? 0}
          onChange={(e) => onUpdate({ filterGrayscale: Number(e.target.value) })}
        />
      </div>
      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Round Corners: {element.borderRadius || 0}px
        </div>
        <input
          type="range"
          className="w-full accent-accent"
          min="0"
          max="100"
          value={element.borderRadius || 0}
          onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
