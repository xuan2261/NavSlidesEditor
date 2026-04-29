import { Select } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
/**
 * Image-specific properties: object fit, brightness, contrast, grayscale, round corners.
 */

export default function ImageProperties({ element, onUpdate }) {
  return (
    <div className="mb-2.5">
      <div className="text-[11px] text-text-muted mb-1">Object Fit</div>
      <Select
        data-testid="prop-image-object-fit"
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
          data-testid="prop-image-brightness"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="200"
          value={element.filterBrightness ?? 100}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 200, null)
            if (value === null) return
            onUpdate({ filterBrightness: value })
          }}
        />
      </div>
      <div className="mb-1.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Contrast: {element.filterContrast ?? 100}%
        </div>
        <input
          data-testid="prop-image-contrast"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="200"
          value={element.filterContrast ?? 100}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 200, null)
            if (value === null) return
            onUpdate({ filterContrast: value })
          }}
        />
      </div>
      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Grayscale: {element.filterGrayscale ?? 0}%
        </div>
        <input
          data-testid="prop-image-grayscale"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="100"
          value={element.filterGrayscale ?? 0}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 100, null)
            if (value === null) return
            onUpdate({ filterGrayscale: value })
          }}
        />
      </div>
      <div className="mb-2.5">
        <div className="text-[11px] text-text-muted mb-0.5">
          Round Corners: {element.borderRadius || 0}px
        </div>
        <input
          data-testid="prop-image-border-radius"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="100"
          value={element.borderRadius || 0}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 100, null)
            if (value === null) return
            onUpdate({ borderRadius: value })
          }}
        />
      </div>
    </div>
  )
}
